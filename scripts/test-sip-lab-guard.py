#!/usr/bin/env python3
"""Test actual SIP redirects, REFER and failure of the private authorization service."""
import json
import os
import runpy
import subprocess
import time
from pathlib import Path

lab = runpy.run_path(str(Path(__file__).with_name("test-sip-lab.py")))
globals().update({key:lab[key] for key in ("ROOT","DC","ENV","request","database","originate","scenario","completed","clear_calls","wait")})
EVIDENCE = {}


def marker(key):
    return lab["ast"]("carrier-a",f"database get flora-lab {key}")


def run():
    assert "func_db" in lab["ast"]("carrier-a","core show function DB")
    admin=ENV["TOKEN_201"]
    code, body=request(admin)
    assert code==200
    previous=json.loads(body)["policy"]
    policy=dict(previous,enabled=True,trunk_enabled=True,attempts=60,
        allowed=["8800000001","8800000004","8800000005"],blocked=["8800000001"])
    try:
        assert request(admin,"PUT",policy)[0]==204
        answered_before=marker("default-id")
        EVIDENCE["redirect"]=completed(scenario("a","8800000004","allowed"))
        assert EVIDENCE["redirect"]["result"]!="ANSWER"
        assert marker("default-id")==answered_before
        lab["ast"]("carrier-a","database del flora-lab refer")
        EVIDENCE["refer_call"]=completed(scenario("a","8800000005","allowed"))
        response=marker("refer").split("/")[-1]
        refer_after=marker("refer")
        assert marker("default-id")==answered_before
        EVIDENCE["refer_response"]=int(response) if response.isdigit() else "unconfirmed"
        clear_calls()

        before=len(database())
        subprocess.run([*DC,"stop","-t","3","backend"],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
        try:
            originate("a","8800000005")
            clear_calls()
            assert len(database())==before
            assert marker("refer")==refer_after
        finally:
            subprocess.run([*DC,"start","backend"],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
        def ready():
            try: return request(admin)[0]==200
            except (ValueError,subprocess.CalledProcessError): return False
        wait(ready,30)
        EVIDENCE["authorization_outage"]="no new reservation or call to the simulator"
        EVIDENCE["after_reconnect"]=completed(scenario("a","8800000005","allowed"))
        clear_calls()
    finally:
        request(admin,"PUT",previous)


if __name__=="__main__":
    output=Path(os.environ.get("SIP_LAB_EVIDENCE_DIR", ROOT/"docs/evidence/phase-03a"))/"guard.json"
    try:
        run()
        EVIDENCE["result"]="PASS"
    except Exception as error:
        EVIDENCE["result"]="FAIL"
        EVIDENCE["failure"]=str(error)
        raise
    finally:
        output.write_text(json.dumps(EVIDENCE,indent=2)+"\n")
