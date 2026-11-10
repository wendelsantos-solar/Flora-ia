package operations

import (
	"context"
	"errors"
	"flora/internal/store"
	"regexp"
	"slices"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

var ErrInvalid = errors.New("invalid configuration")
var ErrConflict = errors.New("configuration conflict")
var ErrNotFound = errors.New("configuration not found")
var codePattern = regexp.MustCompile("^[a-z][a-z0-9-]{0,31}$")
var queuePattern = regexp.MustCompile("^3[0-9]{2}$")
var extPattern = regexp.MustCompile("^[0-9]{3}$")

type Department struct {
	Code string `json:"code"`
	Name string `json:"name"`
}
type Queue struct {
	Number      string `json:"number"`
	Department  string `json:"department"`
	Strategy    string `json:"strategy"`
	RingSeconds int    `json:"ring_seconds"`
	WaitSeconds int    `json:"wait_seconds"`
	Fallback    string `json:"fallback"`
}
type Member struct {
	Queue     string `json:"queue"`
	Extension string `json:"extension"`
	Joined    bool   `json:"joined"`
	Paused    bool   `json:"paused"`
}
type Catalog struct {
	Schedules   []Schedule   `json:"schedules"`
	Departments []Department `json:"departments"`
	Queues      []Queue      `json:"queues"`
	Members     []Member     `json:"members"`
}
type Repository struct{ Store *store.Store }
type Actor struct{ Tenant, User, Correlation string }

func (r Repository) Catalog(ctx context.Context, tenant string) (Catalog, error) {
	c := Catalog{Departments: []Department{}, Queues: []Queue{}, Members: []Member{}, Schedules: []Schedule{}}
	err := r.Store.InTenant(ctx, tenant, func(tx pgx.Tx) error {
		ds, err := tx.Query(ctx, "SELECT code,name FROM departments WHERE tenant_id=$1 ORDER BY code", tenant)
		if err != nil {
			return err
		}
		c.Departments, err = pgx.CollectRows(ds, pgx.RowToStructByPos[Department])
		if err != nil {
			return err
		}
		qs, err := tx.Query(ctx, "SELECT number,department,strategy,ring_seconds,wait_seconds,coalesce(fallback,'') FROM queues WHERE tenant_id=$1 ORDER BY number", tenant)
		if err != nil {
			return err
		}
		c.Queues, err = pgx.CollectRows(qs, pgx.RowToStructByPos[Queue])
		if err != nil {
			return err
		}
		ms, err := tx.Query(ctx, "SELECT queue,extension,joined,paused FROM queue_members WHERE tenant_id=$1 ORDER BY queue,extension", tenant)
		if err != nil {
			return err
		}
		c.Members, err = pgx.CollectRows(ms, pgx.RowToStructByPos[Member])
		if err != nil {
			return err
		}
		hours, err := tx.Query(ctx, "SELECT department,timezone,days,opens_at,closes_at,coalesce(closed_destination,'') FROM department_schedules WHERE tenant_id=$1 ORDER BY department", tenant)
		if err != nil {
			return err
		}
		c.Schedules, err = pgx.CollectRows(hours, pgx.RowToStructByPos[Schedule])
		return err
	})
	return c, err
}
func (r Repository) mutate(ctx context.Context, a Actor, action, target string, fn func(pgx.Tx) (pgconn.CommandTag, error)) error {
	return r.Store.InTenant(ctx, a.Tenant, func(tx pgx.Tx) error {
		tag, err := fn(tx)
		if err != nil {
			var db *pgconn.PgError
			if errors.As(err, &db) && (db.Code == "23503" || db.Code == "23505") {
				return ErrConflict
			}
			return err
		}
		if tag.RowsAffected() == 0 {
			return ErrNotFound
		}
		_, err = tx.Exec(ctx, "INSERT INTO audit_entries(tenant_id,actor_id,action,target,correlation_id) VALUES($1,$2,$3,$4,$5)", a.Tenant, a.User, action, target, a.Correlation)
		return err
	})
}
func (r Repository) Department(ctx context.Context, a Actor, code, name string, remove bool) error {
	name = strings.TrimSpace(name)
	if !codePattern.MatchString(code) || (!remove && (utf8.RuneCountInString(name) < 1 || utf8.RuneCountInString(name) > 80 || strings.ContainsFunc(name, unicode.IsControl))) {
		return ErrInvalid
	}
	return r.mutate(ctx, a, op("department", remove), code, func(tx pgx.Tx) (pgconn.CommandTag, error) {
		if remove {
			return tx.Exec(ctx, "DELETE FROM departments WHERE tenant_id=$1 AND code=$2", a.Tenant, code)
		}
		return tx.Exec(ctx, "INSERT INTO departments VALUES($1,$2,$3) ON CONFLICT(tenant_id,code) DO UPDATE SET name=excluded.name", a.Tenant, code, name)
	})
}
func op(kind string, remove bool) string {
	if remove {
		return kind + ".remove"
	}
	return kind + ".set"
}
func (r Repository) Queue(ctx context.Context, a Actor, q Queue, remove bool) error {
	if !queuePattern.MatchString(q.Number) || (!remove && (!codePattern.MatchString(q.Department) || !slices.Contains([]string{"ringall", "rrmemory", "fewestcalls"}, q.Strategy) || q.RingSeconds < 3 || q.RingSeconds > 30 || q.WaitSeconds < q.RingSeconds || q.WaitSeconds > 180 || (q.Fallback != "" && !extPattern.MatchString(q.Fallback)))) {
		return ErrInvalid
	}
	return r.mutate(ctx, a, op("queue", remove), q.Number, func(tx pgx.Tx) (pgconn.CommandTag, error) {
		if remove {
			return tx.Exec(ctx, "DELETE FROM queues WHERE tenant_id=$1 AND number=$2", a.Tenant, q.Number)
		}
		return tx.Exec(ctx, `INSERT INTO queues VALUES($1,$2,$3,$4,$5,$6,nullif($7,'')) ON CONFLICT(tenant_id,number) DO UPDATE SET department=excluded.department,strategy=excluded.strategy,ring_seconds=excluded.ring_seconds,wait_seconds=excluded.wait_seconds,fallback=excluded.fallback`, a.Tenant, q.Number, q.Department, q.Strategy, q.RingSeconds, q.WaitSeconds, q.Fallback)
	})
}
func (r Repository) Assignment(ctx context.Context, a Actor, queue, ext string, remove bool) error {
	if !queuePattern.MatchString(queue) || !extPattern.MatchString(ext) {
		return ErrInvalid
	}
	return r.mutate(ctx, a, op("assignment", remove), queue+"/"+ext, func(tx pgx.Tx) (pgconn.CommandTag, error) {
		if remove {
			return tx.Exec(ctx, "DELETE FROM queue_members WHERE tenant_id=$1 AND queue=$2 AND extension=$3", a.Tenant, queue, ext)
		}
		return tx.Exec(ctx, `INSERT INTO queue_members(tenant_id,queue,extension) VALUES($1,$2,$3) ON CONFLICT(tenant_id,queue,extension) DO UPDATE SET extension=excluded.extension`, a.Tenant, queue, ext)
	})
}
func (r Repository) Presence(ctx context.Context, a Actor, m Member) error {
	if !queuePattern.MatchString(m.Queue) || !extPattern.MatchString(m.Extension) || (!m.Joined && m.Paused) {
		return ErrInvalid
	}
	return r.mutate(ctx, a, "presence.set", m.Queue+"/"+m.Extension, func(tx pgx.Tx) (pgconn.CommandTag, error) {
		return tx.Exec(ctx, "UPDATE queue_members SET joined=$4,paused=$5 WHERE tenant_id=$1 AND queue=$2 AND extension=$3", a.Tenant, m.Queue, m.Extension, m.Joined, m.Paused)
	})
}
