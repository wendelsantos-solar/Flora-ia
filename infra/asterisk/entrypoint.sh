#!/bin/sh
set -eu
umask 027
mkdir -p /var/spool/flora-config
chown 1000:asterisk /var/spool/flora-config
chmod 0770 /var/spool/flora-config
for name in queues routes; do
  if [ ! -f "/var/spool/flora-config/$name.conf" ]; then touch "/var/spool/flora-config/$name.conf"; chmod 0644 "/var/spool/flora-config/$name.conf"; fi
done
for config in /templates/*.conf; do
  envsubst '${SIP_A_PASSWORD} ${SIP_B_PASSWORD} ${SIP_C_PASSWORD} ${EXT_A} ${EXT_B} ${EXT_C} ${EXT_PREFIX} ${PBX_TENANT} ${RTP_START} ${RTP_END} ${AMI_PASSWORD} ${QUEUE_AMI_PASSWORD} ${MEDIA_ADDRESS}' < "$config" > "/etc/asterisk/$(basename "$config")"
done
# Asterisk 20.22 moved shared CEL/CDR custom support into its own module.
if [ -f /usr/lib/asterisk/modules/res_cdrel_custom.so ]; then
  sed -i '/^load=cel_custom.so/i load=res_cdrel_custom.so' /etc/asterisk/modules.conf
  cp /templates/cel_custom.conf.v20_22 /etc/asterisk/cel_custom.conf
fi
chown -R root:asterisk /etc/asterisk
# The certificate directory is bind mounted and does not include the CA private key.
su-exec asterisk sh -c '
  dir=/var/spool/flora-config
  while :; do
    revision=$(cat "$dir/revision" 2>/dev/null || :)
    applied=$(cat "$dir/applied" 2>/dev/null || :)
    if [ -n "$revision" ] && [ "$revision" != "$applied" ] &&
       asterisk -rx "module reload app_queue.so" >/dev/null 2>&1 &&
       asterisk -rx "module reload pbx_config.so" >/dev/null 2>&1; then
      tmp=$(mktemp "$dir/.applied-XXXXXX")
      if [ -n "$tmp" ]; then
        printf "%s" "$revision" > "$tmp"
        chmod 0644 "$tmp"
        mv -f "$tmp" "$dir/applied"
      fi
    fi
    sleep 1
  done
' &
su-exec asterisk python3 -I /ami_gate.py &
exec su-exec asterisk asterisk -f
