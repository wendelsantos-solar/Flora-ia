package httpapi

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"errors"
	"net/http"
	"strings"
	"time"

	"flora/internal/identity"
	"flora/internal/siptrunk"
)

func (a *API) sipLabAdmin(w http.ResponseWriter, r *http.Request) {
	p := principal(r)
	if p.Role != "admin" || len(identity.Extensions(p.TenantID)) == 0 {
		problem(w, 403, "operation_forbidden")
		return
	}
	if a.SIPLab == nil || a.SIPLabKeys[p.TenantID] == "" {
		problem(w, 404, "sip_lab_unavailable")
		return
	}
	if r.Method == http.MethodPut {
		if r.Header.Get("Origin") != a.Origin {
			problem(w, 403, "origin_denied")
			return
		}
		var policy siptrunk.Policy
		if !decodeOperation(w, r, &policy) {
			problem(w, 400, "invalid_body")
			return
		}
		switch err := a.SIPLab.Save(r.Context(), p, w.Header().Get("X-Correlation-ID"), policy); {
		case errors.Is(err, siptrunk.ErrInvalid):
			problem(w, 400, "invalid_sip_policy")
		case err != nil:
			problem(w, 503, "sip_lab_unavailable")
		default:
			w.WriteHeader(204)
		}
		return
	}
	policy, usage, err := a.SIPLab.Status(r.Context(), p.TenantID)
	if err != nil {
		problem(w, 503, "sip_lab_unavailable")
		return
	}
	write(w, 200, map[string]any{"policy": policy, "usage": usage, "trunk": map[string]string{"id": "simulator", "transport": "udp", "authentication": "digest", "operational_state": "not_monitored", "inbound_did": policy.InboundDID}})
}

func (a *API) sipLabPBX(w http.ResponseWriter, r *http.Request) {
	if a.SIPLab == nil {
		problem(w, 404, "sip_lab_unavailable")
		return
	}
	credential := sha256.Sum256([]byte(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")))
	tenant := ""
	for id, key := range a.SIPLabKeys {
		expected := sha256.Sum256([]byte(key))
		if len(key) >= 48 && subtle.ConstantTimeCompare(credential[:], expected[:]) == 1 {
			tenant = id
		}
	}
	if tenant == "" {
		problem(w, 401, "unauthorized")
		return
	}
	var body siptrunk.Attempt
	if !decodeOperation(w, r, &body) {
		problem(w, 400, "invalid_body")
		return
	}
	if r.URL.Path == "/internal/sip-lab/finish" {
		if err := a.SIPLab.Finish(r.Context(), tenant, body); err != nil {
			problem(w, 503, "sip_lab_unavailable")
			return
		}
		w.WriteHeader(204)
		return
	}
	if a.limited("sip-lab-reserve:"+tenant, 240) {
		problem(w, 429, "rate_limited")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 1500*time.Millisecond)
	defer cancel()
	d, err := a.SIPLab.Reserve(ctx, tenant, body)
	if err != nil {
		problem(w, 503, "sip_lab_unavailable")
		return
	}
	write(w, 200, d)
}
