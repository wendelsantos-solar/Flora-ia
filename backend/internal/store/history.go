package store

import (
	"context"
	"flora/internal/calls"
	"flora/internal/identity"
	"time"

	"github.com/jackc/pgx/v5"
)

type HistoryFilter struct {
	From, To                       *time.Time
	Viewer                         identity.Principal
	Department, Agent, Outcome, ID string
}

const historySQL = `
SELECT id::text,tenant_id::text,source,destination,state,started_at,answered_at,ended_at,asterisk_linked_id,
 department,queue,agent,wait_seconds,talk_seconds,outcome,hangup_cause
FROM (
 SELECT c.*,q.department,q.queue,
 coalesce(q.agent,CASE WHEN c.answered_at IS NOT NULL AND c.destination ~ '^2[01][123]$' THEN c.destination END) AS agent,
 q.wait_seconds,
 coalesce(q.talk_seconds,CASE WHEN c.answered_at IS NOT NULL AND c.ended_at IS NOT NULL
  THEN greatest(0,extract(epoch FROM c.ended_at-c.answered_at)::int) END) AS talk_seconds,
 h.cause AS hangup_cause,
 CASE WHEN c.ended_at IS NULL THEN c.state
  WHEN c.state='interrupted' THEN 'interrupted'
  WHEN c.answered_at IS NOT NULL THEN 'answered'
  WHEN q.exit_kind='ABANDON' THEN 'abandoned'
  WHEN q.exit_kind='EXITWITHTIMEOUT' THEN 'timeout'
  WHEN q.exit_kind='FLORA_CLOSED' THEN 'closed'
  WHEN q.exit_kind='EXITEMPTY' OR q.routing_status IN ('JOINEMPTY','LEAVEEMPTY','JOINUNAVAIL','LEAVEUNAVAIL') THEN 'unavailable'
  WHEN h.cause=17 THEN 'busy'
  WHEN h.cause=21 THEN 'rejected'
  WHEN h.cause IN (1,3,27,34,38,41,42,47,58,88) THEN 'failed'
  ELSE 'not_answered' END AS outcome
 FROM call_sessions c
 LEFT JOIN LATERAL (
  SELECT (array_agg(q.department ORDER BY q.occurred_at,q.event_key) FILTER (WHERE q.department IS NOT NULL))[1] department,
   (array_agg(q.queue ORDER BY q.occurred_at,q.event_key) FILTER (WHERE q.kind IN ('ENTERQUEUE','FLORA_CLOSED','FLORA_CONTINGENCY')))[1] queue,
   (array_agg(q.agent ORDER BY q.occurred_at,q.event_key) FILTER (WHERE q.kind='CONNECT'))[1] agent,
   coalesce(min(q.wait_seconds) FILTER (WHERE q.kind='CONNECT'), min(q.wait_seconds) FILTER(WHERE q.kind IN ('ABANDON','EXITWITHTIMEOUT','EXITEMPTY'))) wait_seconds,
   max(q.talk_seconds) talk_seconds,
   max(q.routing_status) routing_status,
   (array_agg(q.kind ORDER BY q.occurred_at DESC,q.event_key DESC) FILTER(WHERE q.kind IN ('ABANDON','EXITWITHTIMEOUT','EXITEMPTY','FLORA_CLOSED')))[1] exit_kind
  FROM queue_journal q WHERE q.tenant_id=c.tenant_id AND (
   q.asterisk_unique_id=c.asterisk_linked_id OR q.asterisk_unique_id IN (
    SELECT l.asterisk_unique_id FROM call_legs l WHERE l.tenant_id=c.tenant_id AND l.call_id=c.id
   ))
 ) q ON true
 LEFT JOIN LATERAL (
  SELECT CASE WHEN e.data->'details'->>'hangupcause' ~ '^[0-9]{1,3}$'
    THEN (e.data->'details'->>'hangupcause')::integer END cause
  FROM call_events e
  WHERE e.tenant_id=c.tenant_id AND e.call_id=c.id AND e.type='telephony.HANGUP' AND e.data->>'asterisk_unique_id'=c.asterisk_linked_id
  ORDER BY e.occurred_at DESC,e.sequence DESC LIMIT 1
 ) h ON true
 WHERE c.tenant_id=$1 AND ($2::timestamptz IS NULL OR c.started_at >= $2) AND ($3::timestamptz IS NULL OR c.started_at < $3)
  AND (nullif($7,'') IS NULL OR c.id=nullif($7,'')::uuid)
  AND flora_call_visible(c.tenant_id,c.id,$10,$11,$12)
) c
WHERE ($4='' OR department=$4) AND ($5='' OR agent=$5) AND ($6='' OR outcome=$6)
ORDER BY started_at DESC,id DESC LIMIT $8 OFFSET $9`

func (s *Store) History(ctx context.Context, tenant string, f HistoryFilter, limit, offset int) ([]calls.Session, error) {
	result := []calls.Session{}
	err := s.InTenant(ctx, tenant, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, historySQL, tenant, f.From, f.To, f.Department, f.Agent, f.Outcome, f.ID, limit, offset, f.Viewer.Role, f.Viewer.Extension, f.Viewer.UserID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var c calls.Session
			if err = rows.Scan(&c.ID, &c.Tenant, &c.Source, &c.Destination, &c.State, &c.StartedAt, &c.AnsweredAt, &c.EndedAt, &c.AsteriskLinkedID, &c.Department, &c.Queue, &c.Agent, &c.WaitSeconds, &c.TalkSeconds, &c.Outcome, &c.HangupCause); err != nil {
				return err
			}
			result = append(result, c)
		}
		return rows.Err()
	})
	return result, err
}
