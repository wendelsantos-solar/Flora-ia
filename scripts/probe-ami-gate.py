#!/usr/bin/env python3
"""Harmless wire verification: checks real gate, not a mocked server."""
import json
import os
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parents[1]
output = pathlib.Path(os.environ.get("AMI_PROBE_OUTPUT", root / "docs/evidence/phase-02-5/ami-gate.json"))
denial = "Action denied by Flora AMI gate"
checks = {}
timeout = float(os.environ.get("AMI_PROBE_TIMEOUT", "6"))
for host, suffix in (("asterisk", ""), ("asterisk-b", "_B")):
    for role, prefix in (("observer", "AMI"), ("queue-controller", "QUEUE_AMI")):
        for action in ("GetConfig", "Command", "Originate", "Reload", "foreign-queue"):
            line = {
                "GetConfig": "Action: GetConfig\r\nFilename: logger.conf",
                "Command": "Action: Command\r\nCommand: core show version",
                "Originate": "Action: Originate",
                "Reload": "Action: Reload\r\nModule: not-a-module.so",
                "foreign-queue": "Action: QueuePause\r\nQueue: t99999999-9999-4999-8999-999999999999-301\r\nInterface: PJSIP/202\r\nPaused: true",
            }[action]
            env = f"{prefix}{suffix}_PASSWORD"
            mode = "on" if role == "observer" else "off"
            # Keep passwords inside the existing backend container; never print request frames.
            cmd = (
                f'{{ printf "Action: Login\\r\\nUsername: {role}\\r\\nSecret: %s\\r\\nEvents: {mode}\\r\\n\\r\\n" "${env}"; '
                'sleep 0.15; printf "%s\\r\\n\\r\\n" "$1"; } | nc -w 2 "$2" 5038'
            )
            reply = subprocess.run(
                ["docker", "compose", "exec", "-T", "backend", "sh", "-c", cmd, "probe", line, host],
                cwd=root, text=True, capture_output=True, timeout=timeout, check=False,
            ).stdout
            checks[f"{host}/{role}/{action}"] = denial in reply
    for port in (5039,):
        response = subprocess.run(
            ["docker", "compose", "exec", "-T", "backend", "sh", "-c", 'sleep 0.4 | nc -w 1 "$1" "$2"', "probe", host, str(port)],
            cwd=root, capture_output=True, timeout=timeout, check=False,
        )
        checks[f"{host}/native-ami-not-reachable"] = b"Asterisk Call Manager" not in response.stdout
    ari = subprocess.check_output(["docker", "compose", "exec", "-T", host, "asterisk", "-rx", "module show like res_ari"], cwd=root, text=True)
    checks[f"{host}/ari-unloaded"] = "0 modules loaded" in ari
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(checks, indent=2) + "\n")
print(f"{sum(checks.values())}/{len(checks)} AMI/ARI checks passed")
raise SystemExit(0 if all(checks.values()) else 1)
