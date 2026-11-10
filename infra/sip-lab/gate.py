#!/usr/bin/python3
"""Local AGI for the isolated PBX. A malformed or missing grant leaves the channel denied."""
import json
import os
import re
import sys
import sqlite3
import time
from contextlib import closing
from datetime import datetime, timezone
import urllib.request


def command(value):
    print(value, flush=True)
    return sys.stdin.readline()


def request(mode, body):
    req = urllib.request.Request(
        f"http://backend:8080/internal/sip-lab/{mode}",
        body,
        {"Content-Type": "application/json", "Authorization": "Bearer " + os.environ["SIP_LAB_KEY"]},
    )

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *unused):
            return None

    with urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect()).open(req, timeout=2) as response:
        if mode == "finish":
            if response.status != 204:
                raise OSError("unexpected finish acknowledgement")
            return
        return json.loads(response.read(4096))


def outbox():
    db = sqlite3.connect(os.environ.get("SIP_LAB_OUTBOX", "/var/log/asterisk/sip-lab/outbox.db"))
    db.execute("CREATE TABLE IF NOT EXISTS pending (id TEXT PRIMARY KEY, body BLOB NOT NULL)")
    return db


def replay():
    while True:
        try:
            with closing(outbox()) as db:
                batch = db.execute("SELECT id, body FROM pending ORDER BY rowid LIMIT 100").fetchall()
                for call_id, body in batch:
                    request("finish", body)
                    with db:
                        db.execute("DELETE FROM pending WHERE id = ?", (call_id,))
        except (OSError, sqlite3.Error):
            pass
        time.sleep(2)


def main():
    mode, *args = sys.argv[1:]
    if mode == "replay":
        replay()
        return
    for line in sys.stdin:
        if not line.strip():
            break
    if mode == "finish":
        call_id, result, talk = args
        if not re.fullmatch(r"[A-Za-z0-9._-]{1,64}", call_id):
            return
        if result not in {"ANSWER", "BUSY", "NOANSWER", "CANCEL", "CHANUNAVAIL", "CONGESTION"}:
            result = "UNKNOWN"
        if result == "ANSWER" and not (talk.isascii() and talk.isdigit() and 0 <= int(talk) <= 120):
            result = "UNKNOWN"
        body = json.dumps({"id": call_id, "result": result, "talk": int(talk) if result == "ANSWER" else 0,
                           "ended_at": datetime.now(timezone.utc).isoformat()}).encode()
        with closing(outbox()) as db, db:
            db.execute("INSERT OR IGNORE INTO pending VALUES (?, ?)", (call_id, body))
        return
    call_id, direction, origin, destination = args
    body = {"id": call_id, "direction": direction, "origin": origin, "destination": destination}
    expires = time.monotonic() + 2
    grant = request(mode, json.dumps(body).encode())
    if time.monotonic() >= expires or grant.get("status") != "allowed":
        return
    target, seconds = grant.get("target"), grant.get("seconds")
    pattern = r"880[0-9]{7}" if direction == "out" else r"[23][0-9]{2}"
    if isinstance(target, str) and re.fullmatch(pattern, target) and type(seconds) is int and 1 <= seconds <= 120:
        command(f"SET VARIABLE FLORA_TARGET {target}")
        command(f"SET VARIABLE FLORA_LIMIT {seconds}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, sqlite3.Error):
        print("sip-lab AGI failed", file=sys.stderr)
        sys.exit(1)
