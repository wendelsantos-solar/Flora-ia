FROM alpine:3.23
RUN apk add --no-cache asterisk=20.15.2-r1 asterisk-srtp=20.15.2-r1 gettext-envsubst su-exec tzdata python3 && mkdir -p /var/log/asterisk/cel-custom /var/run/asterisk && chown -R asterisk:asterisk /var/log/asterisk /var/run/asterisk /var/lib/asterisk
COPY entrypoint.sh /entrypoint.sh
COPY ami_gate.py /ami_gate.py
ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
