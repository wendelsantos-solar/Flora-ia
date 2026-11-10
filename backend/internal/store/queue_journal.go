package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

type QueueEvent struct {
	Key, Queue, UniqueID, Agent, Kind, RoutingStatus string
	At                                               time.Time
	WaitSeconds, TalkSeconds                         *int
}

func (s *Store) RecordQueueEvents(ctx context.Context, tenant string, events []QueueEvent) error {
	if len(events) == 0 {
		return nil
	}
	return s.InTenant(ctx, tenant, func(tx pgx.Tx) error {
		batch := &pgx.Batch{}
		for _, e := range events {
			batch.Queue(`INSERT INTO queue_journal(tenant_id,event_key,queue,department,asterisk_unique_id,agent,kind,occurred_at,wait_seconds,talk_seconds,routing_status)
   VALUES($1,$2,$3,coalesce(
    (SELECT department FROM queue_journal WHERE tenant_id=$1 AND queue=$3 AND asterisk_unique_id=$4 AND department IS NOT NULL ORDER BY occurred_at LIMIT 1),
    (SELECT department FROM queues WHERE tenant_id=$1 AND number=$3)
   ),$4,nullif($5,''),$6,$7,$8,$9,nullif($10,''))
   ON CONFLICT(tenant_id,event_key) DO NOTHING`, tenant, e.Key, e.Queue, e.UniqueID, e.Agent, e.Kind, e.At, e.WaitSeconds, e.TalkSeconds, e.RoutingStatus)
		}
		return tx.SendBatch(ctx, batch).Close()
	})
}

type QueueTotals struct {
	Answered           int      `json:"answered"`
	Abandoned          int      `json:"abandoned"`
	AverageWaitSeconds *float64 `json:"average_wait_seconds"`
}

func (s *Store) QueueTotals(ctx context.Context, tenant string, since time.Time) (QueueTotals, error) {
	return s.QueueTotalsScoped(ctx, tenant, since, nil)
}
func (s *Store) QueueTotalsScoped(ctx context.Context, tenant string, since time.Time, departments []string) (QueueTotals, error) {
	var total QueueTotals
	err := s.InTenant(ctx, tenant, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `WITH sessions AS (
   SELECT coalesce(c.asterisk_linked_id,q.asterisk_unique_id) id,
   bool_or(q.kind='CONNECT') answered, bool_or(q.kind='ABANDON') abandoned,
   min(q.wait_seconds) FILTER(WHERE q.kind='CONNECT') wait_seconds
   FROM queue_journal q
   LEFT JOIN call_legs l ON l.tenant_id=q.tenant_id AND l.asterisk_unique_id=q.asterisk_unique_id
   LEFT JOIN call_sessions c ON c.tenant_id=l.tenant_id AND c.id=l.call_id
   WHERE q.tenant_id=$1 AND q.occurred_at >= $2 AND q.kind IN ('CONNECT','ABANDON') AND ($3::text[] IS NULL OR q.department=ANY($3))
   GROUP BY 1
  ) SELECT count(*) FILTER(WHERE answered),count(*) FILTER(WHERE abandoned AND NOT answered),
   avg(wait_seconds)::float8 FROM sessions`, tenant, since, departments).Scan(&total.Answered, &total.Abandoned, &total.AverageWaitSeconds)
	})
	return total, err
}
