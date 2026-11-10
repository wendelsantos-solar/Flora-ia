package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flora/internal/calls"
	"flora/internal/identity"
	"flora/internal/store/dbgen"
	"fmt"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"time"
)

type Store struct {
	Pool            *pgxpool.Pool
	ReconcileSIPLab bool
}

func (s *Store) InTenant(ctx context.Context, tenant string, fn func(pgx.Tx) error) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, "SELECT set_config('app.tenant_id',$1,true)", tenant); err != nil {
		return err
	}
	// One transaction per tenant at a time guarantees event sequence follows commit order.
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,0))", tenant); err != nil {
		return err
	}
	if err = fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

type Extension struct {
	ID         string    `json:"id"`
	Number     string    `json:"number"`
	Registered bool      `json:"registered"`
	UpdatedAt  time.Time `json:"updated_at"`
}

func (s *Store) Extensions(ctx context.Context, tenant string) ([]Extension, error) {
	result := []Extension{}
	err := s.InTenant(ctx, tenant, func(tx pgx.Tx) error {
		var tenantID pgtype.UUID
		if err := tenantID.Scan(tenant); err != nil {
			return err
		}
		rows, err := dbgen.New(tx).ListExtensions(ctx, tenantID)
		if err != nil {
			return err
		}
		for _, e := range rows {
			result = append(result, Extension{ID: e.ID, Number: e.Number, Registered: e.Registered, UpdatedAt: e.UpdatedAt.Time})
		}
		return nil
	})
	return result, err
}
func (s *Store) Calls(ctx context.Context, tenant string, limit, offset int) ([]calls.Session, error) {
	return s.History(ctx, tenant, HistoryFilter{}, limit, offset)
}
func (s *Store) Call(ctx context.Context, tenant, id string) (calls.Session, []calls.Leg, error) {
	return s.CallScoped(ctx, tenant, id, identity.Principal{})
}
func (s *Store) CallScoped(ctx context.Context, tenant, id string, viewer identity.Principal) (calls.Session, []calls.Leg, error) {
	items, err := s.History(ctx, tenant, HistoryFilter{ID: id, Viewer: viewer}, 1, 0)
	if err != nil {
		return calls.Session{}, nil, err
	}
	if len(items) == 0 {
		return calls.Session{}, nil, pgx.ErrNoRows
	}
	c := items[0]
	legs := []calls.Leg{}
	err = s.InTenant(ctx, tenant, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT asterisk_unique_id,channel,started_at,ended_at FROM call_legs WHERE tenant_id=$1 AND call_id=$2 ORDER BY started_at`, tenant, id)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var l calls.Leg
			if err = rows.Scan(&l.UniqueID, &l.Channel, &l.StartedAt, &l.EndedAt); err != nil {
				return err
			}
			legs = append(legs, l)
		}
		return rows.Err()
	})
	return c, legs, err
}
func (s *Store) Events(ctx context.Context, tenant string, after int64) ([]calls.Event, error) {
	return s.EventsScoped(ctx, tenant, after, identity.Principal{})
}
func (s *Store) EventsScoped(ctx context.Context, tenant string, after int64, viewer identity.Principal) ([]calls.Event, error) {
	result := []calls.Event{}
	err := s.InTenant(ctx, tenant, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT sequence,call_id::text,type,occurred_at,data FROM call_events WHERE tenant_id=$1 AND sequence>$2 AND (
   (call_id IS NOT NULL AND flora_call_visible(tenant_id,call_id,$3,$4,$5))
   OR (call_id IS NULL AND ($3 IN ('','admin') OR data->>'number'=$4))
  ) ORDER BY sequence LIMIT 200`, tenant, after, viewer.Role, viewer.Extension, viewer.UserID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var e calls.Event
			var raw []byte
			if err = rows.Scan(&e.Sequence, &e.CallID, &e.Type, &e.OccurredAt, &raw); err != nil {
				return err
			}
			if err = json.Unmarshal(raw, &e.Data); err != nil {
				return err
			}
			result = append(result, e)
		}
		return rows.Err()
	})
	return result, err
}
func Key(text string) string { h := sha256.Sum256([]byte(text)); return hex.EncodeToString(h[:]) }

// JournalEvent is derived only from the Asterisk persistent CEL journal or real AMI state.
type JournalEvent struct {
	Key, Tenant, Kind, Source, Destination, UniqueID, LinkedID, Channel, Extra string
	At                                                                         time.Time
}

