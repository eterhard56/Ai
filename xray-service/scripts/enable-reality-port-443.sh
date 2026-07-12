#!/bin/bash
# Enable nginx stream SNI routing: 443 -> Xray Reality (cloudflare SNI) or nginx HTTPS (8443)
set -euo pipefail

STREAM_CONF_SRC="${1:-/opt/xray-service/configs/nginx-stream-reality.conf}"
STREAM_CONF_DST="/etc/nginx/stream.d/xray-reality.conf"
CLIENT_FINDER="/etc/nginx/sites-enabled/client-finder"

if ! nginx -V 2>&1 | grep -q with-stream; then
  apt-get install -y libnginx-mod-stream
fi

mkdir -p /etc/nginx/stream.d
cp "$STREAM_CONF_SRC" "$STREAM_CONF_DST"

if ! grep -q 'stream.d' /etc/nginx/nginx.conf; then
  sed -i '/^http {/i stream {\n    include /etc/nginx/stream.d/*.conf;\n}\n' /etc/nginx/nginx.conf
fi

if grep -q 'listen 443 ssl' "$CLIENT_FINDER"; then
  sed -i 's/listen 443 ssl http2;/listen 8443 ssl http2;/g' "$CLIENT_FINDER"
  sed -i 's/listen \[::\]:443 ssl http2;/listen [::]:8443 ssl http2;/g' "$CLIENT_FINDER"
fi

nginx -t
systemctl reload nginx
echo "OK: stream 443 active, nginx HTTPS on 8443"
