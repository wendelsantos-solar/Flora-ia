#!/usr/bin/env python3
"""Exercise authorization outage and a missing AGI finish in the disposable SIP lab."""
import json
from pathlib import Path
import runpy
import subprocess
import sys

lab = runpy.run_path(str(Path(__file__).with_name("test-sip-lab.py")))
dc, request, ast, wait = (lab[k] for k in ("DC", "request", "ast", "wait"))
admin = lab["ENV"]["TOKEN_201"]
out = {}
status, body = request(admin)
assert status == 200
previous = json.loads(body)["policy"]
db = subprocess.check_output([*dc, "ps", "-q", "db"], text=True).strip()
try:
    policy = dict(previous, enabled=True, trunk_enabled=True, attempts=60, tenant_limit=1, trunk_limit=1,
                  seconds=12, lines=["201"], allowed=["8800000001"], blocked=[])
    assert request(admin, "PUT", policy)[0] == 204
    lab["clear_calls"]()
    if "--skip-db" not in sys.argv:
        before = len(lab["database"]())
        subprocess.run(["docker", "stop", "-t", "3", db], check=True)
        try:
            lab["originate"]("a", "8800000001")
            assert "PJSIP/simulator-" not in ast("asterisk", "core show channels concise")
        finally:
            subprocess.run(["docker", "start", db], check=True)
            wait(lambda: subprocess.run(["docker", "exec", db, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"],
                                       stdout=subprocess.DEVNULL).returncode == 0)
        assert len(lab["database"]()) == before
        out["db_outage_before_reservation"] = "no call reached the carrier or reserved capacity"

    try:
        ast("asterisk", "dialplan remove extension s@flora-sip-lab-finish 1")
        assert "AGI(" not in ast("asterisk", "dialplan show s@flora-sip-lab-finish")
        call = lab["scenario"]("a", "8800000001", "allowed")
        assert "PJSIP/simulator" in ast("asterisk", "core show channels concise")
        recovered = lab["completed"](call, allow_unknown=True)
        assert recovered["result"] == "UNKNOWN" and recovered["talk_seconds"] is None, recovered
        data = lab["exec_"]("db", "psql", "-U", "postgres", "-d", "flora", "-At", "-c",
            "SELECT count(*) FILTER (WHERE e.type='call.created'),"
            "count(*) FILTER (WHERE e.data->>'sip_lab_finish_recovered'='true') "
            "FROM call_events e JOIN call_sessions s ON s.id=e.call_id AND s.tenant_id=e.tenant_id "
            f"WHERE s.tenant_id='{lab['A']}' AND s.asterisk_linked_id='{call['call_id']}'")
        assert data == "0|1", data
        out["cel"] = recovered
        out["initial_events"] = 0
        out["terminal_recovery_events"] = 1
    finally:
        ast("asterisk", "dialplan reload")
    next_call = lab["scenario"]("a", "8800000001", "allowed")
    second = wait(lambda: next((r for r in lab["database"]()
        if r["call_id"] == next_call["call_id"] and r["result"] == "ANSWER"), None))
    out["capacity_released"] = True
    out["next_call"] = second
    out["result"] = "PASS"
except Exception as error:
    out.update(result="FAIL", failure=str(error))
    raise
finally:
    (lab["ROOT"] / "docs/evidence/phase-03a-2/cel-recovery.json").write_text(json.dumps(out, indent=2) + "\n")
    request(admin, "PUT", previous)
