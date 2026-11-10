#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
base=.local/phase-02-6
compose() { docker compose -p flora-026 -f "$base/lab/compose.json" "$@"; }
wait_log() {
    seconds=0
    until rg -q "^$1$" "$log"; do
        kill -0 "$pid" 2>/dev/null || { cat "$log"; return 1; }
        [ "$seconds" -lt 130 ] || return 1
        sleep 1
        seconds=$((seconds+1))
    done
}
case "${1:-}" in
    backend-outage) svc=backend;;
    db-outage) svc=db;;
    pbx-restart) svc=asterisk;;
    *) echo "Usage: $0 backend-outage|db-outage|pbx-restart" >&2; exit 2;;
esac
log="$base/$1.log"
marker=docs/evidence/phase-02-6/pbx-restored
if [ "$1" = pbx-restart ]; then rm -f "$marker"; fi
compose exec -T control node /app/verify.cjs "$1" >"$log" 2>&1 &
pid=$!
wait_log OUTAGE_READY
trap 'compose start "$svc" >/dev/null 2>&1 || true; if [ "$1" = pbx-restart ]; then rm -f "$marker"; fi' EXIT
if [ "$1" = pbx-restart ]; then
    compose restart "$svc"
    touch "$marker"
else
    compose stop "$svc"
    wait_log CALL_FINISHED
    compose start "$svc"
fi
wait "$pid"
