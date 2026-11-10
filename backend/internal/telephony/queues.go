package telephony

import (
	"bufio"
	"context"
	"crypto/sha256"
	"errors"
	"flora/internal/identity"
	"flora/internal/operations"
	"fmt"
	"io"
	"log/slog"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

func queuePrefix(tenant string) string { return "t" + tenant + "-" }

type QueueMember struct {
	Extension string `json:"extension"`
	Paused    bool   `json:"paused"`
	State     string `json:"state"`
}
type LiveQueue struct {
	Waiting int                    `json:"waiting"`
	Members map[string]QueueMember `json:"members"`
}
type ActiveCall struct {
	LinkedID    string `json:"linked_id"`
	Source      string `json:"source"`
	Destination string `json:"destination"`
}
type QueueSnapshot struct {
	Fresh     bool                 `json:"fresh"`
	At        time.Time            `json:"at"`
	Queues    map[string]LiveQueue `json:"queues"`
	Connected []string             `json:"connected"`
	Calls     []ActiveCall         `json:"calls"`
}
type Queues struct {
	Repository                            operations.Repository
	Address, Password, Tenant, ConfigPath string
	mu                                    sync.RWMutex
	snapshot                              QueueSnapshot
}

func (q *Queues) Snapshot(tenant string) QueueSnapshot {
	q.mu.RLock()
	defer q.mu.RUnlock()
	if tenant != q.Tenant || !q.snapshot.Fresh || time.Since(q.snapshot.At) > 7*time.Second {
		return QueueSnapshot{Queues: map[string]LiveQueue{}}
	}
	return q.snapshot
}
func (q *Queues) Run(ctx context.Context) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	failed := false
	for ctx.Err() == nil {
		state, err := q.sync(ctx)
		if err != nil {
			if !failed && ctx.Err() == nil {
				slog.Warn("queue_reconciliation_failed", "tenant", q.Tenant, "reason", err.Error())
			}
			failed = true
		} else {
			failed = false
		}
		q.mu.Lock()
		q.snapshot = state
		q.mu.Unlock()
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

type queueAMI struct {
	net.Conn
	reader *bufio.Reader
}

func (m queueAMI) action(fields string, complete string) ([]map[string]string, error) {
	if _, err := io.WriteString(m.Conn, fields+"\r\n\r\n"); err != nil {
		return nil, err
	}
	var frames []map[string]string
	for len(frames) < 2000 {
		f, err := ReadFrame(m.reader)
		if err != nil {
			return nil, err
		}
		if f["response"] == "Error" {
			if complete == "ContactListComplete" && f["message"] == "No Contacts found" {
				return frames, nil
			}
			return nil, errors.New("AMI rejected " + strings.SplitN(fields, "\r\n", 2)[0])
		}
		if (complete == "" && f["response"] == "Success") || (complete != "" && f["event"] == complete) {
			return frames, nil
		}
		frames = append(frames, f)
	}
	return nil, errors.New("AMI snapshot too large")
}
func (q *Queues) sync(ctx context.Context) (QueueSnapshot, error) {
	ctx, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()
	c, err := q.Repository.Catalog(ctx, q.Tenant)
	if err != nil {
		return QueueSnapshot{}, errors.New("queue catalog unavailable")
	}
	conn, err := (&net.Dialer{}).DialContext(ctx, "tcp", q.Address)
	if err != nil {
		return QueueSnapshot{}, errors.New("queue AMI unavailable")
	}
	defer conn.Close()
	if deadline, ok := ctx.Deadline(); ok {
		conn.SetDeadline(deadline)
	}
	reader := bufio.NewReaderSize(conn, 65536)
	if _, err = reader.ReadString('\n'); err != nil {
		return QueueSnapshot{}, err
	}
	ami := queueAMI{conn, reader}
	if _, err = ami.action("Action: Login\r\nUsername: queue-controller\r\nSecret: "+q.Password+"\r\nEvents: off", ""); err != nil {
		return QueueSnapshot{}, err
	}
	configs, routes, err := renderQueues(q.Tenant, c)
	if err != nil {
		return QueueSnapshot{}, err
	}
	hash := sha256.Sum256([]byte(configs + "\x00" + routes))
	revision := fmt.Sprintf("%x", hash)
	current, _ := os.ReadFile(filepath.Join(q.ConfigPath, "revision"))
	if string(current) != revision {
		for name, data := range map[string]string{"queues.conf": configs, "routes.conf": routes, "revision": revision} {
			if name == "revision" {
				continue
			}
			if err = writeConfig(q.ConfigPath, name, data); err != nil {
				return QueueSnapshot{}, errors.New("queue configuration write failed")
			}
		}
		if err = writeConfig(q.ConfigPath, "revision", revision); err != nil {
			return QueueSnapshot{}, errors.New("queue revision write failed")
		}
	}
	for {
		applied, _ := os.ReadFile(filepath.Join(q.ConfigPath, "applied"))
		if string(applied) == revision {
			break
		}
		select {
		case <-ctx.Done():
			return QueueSnapshot{}, errors.New("queue reload not acknowledged")
		case <-time.After(125 * time.Millisecond):
		}
	}
	live, reachable, err := readQueues(ami, q.Tenant)
	if err != nil {
		return QueueSnapshot{}, err
	}
	changed := false
	for _, queue := range c.Queues {
		existing, ok := live[queue.Number]
		if !ok {
			return QueueSnapshot{}, errors.New("queue missing from Asterisk snapshot")
		}
		desired := map[string]operations.Member{}
		for _, m := range c.Members {
			if m.Queue == queue.Number && m.Joined && identity.OwnsExtension(q.Tenant, m.Extension) {
				desired[m.Extension] = m
			}
		}
		for n := range existing.Members {
			if _, ok := desired[n]; !ok {
				if _, err = ami.action("Action: QueueRemove\r\nQueue: "+queuePrefix(q.Tenant)+queue.Number+"\r\nInterface: PJSIP/"+n, ""); err != nil {
					return QueueSnapshot{}, err
				}
				changed = true
			}
		}
		for n, m := range desired {
			actual, ok := existing.Members[n]
			headers := "\r\nQueue: " + queuePrefix(q.Tenant) + queue.Number + "\r\nInterface: PJSIP/" + n + "\r\nPaused: " + strconv.FormatBool(m.Paused)
			if !ok {
				_, err = ami.action("Action: QueueAdd"+headers, "")
				changed = true
			} else if m.Paused != actual.Paused {
				_, err = ami.action("Action: QueuePause"+headers, "")
				changed = true
			}
			if err != nil {
				return QueueSnapshot{}, err
			}
		}
	}
	if changed {
		live, reachable, err = readQueues(ami, q.Tenant)
		if err != nil {
			return QueueSnapshot{}, err
		}
	}
	// If the PBX was recreated with persisted config, the snapshot is enough to verify it exists.
	// Missing queues force the next reconciliation to reapply files and reload.
	filtered := map[string]LiveQueue{}
	for _, queue := range c.Queues {
		if liveQueue, ok := live[queue.Number]; ok {
			filtered[queue.Number] = liveQueue
		}
	}
	channelFrames, err := ami.action("Action: CoreShowChannels", "CoreShowChannelsComplete")
	if err != nil {
		return QueueSnapshot{}, err
	}
	active := map[string]ActiveCall{}
	for _, f := range channelFrames {
		id := f["linkedid"]
		if f["event"] != "CoreShowChannel" || !journalID.MatchString(id) || f["accountcode"] != q.Tenant {
			continue
		}
		if _, ok := active[id]; !ok || f["uniqueid"] == id {
			source, dest := f["calleridnum"], f["exten"]
			if !identity.OwnsExtension(q.Tenant, source) {
				source = ""
			}
			if !identity.OwnsExtension(q.Tenant, dest) && !queueNumber.MatchString(dest) {
				dest = ""
			}
			active[id] = ActiveCall{id, source, dest}
		}
	}
	calls := []ActiveCall{}
	for _, c := range active {
		calls = append(calls, c)
	}
	connected := []string{}
	for _, n := range identity.Extensions(q.Tenant) {
		if reachable[n] {
			connected = append(connected, n)
		}
	}
	return QueueSnapshot{Fresh: true, At: time.Now().UTC(), Queues: filtered, Connected: connected, Calls: calls}, nil
}
func readQueues(ami queueAMI, tenant string) (map[string]LiveQueue, map[string]bool, error) {
	frames, err := ami.action("Action: QueueStatus", "QueueStatusComplete")
	if err != nil {
		return nil, nil, err
	}
	contacts, err := ami.action("Action: PJSIPShowContacts", "ContactListComplete")
	if err != nil {
		return nil, nil, err
	}
	reachable := map[string]bool{}
	for _, f := range contacts {
		if f["event"] == "ContactList" && f["status"] == "Reachable" {
			reachable[f["endpoint"]] = true
		}
	}
	result := map[string]LiveQueue{}
	for _, f := range frames {
		n, ok := strings.CutPrefix(f["queue"], queuePrefix(tenant))
		if !ok || !queueNumber.MatchString(n) {
			continue
		}
		switch f["event"] {
		case "QueueParams":
			waiting, _ := strconv.Atoi(f["calls"])
			result[n] = LiveQueue{Waiting: waiting, Members: map[string]QueueMember{}}
		case "QueueMember":
			queue, ok := result[n]
			if !ok {
				continue
			}
			ext, ok := strings.CutPrefix(f["location"], "PJSIP/")
			if !ok {
				ext, ok = strings.CutPrefix(f["interface"], "PJSIP/")
			}
			if !ok || !identity.OwnsExtension(tenant, ext) {
				continue
			}
			paused := f["paused"] == "1"
			state := "unavailable"
			switch {
			case !reachable[ext]:
				state = "disconnected"
			case f["incall"] == "1" || f["status"] == "2" || f["status"] == "3" || f["status"] == "6" || f["status"] == "7" || f["status"] == "8":
				state = "busy"
			case paused:
				state = "paused"
			case f["status"] == "1":
				state = "available"
			}
			queue.Members[ext] = QueueMember{ext, paused, state}
		}
	}
	return result, reachable, nil
}

var queueNumber = regexp.MustCompile("^3[0-9]{2}$")

func renderQueues(tenant string, c operations.Catalog) (string, string, error) {
	var queues, routes strings.Builder
	schedules := map[string]operations.Schedule{}
	for _, hours := range c.Schedules {
		schedules[hours.Department] = hours
	}
	routes.WriteString("[flora-queues-demo]\n")
	for _, q := range c.Queues {
		if !queueNumber.MatchString(q.Number) || (q.Fallback != "" && !identity.OwnsExtension(tenant, q.Fallback)) || q.RingSeconds < 3 || q.RingSeconds > 30 || q.WaitSeconds < q.RingSeconds || q.WaitSeconds > 180 {
			return "", "", errors.New("queue routing outside provisioned scope")
		}
		switch q.Strategy {
		case "ringall", "rrmemory", "fewestcalls":
		default:
			return "", "", errors.New("invalid Asterisk strategy")
		}
		name := queuePrefix(tenant) + q.Number
		fmt.Fprintf(&queues, "[%s]\nstrategy=%s\ntimeout=%d\nretry=1\nmaxlen=20\nringinuse=no\njoinempty=paused,invalid,unavailable,unknown\nleavewhenempty=paused,invalid,unavailable,unknown\n", name, q.Strategy, q.RingSeconds)
		fmt.Fprintf(&routes, "exten => %s,1,NoOp(Flora internal queue)\n", q.Number)
		hours, hasHours := schedules[q.Department]
		if hasHours {
			if !operations.ValidSchedule(hours) || (hours.ClosedDestination != "" && !identity.OwnsExtension(tenant, hours.ClosedDestination)) {
				return "", "", errors.New("invalid schedule for Asterisk")
			}
			weekdays := []string{"sun", "mon", "tue", "wed", "thu", "fri", "sat"}
			days := []string{}
			for _, day := range hours.Days {
				days = append(days, weekdays[day])
			}
			end, _ := time.Parse("15:04", hours.ClosesAt)
			fmt.Fprintf(&routes, " same => n,GotoIfTime(%s-%s,%s,*,*,%s?open:closed)\n", hours.OpensAt, end.Add(-time.Minute).Format("15:04"), strings.Join(days, "&"), hours.Timezone)
		}
		fmt.Fprintf(&routes, " same => n(open),Queue(%s,ri,,,%d)\n same => n,GotoIf($[\"${QUEUESTATUS}\" = \"CONTINUE\"]?finish)\n", name, q.WaitSeconds)
		fmt.Fprintf(&routes, " same => n,QueueLog(%s,${UNIQUEID},NONE,FLORA_CONTINGENCY,${QUEUESTATUS})\n", name)
		writeFallback(&routes, q.Fallback)
		routes.WriteString(" same => n,Goto(finish)\n")
		if hasHours {
			fmt.Fprintf(&routes, " same => n(closed),QueueLog(%s,${UNIQUEID},NONE,FLORA_CLOSED)\n", name)
			writeFallback(&routes, hours.ClosedDestination)
		}
		routes.WriteString(" same => n(finish),Hangup()\n")
	}
	return queues.String(), routes.String(), nil
}
func writeFallback(routes *strings.Builder, ext string) {
	if ext == "" {
		return
	}
	fmt.Fprintf(routes, " same => n,GotoIf($[\"${CALLERID(num)}\" = \"%s\"]?finish)\n same => n,Dial(PJSIP/%s,20,i)\n", ext, ext)
}
func writeConfig(queueConfigPath, name, data string) error {
	f, err := os.CreateTemp(queueConfigPath, ".generated-*")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	defer f.Close()
	if err = f.Chmod(0644); err != nil {
		return err
	}
	if _, err = f.WriteString(data); err != nil {
		return err
	}
	if err = f.Sync(); err != nil {
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	return os.Rename(f.Name(), filepath.Join(queueConfigPath, name))
}
