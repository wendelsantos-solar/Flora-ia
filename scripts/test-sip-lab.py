#!/usr/bin/env python3
"""Real Asterisk/PJSIP test flows in the isolated flora-03a Compose project."""
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
LAB = ROOT / ".local/phase-03a"
DC = ["docker","compose","-p","flora-03a","-f",str(LAB/"compose.json")]
ENV = dict(line.split("=",1) for line in (LAB/"env").read_text().splitlines())
A = "11111111-1111-4111-8111-111111111111"
B = "33333333-3333-4333-8333-333333333333"
EVIDENCE = {}


def run(*args, data=None):
    return subprocess.check_output(args,cwd=ROOT,text=True,input=data).strip()


def exec_(service, *args, data=None):
    return run(*DC,"exec","-T",service,*args,data=data)


def ast(service, command):
    return exec_(service,"asterisk","-rx",command)


def request(token, method="GET", body=None, route="/v1/sip-lab", origin="http://localhost:13400"):
    code = """import json,sys,urllib.request,urllib.error
token,method,body,route,origin=json.load(sys.stdin)
req=urllib.request.Request('http://backend:8080'+route,json.dumps(body).encode() if body is not None else None,
 {'Authorization':'Bearer '+token,'Origin':origin,'Content-Type':'application/json'},method=method)
try:
 with urllib.request.urlopen(req,timeout=10) as response:
  print(json.dumps([response.status,response.read().decode()]))
except urllib.error.HTTPError as e:
 print(json.dumps([e.code,e.read().decode()]))
"""
    return json.loads(exec_("carrier-a","python3","-c",code,data=json.dumps([token,method,body,route,origin])))


def database():
    output=exec_("db","psql","-U","postgres","-d","flora","-At","-c",
      "SELECT COALESCE(json_agg(t ORDER BY created_at),'[]') FROM (SELECT tenant_id,call_id,direction,origin,destination,category,decision,result,talk_seconds,created_at,ended_at FROM sip_lab_calls) t")
    return json.loads(output)


def wait(fn, seconds=35):
    end=time.monotonic()+seconds
    while time.monotonic()<end:
        result=fn()
        if result:
            return result
        time.sleep(.25)
    raise AssertionError("Lab condition timed out")


def new_rows(before, count):
    return wait(lambda: (rows if len(rows:=[r for r in database() if (r["tenant_id"],r["call_id"]) not in before])>=count else None))


def originate(side, target, endpoint="line"):
    response=ast(f"carrier-{side}",f"channel originate PJSIP/{target}@{endpoint} application Wait 25")
    assert "No such command" not in response,response


def scenario(side,target,decision,endpoint="line"):
    before={(r["tenant_id"],r["call_id"]) for r in database()}
    originate(side,target,endpoint)
    row,=new_rows(before,1)
    assert row["decision"]==decision,row
    return row


def completed(row, *, allow_unknown=False):
    return wait(lambda: next((r for r in database()
        if r["tenant_id"] == row["tenant_id"] and r["call_id"] == row["call_id"]
        and r["ended_at"] and (allow_unknown or r["result"] != "UNKNOWN")), None))


def clear_calls():
    for side, suffix in (("a",""),("b","-b")):
        wait(lambda:"0 active channels" in ast("asterisk"+suffix,"core show channels count"))


