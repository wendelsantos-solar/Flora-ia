package integration

import (
	"context"
	"errors"
	"flora/internal/identity"
	"flora/internal/operations"
	"flora/internal/store"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestCatalogQueueJournalAndTenantBoundaries(t *testing.T) {
	url := os.Getenv("DATABASE_URL_TEST")
	if url == "" {
		t.Skip("requires disposable PostgreSQL")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	s := &store.Store{Pool: pool}
	repo := operations.Repository{Store: s}
	other := "22222222-2222-4222-8222-222222222222"
	actor := operations.Actor{Tenant: identity.DevelopmentTenant, User: "11111111-1111-4111-8111-111111111201", Correlation: "integration-correlation"}
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	must(repo.Department(ctx, actor, "integration", "Recepção integrada", false))
	must(repo.Department(ctx, actor, "integration", "Recepção alterada", false))
	queue := operations.Queue{Number: "380", Department: "integration", Strategy: "rrmemory", RingSeconds: 5, WaitSeconds: 20, Fallback: "201"}
	must(repo.Queue(ctx, actor, queue, false))
	must(repo.Queue(ctx, actor, queue, false))
	must(repo.Assignment(ctx, actor, "380", "202", false))
	must(repo.Presence(ctx, actor, operations.Member{Queue: "380", Extension: "202", Joined: true, Paused: true}))
	must(repo.Schedule(ctx, actor, operations.Schedule{Department: "integration", Timezone: "America/Sao_Paulo", Days: []int{1, 5}, OpensAt: "08:00", ClosesAt: "18:00", ClosedDestination: "201"}, false))
	catalog, err := repo.Catalog(ctx, actor.Tenant)
	must(err)
	if len(catalog.Queues) != 1 || len(catalog.Members) != 1 || !catalog.Members[0].Paused || len(catalog.Schedules) != 1 {
		t.Fatalf("unexpected catalog: %+v", catalog)
	}
	tenant, err := repo.Catalog(ctx, other)
	must(err)
	if len(tenant.Departments)+len(tenant.Queues)+len(tenant.Members)+len(tenant.Schedules) != 0 {
		t.Fatal("catalog leaked")
	}
	bad := actor
	bad.Tenant = other
	if err = repo.Assignment(ctx, bad, "380", "202", false); !errors.Is(err, operations.ErrConflict) {
		t.Fatalf("cross-tenant assignment: %v", err)
	}
	must(s.InTenant(ctx, other, func(tx pgx.Tx) error {
		for _, table := range []string{"departments", "queues", "queue_members", "department_schedules", "audit_entries"} {
			var count int
			if err := tx.QueryRow(ctx, "SELECT count(*) FROM "+table).Scan(&count); err != nil {
				return err
			}
			if count != 0 {
				t.Fatalf("RLS failed for %s", table)
			}
		}
		return nil
	}))
	now := time.Now().UTC()
	wait := 8
	events := []store.QueueEvent{
		{Key: "operation-test-connect", Queue: "380", UniqueID: "test.380", Kind: "CONNECT", Agent: "202", At: now, WaitSeconds: &wait},
		{Key: "operation-test-enter", Queue: "380", UniqueID: "test.380", Kind: "ENTERQUEUE", At: now.Add(-8 * time.Second)},
		{Key: "operation-test-abandon", Queue: "380", UniqueID: "test.381", Kind: "ABANDON", At: now, WaitSeconds: &wait},
	}
	must(s.RecordQueueEvents(ctx, actor.Tenant, events))
	must(s.RecordQueueEvents(ctx, actor.Tenant, events))
	totals, err := s.QueueTotals(ctx, actor.Tenant, now.Add(-time.Hour))
	must(err)
	if totals.Answered != 1 || totals.Abandoned != 1 || totals.AverageWaitSeconds == nil || *totals.AverageWaitSeconds != 8 {
		t.Fatalf("incorrect totals: %+v", totals)
	}
	totals, err = s.QueueTotals(ctx, other, now.Add(-time.Hour))
	must(err)
	if totals.Answered != 0 || totals.Abandoned != 0 || totals.AverageWaitSeconds != nil {
		t.Fatal("queue activity leaked")
	}
	if err = repo.Department(ctx, actor, "integration", "", true); !errors.Is(err, operations.ErrConflict) {
		t.Fatalf("department should be referenced: %v", err)
	}
	must(repo.Assignment(ctx, actor, "380", "202", true))
	must(repo.Queue(ctx, actor, queue, true))
	must(repo.Department(ctx, actor, "integration", "", true))
	catalog, err = repo.Catalog(ctx, actor.Tenant)
	must(err)
	if len(catalog.Queues)+len(catalog.Members)+len(catalog.Schedules) != 0 {
		t.Fatal("catalog deletion did not converge")
	}
	totals, err = s.QueueTotals(ctx, actor.Tenant, now.Add(-time.Hour))
	must(err)
	if totals.Answered != 1 || totals.Abandoned != 1 {
		t.Fatal("catalog deletion erased telephony history")
	}
}
