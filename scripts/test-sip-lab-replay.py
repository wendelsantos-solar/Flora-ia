#!/usr/bin/env python3
"""Exercise a real hangup during backend outage and replay after restarting the PBX."""
import json
from pathlib import Path
import runpy
import subprocess
from datetime import datetime, timezone

lab = runpy.run_path(str(Path(__file__).with_name("test-sip-lab.py")))
dc, request, ast, wait = (lab[k] for k in ("DC", "request", "ast", "wait"))
admin = lab["ENV"]["TOKEN_201"]
out = {}
status, body = request(admin)
assert status == 200
previous = json.loads(body)["policy"]
backend = subprocess.check_output([*dc, "ps", "-q", "backend"], text=True).strip()
assert backend
try:
    policy = dict(previous, enabled=True, trunk_enabled=True, attempts=60,
                  seconds=60, lines=["201"], allowed=["8800000001"], blocked=[])
    assert request(admin, "PUT", policy)[0] == 204
    lab["clear_calls"]()
    call = lab["scenario"]("a", "8800000001", "allowed")
    call_id = call["call_id"]

    def caller_channel():
        for line in ast("asterisk", "core show channels concise").splitlines():
            fields = line.split("!")
            if fields[0].startswith("PJSIP/lab-line-") and len(fields) > 4 and fields[4] == "Up":
                return fields[0]
        return None

    channel = wait(caller_channel, 8)

    def pending():
        code = "import sqlite3,sys; print(sqlite3.connect('/var/log/asterisk/sip-lab/outbox.db').execute('select count(*) from pending where id=?',(sys.argv[1],)).fetchone()[0])"
        return int(lab["exec_"]("asterisk", "python3", "-c", code, call_id))

    subprocess.run(["docker", "pause", backend], check=True)
    try:
        ast("asterisk", f"channel request hangup {channel}")
        wait(pending, 12)
        subprocess.run([*dc, "restart", "-t", "3", "asterisk"], check=True)
        wait(lambda: pending() == 1, 20)
        out["persisted_across_pbx_restart"] = True
        restored_at = datetime.now(timezone.utc)
    finally:
        subprocess.run(["docker", "unpause", backend], check=True)

    finished = lab["completed"](call)
    wait(lambda: pending() == 0)
    assert finished["result"] == "ANSWER"
    assert datetime.fromisoformat(finished["ended_at"]) < restored_at
    out.update(result="PASS", replayed=finished)
except Exception as error:
    out.update(result="FAIL", failure=str(error))
    raise
finally:
    (lab["ROOT"] / "docs/evidence/phase-03a/finish-replay.json").write_text(json.dumps(out, indent=2) + "\n")
    request(admin, "PUT", previous)
