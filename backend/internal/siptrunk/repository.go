package siptrunk

import (
	"context"
	"encoding/json"
	"errors"
	"flora/internal/identity"
	"flora/internal/store"
	"regexp"
	"slices"
	"time"

	"github.com/jackc/pgx/v5"
)

type Repository struct{ Store *store.Store }

type Policy struct {
	Enabled       bool     `json:"enabled"`
	TrunkEnabled  bool     `json:"trunk_enabled"`
	Allowed       []string `json:"allowed"`
	Blocked       []string `json:"blocked"`
	Lines         []string `json:"lines"`
	TenantLimit   int      `json:"tenant_limit"`
	TrunkLimit    int      `json:"trunk_limit"`
	LineLimit     int      `json:"line_limit"`
	Attempts      int      `json:"attempts"`
	Seconds       int      `json:"seconds"`
	InboundDID    string   `json:"inbound_did"`
	InboundTarget string   `json:"inbound_target"`
}

func (p Policy) valid(tenant string) bool {
	if !labNumber.MatchString(p.InboundDID) || p.Seconds < 1 || p.Seconds > 120 || p.Attempts < 1 || p.Attempts > 60 || len(p.Allowed) > 20 || len(p.Blocked) > 20 || len(p.Lines) > 3 {
		return false
	}
	for _, limit := range []int{p.TenantLimit, p.TrunkLimit, p.LineLimit} {
		if limit < 1 || limit > 10 {
			return false
		}
	}
	for _, numbers := range [][]string{p.Allowed, p.Blocked} {
		for _, n := range numbers {
			if !labNumber.MatchString(n) {
				return false
			}
		}
	}
	for _, line := range p.Lines {
		if !identity.OwnsExtension(tenant, line) || identity.ExtensionRole(line) == "supervisor" {
			return false
		}
	}
	return p.InboundTarget == "" || identity.OwnsExtension(tenant, p.InboundTarget) || queue.MatchString(p.InboundTarget)
}

var (
	ErrInvalid = errors.New("invalid lab configuration")
	queue      = regexp.MustCompile(`^3[0-9]{2}$`)
	callID     = regexp.MustCompile(`^[A-Za-z0-9._-]{1,64}$`)
)

func readPolicy(ctx context.Context, tx pgx.Tx, tenant string) (p Policy, err error) {
	err = tx.QueryRow(ctx, `SELECT enabled,trunk_enabled,allowed,blocked,lines,tenant_limit,trunk_limit,line_limit,attempts,seconds,inbound_target,inbound_did FROM sip_lab_policies WHERE tenant_id=$1`, tenant).
		Scan(&p.Enabled, &p.TrunkEnabled, &p.Allowed, &p.Blocked, &p.Lines, &p.TenantLimit, &p.TrunkLimit, &p.LineLimit, &p.Attempts, &p.Seconds, &p.InboundTarget, &p.InboundDID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Policy{Allowed: []string{}, Blocked: []string{}, Lines: []string{}, TenantLimit: 1, TrunkLimit: 1, LineLimit: 1, Attempts: 5, Seconds: 30, InboundDID: "8800000000"}, nil
	}
	return
}

