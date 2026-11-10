package telephony

import (
	"bufio"
	"context"
	"encoding/csv"
	"errors"
	"flora/internal/identity"
	"flora/internal/store"
	"fmt"
	"io"
	"log/slog"
	"net"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Observer is the seam used by HTTP. It carries state, never media or SIP credentials.
type Observer interface{ Status() Status }
type Status struct {
	QueueJournalHealthy bool       `json:"queue_journal_healthy"`
	Connected           bool       `json:"connected"`
	JournalHealthy      bool       `json:"journal_healthy"`
	LastSync            *time.Time `json:"last_sync"`
	Engine              string     `json:"engine"`
}
type Asterisk struct {
	Store                              *store.Store
	Address, Password, Journal, Tenant string
	mu                                 sync.RWMutex
	state                              Status
}

func (a *Asterisk) Status() Status { a.mu.RLock(); defer a.mu.RUnlock(); return a.state }
func (a *Asterisk) connected(value bool) {
	a.mu.Lock()
	a.state.Connected = value
	a.state.Engine = "Asterisk / PJSIP"
	a.mu.Unlock()
}
func (a *Asterisk) Run(ctx context.Context) {
	go a.journal(ctx)
	go a.queueJournal(ctx)
	delay := time.Second
	for ctx.Err() == nil {
		err := a.observe(ctx)
		a.connected(false)
		if ctx.Err() != nil {
			return
		}
		slog.Warn("asterisk_disconnected", "tenant", a.Tenant, "cause", safeCause(err))
		select {
		case <-ctx.Done():
			return
		case <-time.After(delay):
		}
		if delay < 15*time.Second {
			delay *= 2
		}
	}
}
func safeCause(err error) string {
	if errors.Is(err, io.EOF) {
		return "eof"
	}
	return "connection_or_protocol_error"
}
func ReadFrame(r *bufio.Reader) (map[string]string, error) {
	frame := map[string]string{}
	for {
		line, err := r.ReadString('\n')
		if err != nil {
			return nil, err
		}
		if len(line) > 65536 {
			return nil, errors.New("AMI field too large")
		}
		line = strings.TrimRight(line, "\r\n")
		if line == "" {
			if len(frame) > 0 {
				return frame, nil
			}
			continue
		}
		if key, value, ok := strings.Cut(line, ":"); ok {
			frame[strings.ToLower(key)] = strings.TrimSpace(value)
		}
	}
}
func (a *Asterisk) observe(ctx context.Context) error {
	conn, err := (&net.Dialer{Timeout: 5 * time.Second}).DialContext(ctx, "tcp", a.Address)
	if err != nil {
		return err
	}
	defer conn.Close()
	done := make(chan struct{})
	defer close(done)
	go func() {
		select {
		case <-ctx.Done():
			conn.Close()
		case <-done:
		}
	}()
	conn.SetDeadline(time.Now().Add(8 * time.Second))
	reader := bufio.NewReaderSize(conn, 65536)
	if _, err = reader.ReadString('\n'); err != nil {
		return err
	}
	if _, err = fmt.Fprintf(conn, "Action: Login\r\nUsername: observer\r\nSecret: %s\r\nEvents: on\r\n\r\n", a.Password); err != nil {
		return err
	}
	frame, err := ReadFrame(reader)
	if err != nil {
		return err
	}
	if frame["response"] != "Success" {
		return errors.New("AMI login denied")
	}
	a.connected(true)
	slog.Info("asterisk_connected", "tenant", a.Tenant)
	contacts := map[string]bool{}
	active := []string{}
	if _, err = io.WriteString(conn, "Action: PJSIPShowContacts\r\nActionID: contacts\r\n\r\nAction: CoreShowChannels\r\nActionID: channels\r\n\r\n"); err != nil {
		return err
	}
	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-done:
				return
			case <-ctx.Done():
				return
			case <-ticker.C:
				conn.SetWriteDeadline(time.Now().Add(3 * time.Second))
				if _, err := io.WriteString(conn, "Action: PJSIPShowContacts\r\nActionID: contacts\r\n\r\nAction: CoreShowChannels\r\nActionID: channels\r\n\r\n"); err != nil {
					conn.Close()
					return
				}
			}
		}
	}()
	for ctx.Err() == nil {
		conn.SetReadDeadline(time.Now().Add(8 * time.Second))
		f, err := ReadFrame(reader)
		if err != nil {
			return err
		}
		if f["actionid"] == "contacts" && f["response"] == "Error" && f["message"] == "No Contacts found" {
			f["event"] = "ContactListComplete"
		}
		switch f["event"] {
		case "CoreShowChannel":
			active = append(active, f["linkedid"])
		case "CoreShowChannelsComplete":
			if a.Status().JournalHealthy {
				if err = a.Store.Reconcile(ctx, a.Tenant, active); err != nil {
					return err
				}
			}
			active = []string{}
		case "ContactList":
			if f["status"] == "Reachable" || f["status"] == "NonQualified" {
				contacts[f["endpoint"]] = true
			}
		case "ContactListComplete":
			for _, n := range identity.Extensions(a.Tenant) {
				if err = a.Store.Registration(ctx, a.Tenant, n, contacts[n]); err != nil {
					return err
				}
			}
			contacts = map[string]bool{}
		case "ContactStatus":
			n := f["endpointname"]
			if identity.OwnsExtension(a.Tenant, n) {
				if err = a.Store.Registration(ctx, a.Tenant, n, f["contactstatus"] == "Reachable" || f["contactstatus"] == "Created"); err != nil {
					return err
				}
			}
		case "Newstate":
			if f["channelstatedesc"] == "Ringing" && f["accountcode"] == a.Tenant && identity.OwnsExtension(a.Tenant, f["calleridnum"]) {
				e := store.JournalEvent{Key: store.Key(a.Tenant + f["uniqueid"] + "ringing"), Tenant: a.Tenant, Kind: "RINGING", Source: f["calleridnum"], Destination: f["exten"], UniqueID: f["uniqueid"], LinkedID: f["linkedid"], Channel: f["channel"], At: time.Now().UTC()}
				if err = a.Store.Apply(ctx, e); err != nil {
					return err
				}
			}
		}
	}
	return ctx.Err()
}
func ParseCEL(row []string) (store.JournalEvent, error) {
	if len(row) != 9 && len(row) != 10 {
		return store.JournalEvent{}, errors.New("invalid CEL columns")
	}
	at, err := time.Parse("2006-01-02 15:04:05.999999", row[1])
	if err != nil {
		seconds, micros, ok := strings.Cut(row[1], ".")
		if ok && len(micros) == 6 {
			sec, e1 := strconv.ParseInt(seconds, 10, 64)
			us, e2 := strconv.ParseInt(micros, 10, 64)
			if e1 == nil && e2 == nil {
				at = time.Unix(sec, us*1000).UTC()
				err = nil
			}
		}
	}
	if err != nil {
		return store.JournalEvent{}, err
	}
	dest := row[4]
	if !identity.OwnsExtension(row[7], dest) && !queueNumber.MatchString(dest) {
		dest = row[3]
	}
	extra := ""
	if len(row) == 10 {
		extra = row[9]
	}
	return store.JournalEvent{Extra: extra, Key: store.Key(strings.Join(row, "\x00")), Tenant: row[7], Kind: row[0], Source: row[2], Destination: dest, UniqueID: row[5], LinkedID: row[6], Channel: row[8], At: at}, nil
}
func (a *Asterisk) ingest(ctx context.Context) error {
	f, err := os.Open(a.Journal)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	defer f.Close()
	if info, err := f.Stat(); err != nil {
		return err
	} else if info.Size() > 32*1024*1024 {
		return errors.New("CEL development journal exceeded 32 MiB; archive procedure required")
	}
	r := csv.NewReader(f)
	r.FieldsPerRecord = -1
	for {
		row, err := r.Read()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}
		e, err := ParseCEL(row)
		if err != nil {
			return err
		}
		if e.Tenant != a.Tenant || e.LinkedID == "" {
			continue
		}
		switch e.Kind {
		case "CHAN_START", "ANSWER", "CHAN_END", "LINKEDID_END", "BLINDTRANSFER", "ATTENDEDTRANSFER", "HANGUP":
			if err = a.Store.Apply(ctx, e); err != nil {
				return err
			}
		}
	}
}
func (a *Asterisk) journal(ctx context.Context) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		err := a.ingest(ctx)
		a.mu.Lock()
		a.state.JournalHealthy = err == nil
		if err == nil {
			now := time.Now().UTC()
			a.state.LastSync = &now
		}
		a.mu.Unlock()
		if err != nil && ctx.Err() == nil {
			slog.Error("cel_ingest_failed", "tenant", a.Tenant, "cause", safeCause(err))
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
