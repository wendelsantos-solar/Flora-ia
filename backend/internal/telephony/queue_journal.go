package telephony

import (
	"bufio"
	"context"
	"errors"
	"flora/internal/identity"
	"flora/internal/store"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var journalID = regexp.MustCompile("^[0-9]+\\.[0-9]+$")

func parseQueueEvent(tenant, line string) (store.QueueEvent, bool) {
	fields := strings.Split(line, "|")
	if len(fields) < 5 || !journalID.MatchString(fields[1]) {
		return store.QueueEvent{}, false
	}
	number, ok := strings.CutPrefix(fields[2], queuePrefix(tenant))
	if !ok || !queueNumber.MatchString(number) {
		return store.QueueEvent{}, false
	}
	seconds, err := strconv.ParseInt(fields[0], 10, 64)
	if err != nil || seconds <= 0 {
		return store.QueueEvent{}, false
	}
	agent, _ := strings.CutPrefix(fields[3], "PJSIP/")
	if !identity.OwnsExtension(tenant, agent) {
		agent = ""
	}
	e := store.QueueEvent{Key: store.Key(line), Queue: number, UniqueID: fields[1], Agent: agent, Kind: fields[4], At: time.Unix(seconds, 0).UTC()}
	duration := func(i int) *int {
		if i >= len(fields) {
			return nil
		}
		n, err := strconv.Atoi(fields[i])
		if err != nil || n < 0 || n > 31536000 {
			return nil
		}
		return &n
	}
	switch e.Kind {
	case "ENTERQUEUE", "FLORA_CLOSED":
	case "FLORA_CONTINGENCY":
		if len(fields) > 5 {
			switch fields[5] {
			case "TIMEOUT", "FULL", "JOINEMPTY", "LEAVEEMPTY", "JOINUNAVAIL", "LEAVEUNAVAIL", "WITHDRAW":
				e.RoutingStatus = fields[5]
			}
		}
	case "CONNECT":
		e.WaitSeconds = duration(5)
	case "COMPLETEAGENT", "COMPLETECALLER":
		e.WaitSeconds = duration(5)
		e.TalkSeconds = duration(6)
	case "ABANDON", "EXITWITHTIMEOUT", "EXITEMPTY":
		e.WaitSeconds = duration(7)
	case "BLINDTRANSFER", "ATTENDEDTRANSFER":
	default:
		return store.QueueEvent{}, false
	}
	return e, true
}
func (a *Asterisk) ingestQueueJournal(ctx context.Context) error {
	file, err := os.Open(filepath.Join(filepath.Dir(a.Journal), "..", "queue_log"))
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	defer file.Close()
	if info, err := file.Stat(); err != nil {
		return err
	} else if info.Size() > 32*1024*1024 {
		return errors.New("queue journal exceeded development limit")
	}
	reader := bufio.NewReader(file)
	batch := make([]store.QueueEvent, 0, 128)
	for {
		line, err := reader.ReadString('\n')
		if errors.Is(err, io.EOF) {
			return a.Store.RecordQueueEvents(ctx, a.Tenant, batch)
		}
		if err != nil {
			return err
		}
		if e, ok := parseQueueEvent(a.Tenant, strings.TrimSpace(line)); ok {
			batch = append(batch, e)
		}
		if len(batch) == cap(batch) {
			if err = a.Store.RecordQueueEvents(ctx, a.Tenant, batch); err != nil {
				return err
			}
			batch = batch[:0]
		}
	}
}
func (a *Asterisk) queueJournal(ctx context.Context) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	failed := false
	for ctx.Err() == nil {
		err := a.ingestQueueJournal(ctx)
		a.mu.Lock()
		a.state.QueueJournalHealthy = err == nil
		a.mu.Unlock()
		if err != nil && !failed && ctx.Err() == nil {
			slog.Error("queue_journal_ingest_failed", "tenant", a.Tenant, "cause", safeCause(err))
		}
		failed = err != nil
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
