#!/usr/bin/env python3
"""Run historical browser cases in the private flora-026 lab."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
import uuid

root = Path(__file__).resolve().parents[1]
lab = root / ".local/phase-02-6/lab"
compose = ["docker", "compose", "-p", "flora-026", "-f", str(lab / "reliability.json")]
container = subprocess.check_output([*compose, "ps", "-q", "client1"], text=True).strip()
assert container
run = "/tmp/flora-regressions-" + uuid.uuid4().hex
evidence = Path(os.environ.get("FLORA_REGRESSION_EVIDENCE", root / "docs/evidence/phase-03a-2/historical"))
browser = os.environ.get("FLORA_REGRESSION_BROWSER", "chromium")
fixture_start = int(os.environ.get("FLORA_REGRESSION_QUEUE_START", "391"))
assert 300 <= fixture_start <= 397
fixture_suffix = "" if fixture_start == 391 else f"-{fixture_start}"
assert browser in ("chromium", "chrome")

evidence.mkdir(parents=True, exist_ok=True)

def command(*args, **kwargs):
    return subprocess.run(["docker", "exec", container, *args], **kwargs)

with tempfile.TemporaryDirectory() as tmp:
    staging = Path(tmp)
    web = staging / "web"
    (web / "tests").mkdir(parents=True)
    (staging / ".local").mkdir()
    shutil.copy(lab / "env", staging / ".env")
    os.chmod(staging / ".env", 0o600)
    specs = ["telephony", "operations", "homologacao"]
    for optional in ("hardening", "mesa"):
        if any(f"{optional}.spec.ts" in arg for arg in sys.argv[1:]):
            specs.append(optional)
    for spec in specs:
        name = f"{spec}.spec.ts"
        source = (root / "web/tests" / name).read_text().replace("http://localhost:13400", "https://lab.flora.test")
        # The explicit WebSocket origin tests also use the private HTTPS origin.
        source = source.replace("ws://localhost:13400", "wss://lab.flora.test")
        if spec == "operations" and fixture_suffix:
            source = re.sub(r"\b39[123]\b", lambda m: str(fixture_start + int(m[0]) - 391), source)
            source = re.sub(r"homologacao-(02a|origem|destino)", lambda m: m[0] + fixture_suffix, source)
        (web / "tests" / name).write_text(source)
    config = """import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',workers:1,timeout:150000,reporter:'list',
 projects:[{name:'chromium',use:{channel:'chromium'}}],
 use:{baseURL:'https://lab.flora.test',headless:true,
 launchOptions:{args:['--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']}}});
"""
    (web / "playwright.config.ts").write_text(config.replace("name:'chromium',use:{channel:'chromium'}", f"name:'{browser}',use:{{channel:'{browser}'}}").replace("launchOptions:{args:", "launchOptions:{executablePath:'/opt/google/chrome/chrome',args:" if browser == "chrome" else "launchOptions:{args:"))
    modules = web / "node_modules"
    for name in ("@playwright/test", "playwright", "playwright-core"):
        shutil.copytree(root / "web/node_modules" / name, modules / name)
    (staging / "bin").mkdir()
    shim = staging / "bin/docker"
    shim.write_text("""#!/bin/sh