func (r Repository) Save(ctx context.Context, actor identity.Principal, correlation string, p Policy) error {
	if actor.Role != "admin" || !p.valid(actor.TenantID) {
		return ErrInvalid
	}
	return r.Store.InTenant(ctx, actor.TenantID, func(tx pgx.Tx) error {
		if queue.MatchString(p.InboundTarget) {
			var exists bool
			if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM queues WHERE tenant_id=$1 AND number=$2)`, actor.TenantID, p.InboundTarget).Scan(&exists); err != nil {
				return err
			}
			if !exists {
				return ErrInvalid
			}
		}
		_, err := tx.Exec(ctx, `INSERT INTO sip_lab_policies(tenant_id,enabled,trunk_enabled,allowed,blocked,lines,tenant_limit,trunk_limit,line_limit,attempts,seconds,inbound_target,inbound_did) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		ON CONFLICT(tenant_id) DO UPDATE SET enabled=$2,trunk_enabled=$3,allowed=$4,blocked=$5,lines=$6,tenant_limit=$7,trunk_limit=$8,line_limit=$9,attempts=$10,seconds=$11,inbound_target=$12,inbound_did=$13`,
			actor.TenantID, p.Enabled, p.TrunkEnabled, nonNil(p.Allowed), nonNil(p.Blocked), nonNil(p.Lines), p.TenantLimit, p.TrunkLimit, p.LineLimit, p.Attempts, p.Seconds, p.InboundTarget, p.InboundDID)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `INSERT INTO audit_entries(tenant_id,actor_id,action,target,correlation_id) VALUES($1,$2,'sip_lab.policy.updated','simulator',$3)`, actor.TenantID, actor.UserID, correlation)
		return err
	})
}
func nonNil(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}

type Attempt struct {
	ID          string     `json:"id"`
	Direction   string     `json:"direction"`
	Origin      string     `json:"origin"`
	Destination string     `json:"destination"`
	Result      string     `json:"result"`
	Talk        int        `json:"talk"`
	EndedAt     *time.Time `json:"ended_at,omitempty"`
}
type Decision struct {
	Status  string `json:"status"`
	Target  string `json:"target,omitempty"`
	Seconds int    `json:"seconds,omitempty"`
}

const RingSeconds = 8

func (r Repository) Reserve(ctx context.Context, tenant string, a Attempt) (d Decision, err error) {
	if !callID.MatchString(a.ID) || (a.Direction != "in" && a.Direction != "out") {
		return Decision{Status: "invalid"}, nil
	}
	number, category := Classify(a.Destination)
	if labNumber.MatchString(a.Destination) {
		number, category = a.Destination, "simulator"
	} else {
		number = ""
	}
	d.Status = "disabled"
	err = r.Store.InTenant(ctx, tenant, func(tx pgx.Tx) error {
		p, err := readPolicy(ctx, tx, tenant)
		if err != nil {
			return err
		}
		var existing bool
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM sip_lab_calls WHERE tenant_id=$1 AND call_id=$2)`, tenant, a.ID).Scan(&existing); err != nil {
			return err
		}
		if existing {
			d.Status = "duplicate"
			return nil
		}
		if a.Direction == "in" || !identity.OwnsExtension(tenant, a.Origin) {
			a.Origin = ""
		}
		switch {
		case !p.Enabled:
			d.Status = "disabled"
		case !p.TrunkEnabled:
			d.Status = "trunk_disabled"
		case category != "simulator":
			d.Status = "destination_denied"
		case a.Direction == "in" && (number != p.InboundDID || p.InboundTarget == ""):
			d.Status = "route_missing"
		case a.Direction == "out" && (identity.ExtensionRole(a.Origin) == "supervisor" || !slices.Contains(p.Lines, a.Origin)):
			d.Status = "line_denied"
		case a.Direction == "out" && (!slices.Contains(p.Allowed, number) || slices.Contains(p.Blocked, number)):
			d.Status = "destination_denied"
		default:
			var active, trunk, line, attempts int
			err = tx.QueryRow(ctx, `SELECT count(*) FILTER (WHERE expires_at>clock_timestamp() AND ended_at IS NULL),
			 count(*) FILTER (WHERE expires_at>clock_timestamp() AND ended_at IS NULL AND trunk='simulator'),
			 count(*) FILTER (WHERE expires_at>clock_timestamp() AND ended_at IS NULL AND direction='out' AND origin=$2),
			 count(*) FILTER (WHERE direction=$3 AND created_at>clock_timestamp()-interval '1 minute')
			 FROM sip_lab_calls WHERE tenant_id=$1 AND (created_at>clock_timestamp()-interval '1 minute' OR expires_at>clock_timestamp())`, tenant, a.Origin, a.Direction).Scan(&active, &trunk, &line, &attempts)
			if err != nil {
				return err
			}
			switch {
			case attempts >= p.Attempts:
				d.Status = "attempt_limit"
			case active >= p.TenantLimit || trunk >= p.TrunkLimit:
				d.Status = "capacity"
			case a.Direction == "out" && line >= p.LineLimit:
				d.Status = "line_capacity"
			default:
				d = Decision{Status: "allowed", Target: number, Seconds: p.Seconds}
				if a.Direction == "in" {
					d.Target = p.InboundTarget
				}
			}
		}
		snapshot, err := json.Marshal(p)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `INSERT INTO sip_lab_calls(tenant_id,call_id,direction,origin,destination,category,policy,decision,expires_at)
		 VALUES($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $8='allowed' THEN clock_timestamp()+($9::integer*interval '1 second') END)`, tenant, a.ID, a.Direction, a.Origin, number, category, snapshot, d.Status, d.Seconds+RingSeconds+15)
		return err
	})
	if err != nil {
		return Decision{}, err
	}
	return d, nil
}

func (r Repository) Finish(ctx context.Context, tenant string, a Attempt) error {
	if !callID.MatchString(a.ID) || a.Talk < 0 || a.Talk > 120 {
		return ErrInvalid
	}
	if !slices.Contains([]string{"ANSWER", "BUSY", "NOANSWER", "CANCEL", "CHANUNAVAIL", "CONGESTION", "UNKNOWN"}, a.Result) {
		return ErrInvalid
	}
	return r.Store.InTenant(ctx, tenant, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `UPDATE sip_lab_calls SET ended_at=LEAST(clock_timestamp(),GREATEST(created_at,COALESCE($5::timestamptz,clock_timestamp()))),result=$3,talk_seconds=CASE WHEN $3='ANSWER' THEN $4::integer END WHERE tenant_id=$1 AND call_id=$2 AND decision='allowed' AND (ended_at IS NULL OR (result='UNKNOWN' AND $3<>'UNKNOWN'))`, tenant, a.ID, a.Result, a.Talk, a.EndedAt)
		return err
	})
}

type Usage struct {
	Direction string `json:"direction"`
	Decision  string `json:"decision"`
	Result    string `json:"result"`
	Calls     int    `json:"calls"`
	Seconds   int    `json:"seconds"`
}

func (r Repository) Status(ctx context.Context, tenant string) (p Policy, usage []Usage, err error) {
	usage = []Usage{}
	err = r.Store.InTenant(ctx, tenant, func(tx pgx.Tx) error {
		var err error
		p, err = readPolicy(ctx, tx, tenant)
		if err != nil {
			return err
		}
		rows, err := tx.Query(ctx, `SELECT direction,decision,COALESCE(result,CASE WHEN expires_at<=clock_timestamp() THEN 'unconfirmed' ELSE '' END),count(*),COALESCE(sum(talk_seconds),0)
		FROM sip_lab_calls WHERE tenant_id=$1 AND created_at>clock_timestamp()-interval '24 hours' GROUP BY 1,2,3 ORDER BY 1,2,3`, tenant)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var u Usage
			if err = rows.Scan(&u.Direction, &u.Decision, &u.Result, &u.Calls, &u.Seconds); err != nil {
				return err
			}
			usage = append(usage, u)
		}
		return rows.Err()
	})
	return
}
