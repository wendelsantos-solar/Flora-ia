package integration

import (
	"context"
	"flora/internal/identity"
	"flora/internal/store"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"testing"
	"time"
)

func TestPersistenceTenantIdempotencyOrderingAndRecovery(t *testing.T) {
	url := os.Getenv("DATABASE_URL_TEST")
	if url == "" {
		t.Skip("requires disposable DATABASE_URL_TEST; run scripts/test-integration.sh")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	s := &store.Store{Pool: pool}
	tenant := identity.DevelopmentTenant
	event := store.JournalEvent{Key: "unit-integration-start", Tenant: tenant, Kind: "CHAN_START", Source: "201", Destination: "202", UniqueID: "integration.1", LinkedID: "integration.1", Channel: "PJSIP/201-integration", At: time.Now().UTC().Add(-time.Minute)}
	for i := 0; i < 2; i++ {
		if err = s.Apply(ctx, event); err != nil {
			t.Fatal(err)
		}
	}
	events, err := s.Events(ctx, tenant, 0)
	if err != nil || len(events) != 1 {
		t.Fatalf("deduplication: %v %v", events, err)
	}
	end := event
	end.Key = "integration-end"
	end.Kind = "LINKEDID_END"
	end.At = event.At.Add(10 * time.Second)
	if err = s.Apply(ctx, end); err != nil {
		t.Fatal(err)
	}
	answer := event
	answer.Key = "integration-answer"
	answer.Kind = "ANSWER"
	answer.At = event.At.Add(time.Second)
	if err = s.Apply(ctx, answer); err != nil {
		t.Fatal(err)
	}
	list, err := s.Calls(ctx, tenant, 50, 0)
	if err != nil || len(list) != 1 || list[0].State != "completed" || list[0].AnsweredAt == nil {
		t.Fatalf("out of order terminal state: %v %v", list, err)
	}
	from, to := event.At.Add(-time.Second), event.At.Add(time.Second)
	filter := store.HistoryFilter{From: &from, To: &to, Agent: "202", Outcome: "answered"}
	history, err := s.History(ctx, tenant, filter, 1, 0)
	if err != nil || len(history) != 1 || history[0].Outcome != "answered" {
		t.Fatalf("history filters: %v %v", history, err)
	}
	history, err = s.History(ctx, tenant, filter, 1, 1)
	if err != nil || len(history) != 0 {
		t.Fatalf("history offset: %v %v", history, err)
	}
	filter.Agent = "203"
	history, err = s.History(ctx, tenant, filter, 1, 0)
	if err != nil || len(history) != 0 {
		t.Fatalf("history agent filter: %v %v", history, err)
	}
	other := "22222222-2222-4222-8222-222222222222"
	list, err = s.Calls(ctx, other, 50, 0)
	if err != nil || len(list) != 0 {
		t.Fatal("tenant calls leaked")
	}
	events, err = s.Events(ctx, other, 0)
	if err != nil || len(events) != 0 {
		t.Fatal("tenant events leaked")
	}
	if err = s.InTenant(ctx, other, func(tx pgx.Tx) error {
		var count int
		if err := tx.QueryRow(ctx, "SELECT count(*) FROM call_sessions").Scan(&count); err != nil {
			return err
		}
		if count != 0 {
			t.Fatal("RLS bypass without tenant predicate")
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	event.LinkedID = "integration.2"
	event.UniqueID = "integration.2"
	event.Key = "integration-orphan"
	if err = s.Apply(ctx, event); err != nil {
		t.Fatal(err)
	}
	if err = s.Reconcile(ctx, tenant, []string{}); err != nil {
		t.Fatal(err)
	}
	if err = s.Reconcile(ctx, tenant, []string{}); err != nil {
		t.Fatal(err)
	}
	list, err = s.Calls(ctx, tenant, 50, 0)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, c := range list {
		if c.AsteriskLinkedID == "integration.2" {
			found = c.State == "interrupted"
		}
	}
	if !found {
		t.Fatal("orphan call not reconciled")
	}
	// New connection pool represents a restarted process; replay must keep exactly one copy.
	second, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer second.Close()
	fresh := &store.Store{Pool: second}
	if err = fresh.Apply(ctx, event); err != nil {
		t.Fatal(err)
	}
	events, err = fresh.Events(ctx, tenant, 0)
	if err != nil || len(events) != 5 {
		t.Fatalf("restart replay changed event count: %d %v", len(events), err)
	}
}
