package httpapi

import (
	"encoding/json"
	"errors"
	"flora/internal/identity"
	"flora/internal/operations"
	"flora/internal/telephony"
	"io"
	"net/http"
	"slices"
	"time"

	"github.com/go-chi/chi/v5"
)

func (a *API) operationRoutes(r chi.Router) {
	r.Get("/v1/operations", a.operationStatus)
	r.Put("/v1/departments/{code}/supervisors/{extension}", a.configure("supervision"))
	r.Delete("/v1/departments/{code}/supervisors/{extension}", a.configure("supervision"))
	r.Get("/v1/operations/metrics", a.supervision)
	r.Put("/v1/departments/{code}/schedule", a.configure("schedule"))
	r.Delete("/v1/departments/{code}/schedule", a.configure("schedule"))
	r.Put("/v1/departments/{code}", a.configure("department"))
	r.Delete("/v1/departments/{code}", a.configure("department"))
	r.Put("/v1/queues/{number}", a.configure("queue"))
	r.Delete("/v1/queues/{number}", a.configure("queue"))
	r.Put("/v1/queues/{number}/members/{extension}", a.configure("assignment"))
	r.Delete("/v1/queues/{number}/members/{extension}", a.configure("assignment"))
	r.Put("/v1/queues/{number}/presence", a.configure("presence"))
}
func (a *API) operationStatus(w http.ResponseWriter, r *http.Request) {
	p := principal(r)
	c, err := a.Operations.Catalog(r.Context(), p.TenantID)
	if err != nil {
		problem(w, 503, "operations_unavailable")
		return
	}
	snapshot := telephony.QueueSnapshot{Queues: map[string]telephony.LiveQueue{}}
	if q := a.Controllers[p.TenantID]; q != nil {
		snapshot = q.Snapshot(p.TenantID)
	}
	if p.Role == "supervisor" {
		c, snapshot, err = a.supervisorView(r, p, c, snapshot)
		if err != nil {
			problem(w, 503, "operations_unavailable")
			return
		}
	}
	// Operators can inspect their own assignment and its state, not other operators'.
	if p.Role != "admin" && p.Role != "supervisor" {
		own := []operations.Member{}
		for _, m := range c.Members {
			if m.Extension == p.Extension {
				own = append(own, m)
			}
		}
		c.Members = own
		visible := map[string]telephony.LiveQueue{}
		for _, m := range own {
			if queue, ok := snapshot.Queues[m.Queue]; ok {
				members := map[string]telephony.QueueMember{}
				if member, ok := queue.Members[p.Extension]; ok {
					members[p.Extension] = member
				}
				visible[m.Queue] = telephony.LiveQueue{Waiting: queue.Waiting, Members: members}
			}
		}
		snapshot.Queues = visible
		snapshot.Connected = nil
		snapshot.Calls = nil
	}
	write(w, 200, map[string]any{"catalog": c, "engine": snapshot, "role": p.Role})
}
func decodeOperation(w http.ResponseWriter, r *http.Request, target any) bool {
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048))
	d.DisallowUnknownFields()
	return d.Decode(target) == nil && errors.Is(d.Decode(new(any)), io.EOF)
}
func (a *API) configure(kind string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		p := principal(r)
		if r.Header.Get("Origin") != a.Origin {
			problem(w, 403, "origin_denied")
			return
		}
		if len(identity.Extensions(p.TenantID)) == 0 || (kind != "presence" && p.Role != "admin") || p.Extension == "" {
			problem(w, 403, "operation_forbidden")
			return
		}
		if a.limited("configure:"+p.UserID, 60) {
			problem(w, 429, "rate_limited")
			return
		}
		actor := operations.Actor{Tenant: p.TenantID, User: p.UserID, Correlation: w.Header().Get("X-Correlation-ID")}
		remove := r.Method == "DELETE"
		queue := chi.URLParam(r, "number")
		var err error
		switch kind {
		case "department":
			var body struct {
				Name string `json:"name"`
			}
			if !remove && !decodeOperation(w, r, &body) {
				problem(w, 400, "invalid_body")
				return
			}
			err = a.Operations.Department(r.Context(), actor, chi.URLParam(r, "code"), body.Name, remove)
		case "supervision":
			err = a.Operations.Supervisor(r.Context(), actor, chi.URLParam(r, "code"), chi.URLParam(r, "extension"), remove)
		case "schedule":
			var s operations.Schedule
			if !remove && (!decodeOperation(w, r, &s) || s.Department != "") {
				problem(w, 400, "invalid_body")
				return
			}
			s.Department = chi.URLParam(r, "code")
			err = a.Operations.Schedule(r.Context(), actor, s, remove)
		case "queue":
			var q operations.Queue
			if !remove && (!decodeOperation(w, r, &q) || q.Number != "") {
				problem(w, 400, "invalid_body")
				return
			}
			q.Number = queue
			err = a.Operations.Queue(r.Context(), actor, q, remove)
		case "assignment":
			err = a.Operations.Assignment(r.Context(), actor, queue, chi.URLParam(r, "extension"), remove)
		case "presence":
			var body struct {
				Joined *bool `json:"joined"`
				Paused *bool `json:"paused"`
			}
			if !decodeOperation(w, r, &body) || body.Joined == nil || body.Paused == nil {
				problem(w, 400, "invalid_body")
				return
			}
			err = a.Operations.Presence(r.Context(), actor, operations.Member{Queue: queue, Extension: p.Extension, Joined: *body.Joined, Paused: *body.Paused})
		}
		switch {
		case errors.Is(err, operations.ErrInvalid):
			problem(w, 400, "invalid_configuration")
		case errors.Is(err, operations.ErrConflict):
			problem(w, 409, "configuration_conflict")
		case errors.Is(err, operations.ErrNotFound):
			problem(w, 404, "configuration_not_found")
		case err != nil:
			problem(w, 503, "operations_unavailable")
		case kind == "department":
			w.WriteHeader(204)
		default:
			write(w, 202, map[string]string{"status": "desired_state_saved", "verification": "/v1/operations"})
		}
	}
}

