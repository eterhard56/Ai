#!/usr/bin/env bash
# Enable HTTPS subscription on port 443 for Happ (ATS requires HTTPS + domain).
set -euo pipefail

SNIPPET_SRC="/opt/xray-service/configs/nginx-subscription-snippet.conf"
SNIPPET_DST="/etc/nginx/snippets/xray-subscription.conf"
CLIENT_FINDER="/etc/nginx/sites-available/client-finder"
MARKER="include /etc/nginx/snippets/xray-subscription.conf;"

if [ ! -f "$SNIPPET_SRC" ]; then
  echo "Missing $SNIPPET_SRC" >&2
  exit 1
fi

install -m 644 "$SNIPPET_SRC" "$SNIPPET_DST"

if ! grep -qF "$MARKER" "$CLIENT_FINDER"; then
  cp -a "$CLIENT_FINDER" "${CLIENT_FINDER}.bak-xray-sub-$(date +%Y%m%d%H%M%S)"
  python3 - <<'PY'
from pathlib import Path

path = Path("/etc/nginx/sites-available/client-finder")
text = path.read_text()
marker = "    include /etc/nginx/snippets/xray-subscription.conf;"
needle = "    location / {\n        proxy_pass http://127.0.0.1:3000;"
if marker in text:
    print("Snippet already included")
elif needle not in text:
    raise SystemExit("client-finder nginx layout changed; add snippet manually")
else:
    text = text.replace(needle, marker + "\n\n" + needle, 1)
    path.write_text(text)
    print("Added subscription snippet include to client-finder")
PY
fi

nginx -t
systemctl reload nginx
echo "HTTPS subscription enabled on https://skolesnikov.site/sub/"
