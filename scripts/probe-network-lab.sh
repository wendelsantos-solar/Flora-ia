#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
compose() { docker compose -p flora-026 -f .local/phase-02-6/lab/compose.json "$@"; }
probe() { compose exec -T "$1" curl -sS --max-time 3 -o /dev/null -w '%{http_code}' "$2" 2>/dev/null || true; }
for i in 1 2 3 4; do
    client="client$i"
    [ "$(probe "$client" 'https://lab.flora.test/api/health/ready')" = 200 ]
    [ "$(probe "$client" 'https://lab.flora.test/api/v1/extensions')" = 401 ]
    case "$i" in 4) own=8444; foreign=8443;; *) own=8443; foreign=8444;; esac
    [ "$(probe "$client" "https://lab.flora.test:$own/ws")" = 403 ]
    [ "$(probe "$client" "https://lab.flora.test:$own/ari/asterisk/info")" = 404 ]
    [ "$(probe "$client" "https://lab.flora.test:$foreign/ws")" = 000 ]
    compose exec -T "$client" sh -ec '
       for addr in 10.252.26.3 10.252.26.19; do
         for port in 5038 5039 8088 8089; do
           if timeout 1 bash -c "true </dev/tcp/$addr/$port" 2>/dev/null; then
              echo "unexpected TCP reachability $addr:$port"; exit 1
           fi
         done
       done
    '
    printf '%s HTTPS ready, auth enforced, SIP edge scoped, AMI/ARI and raw PBX unreachable\n' "$client"
done
compose exec -T router wg show wg0 latest-handshakes | awk '$2>0 {n++} END {print n+0 " authenticated WireGuard handshakes"; exit(n!=4)}'
ids=$(compose ps -q)
docker inspect --format '{{range $port,$binding := .NetworkSettings.Ports}}{{if $binding}}PUBLISHED{{end}}{{end}}' $ids | awk 'NF{bad=1} END {print bad ? "unexpected published ports" : "zero published ports"; exit bad}'
