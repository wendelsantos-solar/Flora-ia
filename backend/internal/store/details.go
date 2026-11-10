package store

import (
	"context"
	"encoding/json"
	"flora/internal/calls"
	"github.com/jackc/pgx/v5"
	"time"
)

func (s *Store) CallEvents(ctx context.Context, tenant, id string) ([]calls.Event, error) {
	events := []calls.Event{}
	err := s.InTenant(ctx, tenant, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT sequence,call_id::text,type,occurred_at,data FROM call_events WHERE tenant_id=$1 AND call_id=$2 ORDER BY occurred_at,sequence LIMIT 250`, tenant, id)
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
			events = append(events, e)
		}
		return rows.Err()
	})
	return events, err
}

type QueueTimelineEvent struct {
	Queue         string    `json:"queue"`
	Kind          string    `json:"kind"`
	At            time.Time `json:"occurred_at"`
	Agent         *string   `json:"agent"`
	Wait          *int      `json:"wait_seconds"`
	Talk          *int      `json:"talk_seconds"`
	RoutingStatus *string   `json:"routing_status"`
}

func (s *Store) QueueTimeline(ctx context.Context, tenant, id string) ([]QueueTimelineEvent, error) {
	result := []QueueTimelineEvent{}
	err := s.InTenant(ctx, tenant, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT q.queue,q.kind,q.occurred_at,q.agent,q.wait_seconds,q.talk_seconds,q.routing_status
   FROM call_sessions c JOIN queue_journal q ON q.tenant_id=c.tenant_id AND (q.asterisk_unique_id=c.asterisk_linked_id OR q.asterisk_unique_id IN (
    SELECT l.asterisk_unique_id FROM call_legs l WHERE l.tenant_id=c.tenant_id AND l.call_id=c.id
   )) WHERE c.tenant_id=$1 AND c.id=$2 ORDER BY q.occurred_at,q.event_key LIMIT 250`, tenant, id)
		if err != nil {
			return err
		}
		result, err = pgx.CollectRows(rows, pgx.RowToStructByPos[QueueTimelineEvent])
		return err
	})
	return result, err
}
