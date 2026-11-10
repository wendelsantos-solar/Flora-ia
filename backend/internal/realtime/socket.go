package realtime

import (
	"context"
	"encoding/json"
	"flora/internal/identity"
	"flora/internal/store"
	"github.com/coder/websocket"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func Serve(w http.ResponseWriter, r *http.Request, s *store.Store, viewer identity.Principal, origin string, valid func() bool) {
	after, err := strconv.ParseInt(r.URL.Query().Get("after"), 10, 64)
	if r.URL.Query().Get("after") == "" {
		after = 0
		err = nil
	}
	if err != nil || after < 0 {
		http.Error(w, "invalid cursor", 400)
		return
	}
	if r.Header.Get("Origin") != origin {
		http.Error(w, "origin denied", 403)
		return
	}
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: []string{strings.TrimPrefix(strings.TrimPrefix(origin, "http://"), "https://")}})
	if err != nil {
		return
	}
	defer conn.Close(websocket.StatusNormalClosure, "closed")
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Minute)
	defer cancel()
	ctx = conn.CloseRead(ctx)
	ticker := time.NewTicker(400 * time.Millisecond)
	defer ticker.Stop()
	ping := time.NewTicker(20 * time.Second)
	defer ping.Stop()
	checkAt := time.Now().Add(3 * time.Second)
	for {
		if time.Now().After(checkAt) {
			if !valid() {
				conn.Close(websocket.StatusPolicyViolation, "session expired")
				return
			}
			checkAt = time.Now().Add(3 * time.Second)
		}
		queryCtx, done := context.WithTimeout(ctx, 3*time.Second)
		events, err := s.EventsScoped(queryCtx, viewer.TenantID, after, viewer)
		done()
		if err != nil {
			conn.Close(websocket.StatusInternalError, "event store unavailable")
			return
		}
		for _, e := range events {
			raw, _ := json.Marshal(e)
			writeCtx, done := context.WithTimeout(ctx, 5*time.Second)
			err = conn.Write(writeCtx, websocket.MessageText, raw)
			done()
			if err != nil {
				return
			}
			after = e.Sequence
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		case <-ping.C:
			pingCtx, done := context.WithTimeout(ctx, 5*time.Second)
			err = conn.Ping(pingCtx)
			done()
			if err != nil {
				return
			}
		}
	}
}
