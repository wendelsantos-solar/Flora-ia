package main

import (
	"context"
	"flora/internal/httpapi"
	"flora/internal/identity"
	"flora/internal/operations"
	"flora/internal/siptrunk"
	"flora/internal/store"
	"flora/internal/telephony"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func required(k string) string {
	v := os.Getenv(k)
	if v == "" {
		slog.Error("missing_configuration", "key", k)
		os.Exit(1)
	}
	return v
}
func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	cfg, err := pgxpool.ParseConfig(required("DATABASE_URL"))
	if err != nil {
		slog.Error("invalid_database_configuration")
		os.Exit(1)
	}
	cfg.MaxConns = 10
	cfg.ConnConfig.ConnectTimeout = 5 * time.Second
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		slog.Error("database_init_failed")
		os.Exit(1)
	}
	defer pool.Close()
	keyA, keyB := os.Getenv("SIP_LAB_KEY_A"), os.Getenv("SIP_LAB_KEY_B")
	labEnabled := keyA != "" || keyB != ""
	if labEnabled && (len(keyA) < 48 || len(keyB) < 48 || keyA == keyB) {
		slog.Error("invalid_sip_lab_keys")
		os.Exit(1)
	}
	s := &store.Store{Pool: pool, ReconcileSIPLab: labEnabled}
	catalog := operations.Repository{Store: s}
	engines := map[string]telephony.Observer{}
	controllers := map[string]*telephony.Queues{}
	for _, config := range []struct{ tenant, address, password, journal, control, path string }{
		{identity.DevelopmentTenant, "AMI_ADDRESS", "AMI_PASSWORD", "CEL_PATH", "QUEUE_AMI_PASSWORD", "/var/spool/flora-config"},
		{identity.SecondTenant, "AMI_B_ADDRESS", "AMI_B_PASSWORD", "CEL_B_PATH", "QUEUE_AMI_B_PASSWORD", "/var/spool/flora-config-b"},
	} {
		engine := &telephony.Asterisk{Store: s, Tenant: config.tenant, Address: required(config.address), Password: required(config.password), Journal: required(config.journal)}
		controller := &telephony.Queues{Repository: catalog, Tenant: config.tenant, Address: engine.Address, Password: required(config.control), ConfigPath: config.path}
		engines[config.tenant] = engine
		controllers[config.tenant] = controller
		go engine.Run(ctx)
		go controller.Run(ctx)
	}
	api := &httpapi.API{Store: s, Auth: identity.New(), Telephony: engines[identity.DevelopmentTenant], Engines: engines, Operations: catalog, Controllers: controllers, Origin: required("WEB_ORIGIN")}
	if labEnabled {
		api.SIPLab = &siptrunk.Repository{Store: s}
		api.SIPLabKeys = map[string]string{identity.DevelopmentTenant: keyA, identity.SecondTenant: keyB}
	}
	server := &http.Server{BaseContext: func(net.Listener) context.Context { return ctx }, Addr: ":8080", Handler: api.Handler(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 * 1024}
	go func() {
		slog.Info("http_listening", "address", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("http_failed")
			cancel()
		}
	}()
	<-ctx.Done()
	shutdown, done := context.WithTimeout(context.Background(), 10*time.Second)
	defer done()
	server.Shutdown(shutdown)
}
