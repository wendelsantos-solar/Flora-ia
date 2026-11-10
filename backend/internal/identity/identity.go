package identity

import (
	"crypto/sha256"
	"crypto/subtle"
	"os"
)

const DevelopmentTenant = "11111111-1111-4111-8111-111111111111"

type Principal struct {
	TenantID  string
	UserID    string
	Extension string
	Role      string
}
type credential struct {
	digest    [32]byte
	principal Principal
}
type Authenticator struct{ credentials []credential }

func New() *Authenticator {
	a := &Authenticator{}
	numbers := []string{"201", "202", "OTHER"}
	if os.Getenv("TOKEN_203") != "" {
		numbers = append(numbers, "203")
	}
	for _, n := range Extensions(SecondTenant) {
		if os.Getenv("TOKEN_"+n) != "" {
			numbers = append(numbers, n)
		}
	}
	for _, n := range numbers {
		token := os.Getenv("TOKEN_" + n)
		if len(token) < 32 {
			panic("development bearer tokens must have at least 32 characters")
		}
		p := Principal{TenantID: DevelopmentTenant, UserID: "11111111-1111-4111-8111-111111111" + n, Extension: n, Role: ExtensionRole(n)}
		if OwnsExtension(SecondTenant, n) {
			p.TenantID = SecondTenant
			p.UserID = "33333333-3333-4333-8333-333333333" + n
		}
		if n == "OTHER" {
			p = Principal{TenantID: EmptyTenant, UserID: "22222222-2222-4222-8222-222222222222"}
		}
		digest := sha256.Sum256([]byte(token))
		for _, existing := range a.credentials {
			if existing.digest == digest {
				panic("duplicate bearer credentials")
			}
		}
		a.credentials = append(a.credentials, credential{digest, p})
	}
	return a
}
func (a *Authenticator) Authenticate(token string) (Principal, bool) {
	digest := sha256.Sum256([]byte(token))
	for _, c := range a.credentials {
		if subtle.ConstantTimeCompare(c.digest[:], digest[:]) == 1 {
			return c.principal, true
		}
	}
	return Principal{}, false
}

func (a *Authenticator) User(tenant, user string) (Principal, bool) {
	for _, c := range a.credentials {
		if c.principal.TenantID == tenant && c.principal.UserID == user {
			return c.principal, true
		}
	}
	return Principal{}, false
}

func ExtensionRole(number string) string {
	switch number {
	case "201", "211":
		return "admin"
	case "203", "213":
		return "supervisor"
	case "202", "212":
		return "operator"
	default:
		return ""
	}
}
