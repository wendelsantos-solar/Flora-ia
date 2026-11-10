package integration

import (
	"context"
	"os"
	"testing"
	"time"

	"flora/internal/identity"
	"flora/internal/siptrunk"
	"flora/internal/store"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestTerminalRecoveryWithoutInitialEvent(t *testing.T) {
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
	s := &store.Store{Pool: pool, ReconcileSIPLab: true}
	repo := siptrunk.Repository{Store: s}
	at := time.Now().UTC().Add(-time.Minute)
	tenants := []string{identity.DevelopmentTenant, identity.SecondTenant}
	for _, tenant := range tenants {
		if err := s.InTenant(ctx, tenant, func(tx pgx.Tx) error {
			_, err := tx.Exec(ctx, `INSERT INTO sip_lab_calls(tenant_id,call_id,direction,origin,destination,category,decision,created_at,expires_at)
			  VALUES($1,'reconcile.1','out','','8800000001','simulator','allowed',$2,$3)`, tenant, at.Add(-time.Second), at.Add(time.Hour))
			return err
		}); err != nil {
			t.Fatal(err)
		}
	}

	event := store.JournalEvent{Key: "reconcile-terminal", Tenant: tenants[0], Kind: "LINKEDID_END", UniqueID: "other-leg", LinkedID: "reconcile.1", At: at}
	for i := 0; i < 2; i++ {
		if err := s.Apply(ctx, event); err != nil {
			t.Fatal(err)
		}
	}

	verify := func(tenant, expectedResult string, expectedTalk, expectedEvents int) {
		t.Helper()
		if err := s.InTenant(ctx, tenant, func(tx pgx.Tx) error {
			var result string
			var talk, events int
			err := tx.QueryRow(ctx, `SELECT coalesce(result,''),coalesce(talk_seconds,-1),
			  (SELECT count(*) FROM call_events WHERE event_key='reconcile-terminal')
			  FROM sip_lab_calls WHERE tenant_id=$1 AND call_id='reconcile.1'`, tenant).Scan(&result, &talk, &events)
			if err == nil && (result != expectedResult || talk != expectedTalk || events != expectedEvents) {
				t.Errorf("result=%q talk=%d events=%d", result, talk, events)
			}
			return err
		}); err != nil {
			t.Fatal(err)
		}
	}
	verify(tenants[0], "UNKNOWN", -1, 1)
	verify(tenants[1], "", -1, 0)
	if err := s.InTenant(ctx, tenants[0], func(tx pgx.Tx) error {
		var state string
		var answered *time.Time
		err := tx.QueryRow(ctx, `SELECT state,answered_at FROM call_sessions WHERE asterisk_linked_id='reconcile.1'`).Scan(&state, &answered)
		if err == nil && (state != "interrupted" || answered != nil) {
			t.Errorf("state=%q answered=%v", state, answered)
		}
		return err
	}); err != nil {
		t.Fatal(err)
	}
	for _, talk := range []int{3, 9} {
		if err := repo.Finish(ctx, tenants[0], siptrunk.Attempt{ID: "reconcile.1", Result: "ANSWER", Talk: talk, EndedAt: &at}); err != nil {
			t.Fatal(err)
		}
	}
	verify(tenants[0], "ANSWER", 3, 1)
	verify(tenants[1], "", -1, 0)
}
