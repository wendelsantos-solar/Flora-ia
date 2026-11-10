#!/usr/bin/env python3
"""One-time local migration from shared DB credentials. Does not print secrets."""
import os
import pathlib
import re
import secrets
import subprocess
import tempfile

root = pathlib.Path(__file__).resolve().parents[1]
env = root / ".env"
lines = env.read_text().splitlines()
values = dict(line.split("=", 1) for line in lines if "=" in line and not line.startswith("#"))
if values.get("POSTGRES_CREDENTIALS_SPLIT") == "1":
    print("PostgreSQL credentials already separated.")
    raise SystemExit(0)
app = values.get("POSTGRES_APP_PASSWORD", "")
if not re.fullmatch(r"[A-Za-z0-9_-]{32,128}", app):
    raise SystemExit("Run scripts/bootstrap.py first.")
admin = secrets.token_hex(24)
lines = ["POSTGRES_PASSWORD=" + admin if l.startswith("POSTGRES_PASSWORD=") else l for l in lines]
lines.append("POSTGRES_CREDENTIALS_SPLIT=1")
fd, temp = tempfile.mkstemp(prefix=".flora-env-", dir=root / ".local")
try:
    with os.fdopen(fd, "w") as out:
        out.write("\n".join(lines) + "\n")
    sql = f"BEGIN; ALTER ROLE postgres PASSWORD '{admin}'; ALTER ROLE flora_app PASSWORD '{app}'; COMMIT;"
    process = subprocess.run(
        ["docker", "compose", "exec", "-T", "db", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "flora"],
        cwd=root, input=sql, text=True, capture_output=True, timeout=20, check=False,
    )
    if process.returncode:
        raise SystemExit("Credential change did not complete. Inspect the local database before retrying.")
    os.replace(temp, env)
    print("PostgreSQL app credential separated and previous admin password revoked.")
finally:
    if os.path.exists(temp):
        os.unlink(temp)