func (a *API) supervision(w http.ResponseWriter, r *http.Request) {
	p := principal(r)
	if p.Role != "admin" && p.Role != "supervisor" {
		problem(w, 403, "operation_forbidden")
		return
	}
	since := time.Now().UTC().Add(-24 * time.Hour)
	var departments []string
	if p.Role == "supervisor" {
		var err error
		departments, err = a.Operations.Supervised(r.Context(), p.TenantID, p.UserID)
		if err != nil {
			problem(w, 503, "operations_unavailable")
			return
		}
	}
	totals, err := a.Store.QueueTotalsScoped(r.Context(), p.TenantID, since, departments)
	if err != nil {
		problem(w, 503, "operations_unavailable")
		return
	}
	snapshot := telephony.QueueSnapshot{}
	if q := a.Controllers[p.TenantID]; q != nil {
		snapshot = q.Snapshot(p.TenantID)
	}
	if p.Role == "supervisor" {
		c, err := a.Operations.Catalog(r.Context(), p.TenantID)
		if err != nil {
			problem(w, 503, "operations_unavailable")
			return
		}
		_, snapshot = filterSupervisor(c, snapshot, departments)
	}
	write(w, 200, map[string]any{"since": since, "totals": totals, "journal_healthy": a.engineStatus(p.TenantID).QueueJournalHealthy, "live": snapshot})
}

func (a *API) engineStatus(tenant string) telephony.Status {
	if e := a.Engines[tenant]; e != nil {
		return e.Status()
	}
	return telephony.Status{}
}

func (a *API) supervisorView(r *http.Request, p identity.Principal, c operations.Catalog, live telephony.QueueSnapshot) (operations.Catalog, telephony.QueueSnapshot, error) {
	deps, err := a.Operations.Supervised(r.Context(), p.TenantID, p.UserID)
	if err != nil {
		return operations.Catalog{}, telephony.QueueSnapshot{}, err
	}
	c, live = filterSupervisor(c, live, deps)
	return c, live, nil
}
func filterSupervisor(c operations.Catalog, live telephony.QueueSnapshot, deps []string) (operations.Catalog, telephony.QueueSnapshot) {
	qset := map[string]bool{}
	extensions := map[string]bool{}
	result := operations.Catalog{Departments: []operations.Department{}, Queues: []operations.Queue{}, Members: []operations.Member{}, Schedules: []operations.Schedule{}}
	for _, d := range c.Departments {
		if slices.Contains(deps, d.Code) {
			result.Departments = append(result.Departments, d)
		}
	}
	for _, q := range c.Queues {
		if slices.Contains(deps, q.Department) {
			result.Queues = append(result.Queues, q)
			qset[q.Number] = true
		}
	}
	for _, m := range c.Members {
		if qset[m.Queue] {
			result.Members = append(result.Members, m)
			extensions[m.Extension] = true
		}
	}
	for _, s := range c.Schedules {
		if slices.Contains(deps, s.Department) {
			result.Schedules = append(result.Schedules, s)
		}
	}
	queues := map[string]telephony.LiveQueue{}
	for n, q := range live.Queues {
		if qset[n] {
			queues[n] = q
		}
	}
	calls := []telephony.ActiveCall{}
	for _, c := range live.Calls {
		if qset[c.Destination] {
			calls = append(calls, c)
		}
	}
	connected := []string{}
	for _, n := range live.Connected {
		if extensions[n] {
			connected = append(connected, n)
		}
	}
	live.Queues = queues
	live.Calls = calls
	live.Connected = connected
	return result, live
}
