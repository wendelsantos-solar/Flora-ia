#!/bin/sh
set -eu
install -d -m 0700 -o asterisk -g asterisk /var/log/asterisk/sip-lab
su-exec asterisk python3 -I /opt/flora/gate.py replay &
exec /bin/sh /entrypoint.sh
