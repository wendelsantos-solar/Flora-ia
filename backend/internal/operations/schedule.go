package operations

import (
	"context"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type Schedule struct {
	Department        string `json:"department"`
	Timezone          string `json:"timezone"`
	Days              []int  `json:"days"`
	OpensAt           string `json:"opens_at"`
	ClosesAt          string `json:"closes_at"`
	ClosedDestination string `json:"closed_destination"`
}

var timezonePattern = regexp.MustCompile("^[A-Za-z0-9_+/-]{1,64}$")
var timePattern = regexp.MustCompile("^([01][0-9]|2[0-3]):[0-5][0-9]$")

func ValidSchedule(s Schedule) bool {
	if !codePattern.MatchString(s.Department) || !timezonePattern.MatchString(s.Timezone) || s.Timezone == "Local" || strings.HasPrefix(s.Timezone, "/") || !timePattern.MatchString(s.OpensAt) || !timePattern.MatchString(s.ClosesAt) || s.OpensAt >= s.ClosesAt || len(s.Days) < 1 || len(s.Days) > 7 || (s.ClosedDestination != "" && !extPattern.MatchString(s.ClosedDestination)) {
		return false
	}
	if _, err := time.LoadLocation(s.Timezone); err != nil {
		return false
	}
	seen := map[int]bool{}
	for _, d := range s.Days {
		if d < 0 || d > 6 || seen[d] {
			return false
		}
		seen[d] = true
	}
	return true
}
func (r Repository) Schedule(ctx context.Context, a Actor, s Schedule, remove bool) error {
	if !codePattern.MatchString(s.Department) || (!remove && !ValidSchedule(s)) {
		return ErrInvalid
	}
	return r.mutate(ctx, a, op("schedule", remove), s.Department, func(tx pgx.Tx) (pgconn.CommandTag, error) {
		if remove {
			return tx.Exec(ctx, "DELETE FROM department_schedules WHERE tenant_id=$1 AND department=$2", a.Tenant, s.Department)
		}
		slices.Sort(s.Days)
		return tx.Exec(ctx, `INSERT INTO department_schedules(tenant_id,department,timezone,days,opens_at,closes_at,closed_destination)
   VALUES($1,$2,$3,$4,$5,$6,nullif($7,'')) ON CONFLICT(tenant_id,department) DO UPDATE SET timezone=excluded.timezone,days=excluded.days,opens_at=excluded.opens_at,closes_at=excluded.closes_at,closed_destination=excluded.closed_destination`, a.Tenant, s.Department, s.Timezone, s.Days, s.OpensAt, s.ClosesAt, s.ClosedDestination)
	})
}