func (s *Store) Apply(ctx context.Context, e JournalEvent) error {
	if e.Tenant == "" || e.LinkedID == "" || e.UniqueID == "" {
		return fmt.Errorf("unattributed telephony event")
	}
	return s.InTenant(ctx, e.Tenant, func(tx pgx.Tx) error {
		// Serialize a linked call before deduplication and aggregate mutation.
		if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,0))", e.Tenant+e.LinkedID); err != nil {
			return err
		}
		var duplicate bool
		if err := tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM call_events WHERE event_key=$1)", e.Key).Scan(&duplicate); err != nil {
			return err
		}
		if duplicate {
			return nil
		}
		var id string
		err := tx.QueryRow(ctx, `INSERT INTO call_sessions(tenant_id,asterisk_linked_id,source,destination,state,started_at) VALUES($1,$2,$3,$4,'created',$5) ON CONFLICT(tenant_id,asterisk_linked_id) DO UPDATE SET started_at=least(call_sessions.started_at,excluded.started_at) RETURNING id::text`, e.Tenant, e.LinkedID, e.Source, e.Destination, e.At).Scan(&id)
		if err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO call_legs(tenant_id,call_id,asterisk_unique_id,channel,started_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(tenant_id,asterisk_unique_id) DO UPDATE SET started_at=least(call_legs.started_at,excluded.started_at)`, e.Tenant, id, e.UniqueID, e.Channel, e.At); err != nil {
			return err
		}
		if e.UniqueID == e.LinkedID && identity.OwnsExtension(e.Tenant, e.Source) && (identity.OwnsExtension(e.Tenant, e.Destination) || (len(e.Destination) == 3 && e.Destination[0] == '3')) {
			if _, err = tx.Exec(ctx, `UPDATE call_sessions SET source=$3,destination=$4 WHERE id=$1 AND tenant_id=$2
   AND NOT EXISTS (SELECT 1 FROM call_events WHERE tenant_id=$2 AND call_id=$1 AND (
    type LIKE 'call.transfer.%' OR (data->>'asterisk_unique_id'=call_sessions.asterisk_linked_id
    AND data->>'destination' ~ '^(2[01][123]|3[0-9]{2})$')))`, id, e.Tenant, e.Source, e.Destination); err != nil {
				return err
			}
		}
		eventType := "telephony." + e.Kind
		switch e.Kind {
		case "CHAN_START":
			eventType = "call.created"
		case "RINGING":
			eventType = "call.ringing"
			_, err = tx.Exec(ctx, `UPDATE call_sessions SET state='ringing' WHERE id=$1 AND tenant_id=$2 AND state='created'`, id, e.Tenant)
		case "ANSWER":
			eventType = "call.answered"
			_, err = tx.Exec(ctx, `UPDATE call_sessions SET answered_at=least(answered_at,$3::timestamptz),state=CASE WHEN ended_at IS NULL THEN 'answered' ELSE 'completed' END WHERE id=$1 AND tenant_id=$2`, id, e.Tenant, e.At)
		case "BLINDTRANSFER":
			eventType = "call.transfer.blind"
		case "ATTENDEDTRANSFER":
			eventType = "call.transfer.attended"
		case "CHAN_END":
			_, err = tx.Exec(ctx, `UPDATE call_legs SET ended_at=$3 WHERE tenant_id=$1 AND asterisk_unique_id=$2`, e.Tenant, e.UniqueID, e.At)
		case "LINKEDID_END":
			var state string
			err = tx.QueryRow(ctx, `UPDATE call_sessions SET ended_at=$3,state=CASE
			 WHEN answered_at IS NOT NULL THEN 'completed'
			 WHEN EXISTS (SELECT 1 FROM call_events WHERE tenant_id=$2 AND call_id=$1 AND type='call.created'
			  AND data->>'asterisk_unique_id'=$4) THEN 'failed'
			 ELSE 'interrupted' END WHERE id=$1 AND tenant_id=$2 RETURNING state`, id, e.Tenant, e.At, e.LinkedID).Scan(&state)
			if err != nil {
				return err
			}
			eventType = "call." + state

		}
		if err != nil {
			return err
		}
		fields := map[string]any{"asterisk_unique_id": e.UniqueID, "asterisk_linked_id": e.LinkedID, "source": e.Source, "destination": e.Destination, "journal_type": e.Kind}
		if e.Kind == "BLINDTRANSFER" || e.Kind == "ATTENDEDTRANSFER" || e.Kind == "HANGUP" {
			var extra map[string]any
			if json.Unmarshal([]byte(e.Extra), &extra) == nil {
				details := map[string]any{}
				for _, key := range []string{"extension", "context", "channel2_name", "channel2_uniqueid", "transferee_channel_name", "transferee_channel_uniqueid", "transfer_target_channel_name", "transfer_target_channel_uniqueid", "bridge1_id", "bridge2_id", "bridge_id", "hangupcause", "dialstatus"} {
					if value, ok := extra[key]; ok {
						details[key] = value
					}
				}
				fields["details"] = details
			}
		}
		if e.Kind == "LINKEDID_END" {
			if eventType == "call.interrupted" {
				fields["reason"] = "terminal_cel_without_initial_or_answer"
			}
			if s.ReconcileSIPLab {
				tag, err := tx.Exec(ctx, `UPDATE sip_lab_calls SET ended_at=$3,result='UNKNOWN'
				 WHERE tenant_id=$1 AND call_id=$2 AND decision='allowed' AND ended_at IS NULL
				   AND created_at<=$3`, e.Tenant, e.LinkedID, e.At)
				if err != nil {
					return err
				}
				if tag.RowsAffected() != 0 {
					fields["sip_lab_finish_recovered"] = true
				}
			}
		}
		data, _ := json.Marshal(fields)
		_, err = tx.Exec(ctx, `INSERT INTO call_events(tenant_id,call_id,event_key,type,occurred_at,data) VALUES($1,$2,$3,$4,$5,$6)`, e.Tenant, id, e.Key, eventType, e.At, data)
		return err
	})
}
func (s *Store) Registration(ctx context.Context, tenant, number string, registered bool) error {
	return s.InTenant(ctx, tenant, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `UPDATE extensions SET registered=$3,updated_at=now() WHERE tenant_id=$1 AND number=$2 AND registered<>$3`, tenant, number, registered)
		if err != nil || tag.RowsAffected() == 0 {
			return err
		}
		kind := "extension.unregistered"
		if registered {
			kind = "extension.registered"
		}
		data, _ := json.Marshal(map[string]string{"number": number})
		_, err = tx.Exec(ctx, `INSERT INTO call_events(tenant_id,event_key,type,occurred_at,data) VALUES($1,gen_random_uuid()::text,$2,now(),$3)`, tenant, kind, data)
		return err
	})
}

// Reconcile marks orphaned sessions explicitly interrupted, never completed or answered.
// The grace period lets the durable journal catch up before an absent-channel decision.
func (s *Store) Reconcile(ctx context.Context, tenant string, linkedIDs []string) error {
	return s.InTenant(ctx, tenant, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `UPDATE call_sessions SET state='interrupted',ended_at=now() WHERE tenant_id=$1 AND ended_at IS NULL AND started_at<now()-interval '15 seconds' AND NOT (asterisk_linked_id=ANY($2::text[])) RETURNING id::text,asterisk_linked_id`, tenant, linkedIDs)
		if err != nil {
			return err
		}
		type orphan struct{ id, linked string }
		items := []orphan{}
		for rows.Next() {
			var o orphan
			if err = rows.Scan(&o.id, &o.linked); err != nil {
				rows.Close()
				return err
			}
			items = append(items, o)
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return err
		}
		for _, o := range items {
			_, err = tx.Exec(ctx, `INSERT INTO call_events(tenant_id,call_id,event_key,type,occurred_at,data) VALUES($1,$2,$3,'call.interrupted',now(),'{"reason":"channel_absent_during_reconciliation"}') ON CONFLICT(event_key) DO NOTHING`, tenant, o.id, Key(tenant+o.linked+"interrupted"))
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Store) Metrics(ctx context.Context, tenant string) (map[string]int64, error) {
	result := map[string]int64{"calls_total": 0, "calls_answered": 0, "calls_completed": 0, "calls_failed": 0, "calls_active": 0, "calls_interrupted": 0, "events_total": 0}
	err := s.InTenant(ctx, tenant, func(tx pgx.Tx) error {
		var total, answered, completed, failed, active, interrupted, events int64
		err := tx.QueryRow(ctx, `SELECT count(*),count(*) FILTER(WHERE answered_at IS NOT NULL),count(*) FILTER(WHERE state='completed'),count(*) FILTER(WHERE state='failed'),count(*) FILTER(WHERE ended_at IS NULL),count(*) FILTER(WHERE state='interrupted') FROM call_sessions WHERE tenant_id=$1`, tenant).Scan(&total, &answered, &completed, &failed, &active, &interrupted)
		if err != nil {
			return err
		}
		if err = tx.QueryRow(ctx, `SELECT count(*) FROM call_events WHERE tenant_id=$1`, tenant).Scan(&events); err != nil {
			return err
		}
		result = map[string]int64{"calls_total": total, "calls_answered": answered, "calls_completed": completed, "calls_failed": failed, "calls_active": active, "calls_interrupted": interrupted, "events_total": events}
		return nil
	})
	return result, err
}

// EventCursor is a tenant-local high water mark for a fresh snapshot subscription.
func (s *Store) EventCursor(ctx context.Context, tenant string) (int64, error) {
	var cursor int64
	err := s.InTenant(ctx, tenant, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, "SELECT coalesce(max(sequence),0) FROM call_events WHERE tenant_id=$1", tenant).Scan(&cursor)
	})
	return cursor, err
}