def test():
    state=json.loads(run("docker","inspect",*run(*DC,"ps","-q").splitlines()))
    assert all(not any(item["NetworkSettings"]["Ports"].values()) for item in state)
    assert all(json.loads(run("docker","network","inspect",f"flora-03a_{network}"))[0]["Internal"] for network in ("private","pbx_a","pbx_b"))
    EVIDENCE["perimeter"]={"published_ports":0,"internal_networks":3}
    admin=ENV["TOKEN_201"]
    other=ENV["TOKEN_211"]
    assert request("bad")[0]==401
    assert request(ENV["TOKEN_202"])[0]==403
    assert request(admin)[0]==200
    assert request(admin,"PUT",{},origin="https://wrong.invalid")[0]==403
    assert request(admin,"POST",{"id":"spoof"},route="/internal/sip-lab/reserve")[0]==401
    EVIDENCE["access"]={"anonymous":401,"operator":403,"foreign_origin":403,"browser_pbx_command":401}

    policy={"enabled":True,"trunk_enabled":True,"allowed":["8800000001","8800000002","8800000003"],"blocked":[],
            "lines":["201"],"tenant_limit":1,"trunk_limit":1,"line_limit":1,"attempts":60,"seconds":10,"inbound_did":"8800000000","inbound_target":"201"}
    assert request(admin,"PUT",dict(policy,enabled=False))[0]==204
    EVIDENCE["default_denied"]=scenario("a","8800000001","disabled")
    assert request(admin,"PUT",dict(policy,inbound_target="211"))[0]==400
    assert request(admin,"PUT",dict(policy,host="127.0.0.1"))[0]==400
    assert request(admin,"PUT",policy)[0]==204
    EVIDENCE["line_denied"]=scenario("a","8800000001","line_denied","blocked")
    EVIDENCE["invalid_destination"]=scenario("a","8800000009","destination_denied")
    EVIDENCE["international"]=scenario("a","+351000000000","destination_denied")
    EVIDENCE["special"]=scenario("a","09000000000","destination_denied")
    EVIDENCE["emergency"]=scenario("a","192","destination_denied")
    assert request(admin,"PUT",dict(policy,lines=["203"]))[0]==400
    assert request(admin,"PUT",dict(policy,blocked=["8800000001"]))[0]==204
    EVIDENCE["blocked_overrides_allow"]=scenario("a","8800000001","destination_denied")
    assert request(admin,"PUT",policy)[0]==204
    before={(r["tenant_id"],r["call_id"]) for r in database()}
    originate("a","8800000001","internal-test")
    time.sleep(1)
    assert not any((r["tenant_id"],r["call_id"]) not in before for r in database())
    EVIDENCE["internal_bypass"]="internal SIP endpoint cannot reach external context"
    EVIDENCE["tenant_b_default"]=scenario("b","8800000001","disabled")
    assert not json.loads(request(other)[1])["policy"]["enabled"]

    before={(r["tenant_id"],r["call_id"]) for r in database()}
    originate("a","8800000001","bad")
    time.sleep(1.5)
    assert not any((r["tenant_id"],r["call_id"]) not in before for r in database())
    EVIDENCE["invalid_sip_credential"]="no reservation and no active channel"
    clear_calls()
    before={(r["tenant_id"],r["call_id"]) for r in database()}
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(lambda _:originate("a","8800000001"),range(2)))
    race=new_rows(before,2)
    assert sorted(r["decision"] for r in race)==["allowed","capacity"],race
    first=next(r for r in race if r["decision"]=="allowed")
    EVIDENCE["capacity"]=next(r for r in race if r["decision"]=="capacity")
    assert "PJSIP/simulator" in ast("asterisk","core show channels concise")
    EVIDENCE["outbound"]=completed(first)
    assert EVIDENCE["outbound"]["result"]=="ANSWER"
    EVIDENCE["inbound"]=completed(scenario("a","8800000000","allowed","flora"))
    assert EVIDENCE["inbound"]["result"]=="ANSWER"
    EVIDENCE["missing_route"]=scenario("a","8800000009","route_missing","flora")
    EVIDENCE["busy"]=completed(scenario("a","8800000002","allowed"))
    assert EVIDENCE["busy"]["result"]=="BUSY"
    EVIDENCE["timeout"]=completed(scenario("a","8800000003","allowed"))
    assert EVIDENCE["timeout"]["result"]=="NOANSWER"
    assert request(admin,"PUT",dict(policy,attempts=1))[0]==204
    EVIDENCE["attempt_limit"]=scenario("a","8800000001","attempt_limit")
    assert request(admin,"PUT",dict(policy,trunk_enabled=False))[0]==204
    EVIDENCE["trunk_disabled"]=scenario("a","8800000001","trunk_disabled")
    clear_calls()
    EVIDENCE["active_channels"]=0


if __name__=="__main__":
    output=Path(os.environ.get("SIP_LAB_EVIDENCE_DIR", ROOT/"docs/evidence/phase-03a"))/"sip.json"
    output.parent.mkdir(parents=True,exist_ok=True)
    try:
        test()
        EVIDENCE["result"]="PASS"
    except Exception as error:
        EVIDENCE["result"]="FAIL"
        EVIDENCE["failure"]=str(error)
        raise
    finally:
        output.write_text(json.dumps(EVIDENCE,indent=2)+"\n")
