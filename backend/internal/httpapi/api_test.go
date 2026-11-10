package httpapi

import (
	"flora/internal/identity"
	"flora/internal/telephony"
	"net/http/httptest"
	"strings"
	"testing"
)

// Unit-only double: no claim of real Asterisk connectivity.
type mockObserver struct{}

func (mockObserver) Status() telephony.Status { return telephony.Status{} }
func TestAuthenticationAndValidation(t *testing.T) {
	for _, n := range []string{"201", "202", "OTHER"} {
		t.Setenv("TOKEN_"+n, strings.Repeat(n, 32))
	}
	a := &API{Auth: identity.New(), Telephony: mockObserver{}, Origin: "http://localhost:13400"}
	h := a.Handler()
	cases := []struct {
		path, token string
		status      int
	}{{"/health/live", "", 200}, {"/v1/extensions", "", 401}, {"/v1/calls", "invalid", 401}, {"/v1/calls?limit=101", strings.Repeat("201", 32), 400}, {"/v1/calls?offset=-1", strings.Repeat("201", 32), 400}, {"/v1/extensions/invalid", strings.Repeat("201", 32), 400}, {"/v1/calls/invalid", strings.Repeat("201", 32), 400}}
	cases = append(cases,
		struct {
			path, token string
			status      int
		}{"/v1/calls?from=invalid", strings.Repeat("201", 32), 400},
		struct {
			path, token string
			status      int
		}{"/v1/calls?outcome=invalid", strings.Repeat("201", 32), 400},
	)
	for _, c := range cases {
		r := httptest.NewRequest("GET", c.path, nil)
		if c.token != "" {
			r.Header.Set("Authorization", "Bearer "+c.token)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != c.status {
			t.Errorf("%s: got %d want %d", c.path, w.Code, c.status)
		}
		if w.Header().Get("X-Correlation-ID") == "" {
			t.Fatal("missing correlation")
		}
		if strings.Contains(w.Body.String(), strings.Repeat("201", 32)) {
			t.Fatal("secret leaked")
		}
	}
	r := httptest.NewRequest("POST", "/v1/session", strings.NewReader(`{"token":"invalid"}`))
	r.Header.Set("Origin", "https://evil.example")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatal("cross-origin login accepted")
	}
}