set -eu
id=$$
printf '%s\n' "$@" > "$FLORA_RELAY/$id.tmp"
mv "$FLORA_RELAY/$id.tmp" "$FLORA_RELAY/$id.req"
while [ ! -f "$FLORA_RELAY/$id.rc" ]; do sleep .2; done
cat "$FLORA_RELAY/$id.out"
exit "$(cat "$FLORA_RELAY/$id.rc")"
""")
    shim.chmod(0o755)
    command("mkdir", "-p", run + "/relay", check=True)
    subprocess.run(["docker", "cp", str(staging) + "/.", container + ":" + run], check=True)

def allowed(args):
    if args == ["compose", "exec", "-T", "asterisk", "asterisk", "-rx", "core show channels count"]:
        return True
    if args in (["compose", "exec", "-T", "asterisk", "asterisk", "-rx", "queue show"],
                ["compose", "exec", "-T", "asterisk", "asterisk", "-rx", f"dialplan show {fixture_start + 2}@internal-only"]):
        return True
    return args in [["compose", action, service] for action, service in
                    (("restart", "asterisk"), ("stop", "backend"), ("start", "backend"),
                     ("pause", "asterisk"), ("unpause", "asterisk"))]

test_args = sys.argv[1:] or ["--grep-invert", "incoming INVITE"]
log_name = "telephony-retest.log" if sys.argv[1:] else "chromium.log"
def snapshot():
    engines = {}
    for name in ("asterisk", "asterisk-b"):
        counts = subprocess.check_output([*compose, "exec", "-T", name, "asterisk", "-rx",
            "core show channels count"], text=True, timeout=15)
        contacts = subprocess.check_output([*compose, "exec", "-T", name, "asterisk", "-rx",
            "pjsip show contacts"], text=True, timeout=15)
        engines[name] = {"active": int(re.search(r"(\d+) active channels", counts)[1]),
                         "registered_contacts": len(re.findall(r"^\s+Contact:", contacts, re.M))}
    def sql(statement):
        return subprocess.check_output([*compose, "exec", "-T", "db", "psql", "-U", "postgres",
            "-d", "flora", "-At", "-v", "ON_ERROR_STOP=1", "-c", statement], text=True, timeout=15).strip()
    open_sessions = int(sql("SELECT count(*) FROM call_sessions WHERE ended_at IS NULL"))
    active_reservations = None
    if sql("SELECT to_regclass('public.sip_lab_calls')"):
        active_reservations = int(sql("SELECT count(*) FROM sip_lab_calls WHERE ended_at IS NULL AND expires_at > clock_timestamp()"))
    ready = command("curl", "-fsS", "--max-time", "5", "https://lab.flora.test/api/health/ready",
                    capture_output=True, text=True).returncode == 0
    return {"engines": engines, "ready": ready, "open_sessions": open_sessions, "active_reservations": active_reservations}

def wait_clean():
    deadline = time.monotonic() + 75
    while True:
        state = snapshot()
        if (state["ready"] and state["open_sessions"] == 0 and not state["active_reservations"]
            and all(engine["active"] == 0 for engine in state["engines"].values())):
            return state
        if time.monotonic() >= deadline:
            raise RuntimeError(f"Private lab did not reach clean state: {state}")
        time.sleep(2)

if os.environ.get("FLORA_REGRESSION_PREFLIGHT") == "1":
    (evidence / "before.json").write_text(json.dumps(wait_clean(), indent=2) + "\n")

with (evidence / log_name).open("w") as log:
    worker = subprocess.Popen(["docker", "exec", "-e", "FLORA_CONSECUTIVE_CALLS=" + os.environ.get("FLORA_CONSECUTIVE_CALLS", ""), container, "sh", "-c",
        'export PATH="$1/bin:$PATH" FLORA_RELAY="$1/relay"; cd "$1/web"; shift; node node_modules/@playwright/test/cli.js test "$@"',
        "runner", run, *test_args], stdout=log, stderr=subprocess.STDOUT)
    try:
        while worker.poll() is None:
            files = command("ls", run + "/relay", capture_output=True, text=True, check=True).stdout.splitlines()
            for name in files:
                if not re.fullmatch(r"[0-9]+\.req", name):
                    continue
                path = run + "/relay/" + name[:-4]
                args = command("cat", path + ".req", capture_output=True, text=True, check=True).stdout.splitlines()
                command("unlink", path + ".req", check=True)
                if allowed(args):
                    result = subprocess.run([*compose, *args[1:]], capture_output=True, text=True, timeout=40)
                    out, code = result.stdout + result.stderr, result.returncode
                else:
                    out, code = "Command not allowed in private regression", 1
                subprocess.run(["docker", "exec", "-i", container, "sh", "-c",
                    'cat > "$1.out"; printf "%s" "$2" > "$1.rc"', "relay", path, str(code)],
                    input=out, text=True, check=True)
            time.sleep(.3)
    finally:
        if worker.poll() is None:
            worker.terminate()
        # Ensure a failed resilience case cannot leave the isolated engine paused or the backend stopped.
        subprocess.run([*compose, "unpause", "asterisk"], capture_output=True)
        subprocess.run([*compose, "start", "backend"], capture_output=True)
        cases = evidence / "cases"
        cases.mkdir(exist_ok=True)
        subprocess.run(["docker", "cp", container + ":" + run + "/docs/evidence/.", str(cases)], capture_output=True)
        command("python3", "-c", "import shutil,sys; shutil.rmtree(sys.argv[1])", run, check=True)
    if os.environ.get("FLORA_REGRESSION_PREFLIGHT") == "1":
        (evidence / "after.json").write_text(json.dumps(snapshot(), indent=2) + "\n")
    raise SystemExit(worker.returncode)
