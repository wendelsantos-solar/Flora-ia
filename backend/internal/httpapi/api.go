package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flora/internal/identity"
	"flora/internal/operations"
	"flora/internal/realtime"
	"flora/internal/siptrunk"
	"flora/internal/store"
	"flora/internal/telephony"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5"
	"log/slog"
	"net"
	"net/http"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"
)

type principalKey struct{}
type bucket struct {
	start time.Time
	count int
}
type API struct {
	Store       *store.Store
	SIPLab      *siptrunk.Repository
	SIPLabKeys  map[string]string
	Auth        *identity.Authenticator
	Telephony   telephony.Observer
	Origin      string
	Operations  operations.Repository
	Controllers map[string]*telephony.Queues
	Engines     map[string]telephony.Observer
	mu          sync.Mutex
	buckets     map[string]bucket
	sockets     map[string]int
}

var historyDepartment = regexp.MustCompile("^[a-z][a-z0-9-]{0,31}$")
var historyAgent = regexp.MustCompile("^[0-9]{3}$")
var uuid = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

func write(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
func problem(w http.ResponseWriter, status int, code string) {
	write(w, status, map[string]any{"error": map[string]string{"code": code, "message": http.StatusText(status), "correlation_id": w.Header().Get("X-Correlation-ID")}})
}
func (a *API) Handler() http.Handler {
	a.buckets = map[string]bucket{}
	a.sockets = map[string]int{}
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(middleware.Throttle(64))
	r.Use(a.headers)
	r.Get("/health/live", func(w http.ResponseWriter, r *http.Request) { write(w, 200, map[string]string{"status": "live"}) })
	r.Get("/health/ready", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		st := a.Telephony.Status()
		ready := st.Connected && st.JournalHealthy
		for _, engine := range a.Engines {
			current := engine.Status()
			ready = ready && current.Connected && current.JournalHealthy && current.QueueJournalHealthy
		}
		if a.Store.Pool.Ping(ctx) != nil || !ready {
			problem(w, 503, "not_ready")
			return
		}
		write(w, 200, map[string]string{"status": "ready"})
	})
	r.Post("/v1/session", a.session)
	r.Post("/internal/sip-lab/reserve", a.sipLabPBX)
	r.Post("/internal/sip-lab/finish", a.sipLabPBX)
	r.Group(func(r chi.Router) {
		r.Use(a.authenticated)
		a.operationRoutes(r)
		r.Get("/v1/sip-lab", a.sipLabAdmin)
		r.Put("/v1/sip-lab", a.sipLabAdmin)
		r.Delete("/v1/session", a.logout)
		r.Get("/v1/me", func(w http.ResponseWriter, r *http.Request) {
			p := principal(r)
			write(w, 200, map[string]string{"tenant_id": p.TenantID, "user_id": p.UserID, "extension": p.Extension, "role": p.Role})
		})
		r.Get("/v1/metrics", func(w http.ResponseWriter, r *http.Request) {
			if principal(r).Role != "admin" {
				problem(w, 403, "operation_forbidden")
				return
			}
			metrics, err := a.Store.Metrics(r.Context(), principal(r).TenantID)
			if err != nil {
				problem(w, 503, "database_unavailable")
				return
			}
			write(w, 200, metrics)
		})
		r.Get("/v1/extensions", a.extensions)
		r.Get("/v1/extensions/{id}", a.extensions)
		r.Get("/v1/calls", a.calls)
		r.Get("/v1/calls/{id}", a.call)
		r.Get("/v1/telephony/status", func(w http.ResponseWriter, r *http.Request) { write(w, 200, a.engineStatus(principal(r).TenantID)) })
		r.Get("/v1/events/cursor", func(w http.ResponseWriter, r *http.Request) {
			sequence, err := a.Store.EventCursor(r.Context(), principal(r).TenantID)
			if err != nil {
				problem(w, 503, "event_store_unavailable")
				return
			}
			write(w, 200, map[string]int64{"sequence": sequence})
		})
		r.Get("/v1/events", func(w http.ResponseWriter, r *http.Request) {
			p := principal(r)
			key := p.TenantID + p.UserID
			if !a.socketAllowed(key) {
				problem(w, 429, "socket_limit")
				return
			}
			defer a.socketDone(key)
			realtime.Serve(w, r, a.Store, scope(p), a.Origin, func() bool {
				current, err := a.requestIdentity(r)
				return err == nil && current == p
			})
		})
	})
	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) { problem(w, 405, "method_not_allowed") })
	r.NotFound(func(w http.ResponseWriter, r *http.Request) { problem(w, 404, "not_found") })
	return r
}
func (a *API) headers(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b := make([]byte, 12)
		rand.Read(b)
		id := hex.EncodeToString(b)
		w.Header().Set("X-Correlation-ID", id)
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		started := time.Now()
		next.ServeHTTP(w, r)
		slog.Info("http_request", "method", r.Method, "route", chi.RouteContext(r.Context()).RoutePattern(), "correlation_id", id, "duration_ms", time.Since(started).Milliseconds())
	})
}
func (a *API) limited(key string, max int) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	b := a.buckets[key]
	now := time.Now()
	if len(a.buckets) >= 2048 {
		for k, v := range a.buckets {
			if now.Sub(v.start) > time.Minute {
				delete(a.buckets, k)
			}
		}
		if len(a.buckets) >= 2048 && b.start.IsZero() {
			return true
		}
	}
	if now.Sub(b.start) > time.Minute {
		b = bucket{start: now}
	}
	b.count++
	a.buckets[key] = b
	return b.count > max
}
func principal(r *http.Request) identity.Principal {
	return r.Context().Value(principalKey{}).(identity.Principal)
}
func (a *API) authenticated(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p, err := a.requestIdentity(r)
		if err != nil {
			if unauthorized(err) {
				problem(w, 401, "unauthorized")
			} else {
				problem(w, 503, "session_unavailable")
			}
			return
		}
		if a.limited(p.TenantID+p.UserID, 300) {
			problem(w, 429, "rate_limited")
			return
		}
		ctx := context.WithValue(r.Context(), principalKey{}, p)
		if !strings.HasSuffix(r.URL.Path, "/events") {
			var cancel context.CancelFunc
			ctx, cancel = context.WithTimeout(ctx, 5*time.Second)
			defer cancel()
		}
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
func (a *API) session(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("Origin") != a.Origin {
		problem(w, 403, "origin_denied")
		return
	}
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	if a.limited("login:"+host, 20) {
		problem(w, 429, "rate_limited")
		return
	}
	var body struct {
		Token string `json:"token"`
	}
	if !decodeOperation(w, r, &body) {
		problem(w, 400, "invalid_body")
		return
	}
	p, ok := a.Auth.Authenticate(body.Token)
	if !ok || a.limited("token:"+p.UserID, 30) {
		problem(w, 401, "unauthorized")
		return
	}
	if p.Role == "" && p.TenantID != identity.EmptyTenant {
		problem(w, 401, "unauthorized")
		return
	}
	old := ""
	if cookie, err := r.Cookie("flora_session"); err == nil {
		old = cookie.Value
	}
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	value, err := a.saveSession(ctx, p, old)
	if err != nil {
		problem(w, 503, "session_unavailable")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "flora_session", Value: value, Path: "/", HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: 8 * 60 * 60, Secure: strings.HasPrefix(a.Origin, "https://")})
	w.WriteHeader(204)
}
func (a *API) extensions(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id != "" && !uuid.MatchString(id) {
		problem(w, 400, "invalid_id")
		return
	}
	items, err := a.Store.Extensions(r.Context(), principal(r).TenantID)
	if err != nil {
		problem(w, 503, "database_unavailable")
		return
	}
	if id != "" {
		for _, item := range items {
			if item.ID == id {
				write(w, 200, item)
				return
			}
		}
		problem(w, 404, "not_found")
		return
	}
	write(w, 200, map[string]any{"items": items})
}
func (a *API) calls(w http.ResponseWriter, r *http.Request) {
	limit, offset := 50, 0
	var err error
	if value := r.URL.Query().Get("limit"); value != "" {
		limit, err = strconv.Atoi(value)
		if err != nil || limit < 1 || limit > 100 {
			problem(w, 400, "invalid_limit")
			return
		}
	}
	if value := r.URL.Query().Get("offset"); value != "" {
		offset, err = strconv.Atoi(value)
		if err != nil || offset < 0 || offset > 100000 {
			problem(w, 400, "invalid_offset")
			return
		}
	}
	values := r.URL.Query()
	filter := store.HistoryFilter{Viewer: scope(principal(r)), Department: values.Get("department"), Agent: values.Get("agent"), Outcome: values.Get("outcome")}
	for key, target := range map[string]**time.Time{"from": &filter.From, "to": &filter.To} {
		if raw := values.Get(key); raw != "" {
			t, parse := time.Parse(time.RFC3339, raw)
			if parse != nil {
				problem(w, 400, "invalid_period")
				return
			}
			*target = &t
		}
	}
	if (filter.From != nil && filter.To != nil && !filter.From.Before(*filter.To)) ||
		(filter.Department != "" && !historyDepartment.MatchString(filter.Department)) ||
		(filter.Agent != "" && !historyAgent.MatchString(filter.Agent)) ||
		(filter.Outcome != "" && !slices.Contains([]string{"answered", "abandoned", "timeout", "closed", "unavailable", "busy", "rejected", "failed", "not_answered", "created", "ringing", "interrupted"}, filter.Outcome)) {
		problem(w, 400, "invalid_filter")
		return
	}
	items, err := a.Store.History(r.Context(), principal(r).TenantID, filter, limit, offset)
	if err != nil {
		problem(w, 503, "database_unavailable")
		return
	}
	write(w, 200, map[string]any{"items": items, "limit": limit, "offset": offset})
}
func (a *API) call(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !uuid.MatchString(id) {
		problem(w, 400, "invalid_id")
		return
	}
	c, legs, err := a.Store.CallScoped(r.Context(), principal(r).TenantID, id, scope(principal(r)))
	if errors.Is(err, pgx.ErrNoRows) {
		problem(w, 404, "not_found")
		return
	}
	if err != nil {
		problem(w, 503, "database_unavailable")
		return
	}
	events, err := a.Store.CallEvents(r.Context(), principal(r).TenantID, id)
	if err != nil {
		problem(w, 503, "database_unavailable")
		return
	}
	queueEvents, err := a.Store.QueueTimeline(r.Context(), principal(r).TenantID, id)
	if err != nil {
		problem(w, 503, "database_unavailable")
		return
	}
	write(w, 200, map[string]any{"call": c, "legs": legs, "events": events, "queue_events": queueEvents})
}

func scope(p identity.Principal) identity.Principal {
	if p.Role == "" {
		p.Role = "none"
	}
	return p
}
