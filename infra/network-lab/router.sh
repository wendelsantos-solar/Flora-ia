#!/bin/sh
set -eu
# All changes below affect only this disposable container namespace.
iptables -P FORWARD DROP
iptables -A FORWARD -m conntrack --ctstate INVALID -j DROP
iptables -A FORWARD -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A FORWARD -i wg0 -d 10.252.26.51/32 -p tcp --dport 443 -j ACCEPT
for n in 8 9 10 24; do
  host="10.252.26.$n"
  if [ "$n" = 24 ]; then sip=8444; pbx=10.252.26.19; rtp=18100:18120
  else sip=8443; pbx=10.252.26.3; rtp=18000:18020
  fi
  iptables -A FORWARD -i wg0 -s "$host/32" -d 10.252.26.51/32 -p tcp --dport "$sip" -j ACCEPT
  iptables -A FORWARD -i wg0 -s "$host/32" -d "$pbx/32" -p udp --dport "$rtp" -j ACCEPT
  iptables -A FORWARD -o wg0 -s "$pbx/32" -d "$host/32" -p udp --sport "$rtp" -j ACCEPT
done
iptables -A FORWARD -i wg0 -j DROP
for host in 10.252.26.8 10.252.26.9 10.252.26.10 10.252.26.24; do
  iptables -t nat -A POSTROUTING -s "$host/32" -d 10.252.26.51/32 -j MASQUERADE
done
ip link add wg0 type wireguard
wg setconf wg0 /run/flora/wg.conf
ip addr add 10.253.26.1/32 dev wg0
ip link set wg0 mtu 1380 up
# Asterisk sees each peer as a distinct on-link host on its own bridge.
# Explicit proxy ARP lets the private Docker bridge pass the return path.
for n in 8 9 10 24; do
  host="10.252.26.$n"
  if [ "$n" = 24 ]; then pbx=10.252.26.19; else pbx=10.252.26.3; fi
  iface=$(ip route get "$pbx" | awk '{for (i=1;i<NF;i++) if ($i=="dev") print $(i+1)}')
  ip route replace "$host/32" dev wg0
  ip neigh replace proxy "$host" dev "$iface"
done
exec sleep infinity
