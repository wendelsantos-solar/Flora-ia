package calls

import "time"

type Session struct {
	Tenant           string     `json:"tenant_id"`
	Department       *string    `json:"department"`
	Queue            *string    `json:"queue"`
	Agent            *string    `json:"agent"`
	WaitSeconds      *int       `json:"wait_seconds"`
	TalkSeconds      *int       `json:"talk_seconds"`
	Outcome          string     `json:"outcome"`
	HangupCause      *int       `json:"hangup_cause"`
	ID               string     `json:"id"`
	Source           string     `json:"source"`
	Destination      string     `json:"destination"`
	State            string     `json:"state"`
	StartedAt        time.Time  `json:"started_at"`
	AnsweredAt       *time.Time `json:"answered_at"`
	EndedAt          *time.Time `json:"ended_at"`
	AsteriskLinkedID string     `json:"asterisk_linked_id"`
}
type Event struct {
	Sequence   int64          `json:"sequence"`
	CallID     *string        `json:"call_id"`
	Type       string         `json:"type"`
	OccurredAt time.Time      `json:"occurred_at"`
	Data       map[string]any `json:"data"`
}
type Leg struct {
	UniqueID  string     `json:"asterisk_unique_id"`
	Channel   string     `json:"channel"`
	StartedAt time.Time  `json:"started_at"`
	EndedAt   *time.Time `json:"ended_at"`
}
