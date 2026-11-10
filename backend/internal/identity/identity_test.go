package identity

import (
	"strings"
	"testing"
)

func TestDevelopmentIdentityBoundary(t *testing.T) {
	for _, n := range []string{"201", "202", "OTHER"} {
		t.Setenv("TOKEN_"+n, strings.Repeat(n, 32))
	}
	a := New()
	p, ok := a.Authenticate(strings.Repeat("201", 32))
	if !ok || p.Extension != "201" || p.TenantID != DevelopmentTenant {
		t.Fatal("wrong identity")
	}
	other, ok := a.Authenticate(strings.Repeat("OTHER", 32))
	if !ok || other.TenantID == p.TenantID {
		t.Fatal("tenant collision")
	}
	for _, token := range []string{"", strings.Repeat("201", 31), "invalid"} {
		if _, ok := a.Authenticate(token); ok {
			t.Fatal("invalid token accepted")
		}
	}
}
