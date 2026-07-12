#!/usr/bin/env python3
"""Generate VLESS link, subscription URL, JSON config for Happ."""
import argparse
import json
import re
import urllib.parse
from pathlib import Path


def parse_credentials(path: Path) -> dict:
    data = {}
    for line in path.read_text().splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            data[k.strip()] = v.strip()
    return data


def build_vless_link(c: dict) -> str:
    params = {
        "encryption": "none",
        "flow": "xtls-rprx-vision",
        "security": "reality",
        "sni": c["Reality Server Name (SNI)"],
        "fp": c["Fingerprint"],
        "pbk": c["Public Key"],
        "sid": c["Short ID"],
        "type": "tcp",
    }
    q = urllib.parse.urlencode(params)
    return (
        f"vless://{c['UUID']}@{c['Server IP']}:{c['Inbound Port']}"
        f"?{q}#{urllib.parse.quote('admin-happ')}"
    )


def build_json_config(c: dict) -> dict:
    return {
        "remarks": "admin-happ",
        "protocol": "vless",
        "address": c["Server IP"],
        "port": int(c["Inbound Port"]),
        "id": c["UUID"],
        "flow": "xtls-rprx-vision",
        "encryption": "none",
        "network": "tcp",
        "security": "reality",
        "sni": c["Reality Server Name (SNI)"],
        "fp": c["Fingerprint"],
        "pbk": c["Public Key"],
        "sid": c["Short ID"],
        "spx": "/",
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--credentials", required=True)
    p.add_argument("--sub-domain", default="")
    p.add_argument("--server-ip", required=True)
    p.add_argument("--output", required=True)
    args = p.parse_args()

    c = parse_credentials(Path(args.credentials))
    vless = build_vless_link(c)
    sub_domain = args.sub_domain or args.server_ip
    sub_url = f"https://{sub_domain}/sub/happ-admin"

    out = {
        "panel_url": f"http://{args.server_ip}:2083/",
        "panel_login": c.get("Panel Login", "admin"),
        "panel_password": c.get("Panel Password", ""),
        "uuid": c["UUID"],
        "public_key": c["Public Key"],
        "short_id": c["Short ID"],
        "reality_sni": c["Reality Server Name (SNI)"],
        "subscription_url": sub_url,
        "vless_link": vless,
        "json_config": build_json_config(c),
    }

    Path(args.output).write_text(json.dumps(out, indent=2, ensure_ascii=False))
    Path(args.credentials).parent.joinpath("vless-link.txt").write_text(vless + "\n")
    print(json.dumps(out, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
