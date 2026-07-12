#!/usr/bin/env python3
"""Update 3X-UI subscription settings for HTTPS domain."""
import argparse
import json
import re
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


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=2053)
    p.add_argument("--username", default="admin")
    p.add_argument("--password", required=True)
    p.add_argument("--sub-domain", required=True)
    args = p.parse_args()

    base = f"http://{args.host}:{args.port}"
    cj = http.cookiejar.CookieJar()

    with urllib.request.urlopen(f"{base}/", timeout=15) as resp:
        html = resp.read().decode()
    csrf = get_csrf(html)

    res = request(cj, base, csrf, "/login", {"username": args.username, "password": args.password})
    if not res.get("success"):
        raise RuntimeError(f"Login failed: {res}")

    panel_settings = request(cj, base, csrf, "/panel/api/setting/all")["obj"]
    sub_uri = f"https://{args.sub_domain}/sub/"
    panel_settings.update({
        "subEnable": True,
        "subJsonEnable": True,
        "subURI": sub_uri,
        "subPath": "/sub/",
        "subPort": 2096,
        "subDomain": args.sub_domain,
        "subEncrypt": True,
        "subUpdates": 12,
    })
    result = request(cj, base, csrf, "/panel/api/setting/update", panel_settings)
    if not result.get("success"):
        raise RuntimeError(f"Settings update failed: {result}")

    print(json.dumps({
        "subURI": sub_uri,
        "subDomain": args.sub_domain,
        "subscription_url": f"{sub_uri}happ-admin",
    }, indent=2))


if __name__ == "__main__":
    main()
