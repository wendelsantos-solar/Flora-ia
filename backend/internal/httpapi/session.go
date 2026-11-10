package httpapi

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"flora/internal/identity"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

func sessionKey(value string) (string, []byte, bool) {
	tenant, secret, ok := strings.Cut(value, ".")
	if !ok || !uuid.MatchString(tenant) || len(secret) != 64 {
		return "", nil, false
	}
	if _, err := hex.DecodeString(secret); err != nil {
		return "", nil, false
	}
	sum := sha256.Sum256([]byte(value))
	return tenant, sum[:], true
}

func (a *API) cookieIdentity(ctx context.Context, value string) (identity.Principal, error) {
	tenant, key, ok := sessionKey(value)
	if !ok || a.Store == nil {
		return identity.Principal{}, pgx.ErrNoRows
	}
	var user string
	err := a.Store.InTenant(ctx, tenant, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `SELECT user_id::text FROM browser_sessions WHERE tenant_id=$1 AND digest=$2 AND expires_at>now()`, tenant, key).Scan(&user)
	})
	if err != nil {
		return identity.Principal{}, err
	}
	p, ok := a.Auth.User(tenant, user)
	if !ok {
		return identity.Principal{}, pgx.ErrNoRows
	}
	return p, nil
}
func (a *API) saveSession(ctx context.Context, p identity.Principal, previous string) (string, error) {
	random := make([]byte, 32)
	if _, err := rand.Read(random); err != nil {
		return "", err
	}
	value := p.TenantID + "." + hex.EncodeToString(random)
	_, key, _ := sessionKey(value)
	oldTenant, oldKey, ok := sessionKey(previous)
	if ok && oldTenant != p.TenantID {
		if err := a.revoke(ctx, previous); err != nil {
			return "", err
		}
	}
	err := a.Store.InTenant(ctx, p.TenantID, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, "DELETE FROM browser_sessions WHERE tenant_id=$1 AND (expires_at<=now() OR digest=$2)", p.TenantID, oldKey); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, "INSERT INTO browser_sessions VALUES($1,$2,$3,now()+interval '8 hours')", p.TenantID, key, p.UserID)
		return err
	})
	return value, err
}
func (a *API) revoke(ctx context.Context, value string) error {
	tenant, key, ok := sessionKey(value)
	if !ok {
		return nil
	}
	return a.Store.InTenant(ctx, tenant, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, "DELETE FROM browser_sessions WHERE tenant_id=$1 AND digest=$2", tenant, key)
		return err
	})
}
func (a *API) logout(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("Origin") != a.Origin {
		problem(w, 403, "origin_denied")
		return
	}
	if cookie, err := r.Cookie("flora_session"); err == nil {
		if err = a.revoke(r.Context(), cookie.Value); err != nil {
			problem(w, 503, "session_unavailable")
			return
		}
	}
	http.SetCookie(w, &http.Cookie{Name: "flora_session", Path: "/", HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: -1, Secure: strings.HasPrefix(a.Origin, "https://")})
	w.WriteHeader(204)
}
func (a *API) requestIdentity(r *http.Request) (identity.Principal, error) {
	if h := r.Header.Get("Authorization"); h != "" {
		if token, ok := strings.CutPrefix(h, "Bearer "); ok {
			if p, ok := a.Auth.Authenticate(token); ok {
				return p, nil
			}
		}
		return identity.Principal{}, pgx.ErrNoRows
	}
	if c, err := r.Cookie("flora_session"); err == nil {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		return a.cookieIdentity(ctx, c.Value)
	}
	return identity.Principal{}, pgx.ErrNoRows
}
func (a *API) socketAllowed(key string) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.sockets[key] >= 2 {
		return false
	}
	a.sockets[key]++
	return true
}
func (a *API) socketDone(key string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.sockets[key]--
	if a.sockets[key] <= 0 {
		delete(a.sockets, key)
	}
}
func unauthorized(err error) bool { return errors.Is(err, pgx.ErrNoRows) }
