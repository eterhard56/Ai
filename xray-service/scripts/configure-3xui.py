#!/usr/bin/env python3
"""Configure 3X-UI: login, VLESS Reality inbound, subscription."""
import argparse
import json
import re
import secrets
import sys
import uuid
import urllib.request
import http.cookiejar


def get_csrf(html: str) -> str:
    m = re.search(r'csrf-token" content="([^"]+)"', html)
    if not m:
        raise RuntimeError("CSRF token not found")
    return m.group(1)


def request(cj, base: str, csrf: str, path: str, data=None, method="POST"):
    url = f"{base}{path}"
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, method=method)
    if body:
        req.add_header("Content-Type", "application/json")
    req.add_header("X-CSRF-Token", csrf)
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    with opener.open(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def login(cj, base: str, csrf: str, username: str, password: str):
    res = request(cj, base, csrf, "/login", {"username": username, "password": password})
    if not res.get("success"):
        raise RuntimeError(f"Login failed: {res}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=2053)
    p.add_argument("--username", default="admin")
    p.add_argument("--old-password", default="admin")
    p.add_argument("--new-password", required=True)
    p.add_argument("--inbound-port", type=int, default=8444)
    p.add_argument("--client-email", default="admin")
    p.add_argument("--server-ip", required=True)
    args = p.parse_args()

    base = f"http://{args.host}:{args.port}"
    cj = http.cookiejar.CookieJar()

    with urllib.request.urlopen(f"{base}/", timeout=15) as resp:
        html = resp.read().decode()
    csrf = get_csrf(html)

    login(cj, base, csrf, args.username, args.old_password)
    request(cj, base, csrf, "/panel/setting/updateUser", {
        "username": args.username,
        "password": args.new_password,
    })
    login(cj, base, csrf, args.username, args.new_password)

    cert = request(cj, base, csrf, "/panel/api/server/getNewX25519Cert", method="GET")["obj"]
    priv, pub = cert["privateKey"], cert["publicKey"]
    short_id = secrets.token_hex(4)
    client_uuid = str(uuid.uuid4())

    stream = {
        "network": "tcp",
        "security": "reality",
        "externalProxy": [],
        "realitySettings": {
            "show": False,
            "xver": 0,
            "dest": "www.microsoft.com:443",
            "serverNames": ["www.microsoft.com"],
            "privateKey": priv,
            "minClientVer": "",
            "maxClientVer": "",
            "maxTimediff": 0,
            "shortIds": [short_id, ""],
            "settings": {
                "publicKey": pub,
                "fingerprint": "chrome",
                "serverName": "",
                "spiderX": "/",
            },
        },
        "tcpSettings": {"acceptProxyProtocol": False, "header": {"type": "none"}},
    }
    settings = {
        "clients": [{
            "id": client_uuid,
            "flow": "xtls-rprx-vision",
            "email": args.client_email,
            "limitIp": 0,
            "totalGB": 0,
            "expiryTime": 0,
            "enable": True,
            "tgId": "",
            "subId": "happ-admin",
            "reset": 0,
        }],
        "decryption": "none",
        "fallbacks": [],
    }
    inbound = {
        "up": 0, "down": 0, "total": 0,
        "remark": "vless-reality-happ",
        "enable": True, "expiryTime": 0,
        "listen": "", "port": args.inbound_port, "protocol": "vless",
        "settings": json.dumps(settings),
        "streamSettings": json.dumps(stream),
        "sniffing": json.dumps({
            "enabled": True,
            "destOverride": ["http", "tls", "quic", "fakedns"],
            "metadataOnly": False,
            "routeOnly": False,
        }),
    }

    result = request(cj, base, csrf, "/panel/api/inbounds/add", inbound)
    if not result.get("success"):
        print(json.dumps(result, indent=2), file=sys.stderr)
        raise RuntimeError(result.get("msg", "add inbound failed"))

    panel_settings = request(cj, base, csrf, "/panel/api/setting/all")["obj"]
    panel_settings.update({
        "subEnable": True,
        "subJsonEnable": True,
        "subURI": f"http://{args.server_ip}:2087/sub/",
        "subPath": "/sub/",
        "subPort": "2096",
        "subDomain": args.server_ip,
    })
    request(cj, base, csrf, "/panel/api/setting/update", panel_settings)
    request(cj, base, csrf, "/panel/api/server/restartXrayService", None)

    print(json.dumps({
        "uuid": client_uuid,
        "short_id": short_id,
        "private_key": priv,
        "public_key": pub,
    }))


if __name__ == "__main__":
    main()
