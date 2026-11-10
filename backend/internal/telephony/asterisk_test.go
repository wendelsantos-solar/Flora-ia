package telephony

import (
	"bufio"
	"strings"
	"testing"
)

func TestReadAMIFrame(t *testing.T) {
	f, err := ReadFrame(bufio.NewReader(strings.NewReader("Event: Newstate\r\nUniqueid: 123.1\r\nChannelStateDesc: Ringing\r\n\r\n")))
	if err != nil || f["uniqueid"] != "123.1" || f["channelstatedesc"] != "Ringing" {
		t.Fatalf("incorrect frame: %v %v", f, err)
	}
}
func TestParseCEL(t *testing.T) {
	row := []string{"ANSWER", "2026-11-08 21:30:01.123456", "201", "202", "202", "123.1", "123.1", "11111111-1111-4111-8111-111111111111", "PJSIP/201-0001"}
	e, err := ParseCEL(row)
	if err != nil || e.Source != "201" || e.Destination != "202" || e.LinkedID != "123.1" {
		t.Fatalf("invalid CEL mapping: %v %v", e, err)
	}
	again, _ := ParseCEL(row)
	if e.Key != again.Key {
		t.Fatal("non-deterministic idempotency key")
	}
	row[1] = "bad"
	if _, err = ParseCEL(row); err == nil {
		t.Fatal("invalid timestamp accepted")
	}
	if _, err = ParseCEL(row[:3]); err == nil {
		t.Fatal("invalid columns accepted")
	}
}

func TestEpochCEL(t *testing.T) {
	e, err := ParseCEL([]string{"CHAN_START", "1794173480.930103", "201", "", "202", "1794173480.0", "1794173480.0", "11111111-1111-4111-8111-111111111111", "PJSIP/201-00000000"})
	if err != nil || e.At.Unix() != 1794173480 || e.At.Nanosecond() != 930103000 {
		t.Fatalf("epoch timestamp: %v %v", e, err)
	}
}
