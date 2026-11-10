#!/bin/sh
set -eu
if [ "${FLORA_CONTROL:-}" = 1 ]; then exec sleep infinity; fi
ip link add wg0 type wireguard
wg setconf wg0 /run/flora/wg.conf
ip addr add "$FLORA_WG_IP/32" dev wg0
ip link set wg0 mtu 1380 up
ip route add 10.252.26.0/26 dev wg0 src "$FLORA_WG_IP"
cp /run/flora/root.crt /usr/local/share/ca-certificates/flora-lab.crt
update-ca-certificates >/dev/null
mkdir -p "$HOME/.pki/nssdb"
if [ ! -f "$HOME/.pki/nssdb/cert9.db" ]; then certutil -N -d "sql:$HOME/.pki/nssdb" --empty-password; fi
certutil -A -d "sql:$HOME/.pki/nssdb" -n 'Flora disposable network CA' -t 'C,,' -i /run/flora/root.crt
# Firefox on Linux uses its own trust store. Scope this policy to the disposable image.
cd /app
node -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const { firefox } = require("playwright");
  const dir = path.join(path.dirname(firefox.executablePath()), "distribution");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "policies.json"), JSON.stringify({
    policies: { Certificates: { Install: ["/run/flora/root.crt"] } },
  }));
'
export NODE_EXTRA_CA_CERTS=/run/flora/root.crt
exec node /app/browser-server.cjs
