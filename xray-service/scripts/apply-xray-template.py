#!/usr/bin/env python3
"""Apply standard 3X-UI Xray template: freedom + dns-out for client internet."""
import json
import sqlite3
import sys


TEMPLATE = {
    "log": {
        "access": "/var/log/x-ui/access.log",
        "error": "/var/log/x-ui/error.log",
        "loglevel": "warning",
        "dnsLog": True,
    },
    "api": {
        "services": [
            "HandlerService",
            "LoggerService",
            "StatsService",
            "RoutingService",
        ],
        "tag": "api",
    },
    "dns": {
        "servers": ["1.1.1.1", "8.8.8.8"],
        "queryStrategy": "UseIPv4",
        "disableCache": False,
        "tag": "dns-internal",
    },
    "routing": {
        "domainStrategy": "IPIfNonMatch",
        "rules": [
            {"type": "field", "inboundTag": ["api"], "outboundTag": "api"},
            {
                "type": "field",
                "port": "53",
                "network": "udp,tcp",
                "outboundTag": "dns-out",
            },
            {
                "type": "field",
                "protocol": ["bittorrent"],
                "outboundTag": "blocked",
            },
        ],
    },
    "policy": {
        "levels": {
            "0": {
                "statsUserDownlink": True,
                "statsUserUplink": True,
                "statsUserOnline": True,
            }
        },
        "system": {"statsInboundDownlink": True, "statsInboundUplink": True},
    },
    "inbounds": [
        {
            "listen": "127.0.0.1",
            "port": 62789,
            "protocol": "dokodemo-door",
            "settings": {"address": "127.0.0.1"},
            "tag": "api",
        }
    ],
    "outbounds": [
        {
            "tag": "direct",
            "protocol": "freedom",
            "settings": {"domainStrategy": "UseIPv4"},
        },
        {"tag": "blocked", "protocol": "blackhole", "settings": {}},
        {
            "tag": "dns-out",
            "protocol": "dns",
            "settings": {"network": "udp,tcp"},
        },
    ],
    "stats": {},
    "metrics": {"tag": "metrics_out", "listen": "127.0.0.1:11111"},
}


def main():
    db_path = sys.argv[1] if len(sys.argv) > 1 else "/opt/xray-service/data/db/x-ui.db"
    val = json.dumps(TEMPLATE, ensure_ascii=False)
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("DELETE FROM settings WHERE key=?", ("xrayTemplateConfig",))
    cur.execute("INSERT INTO settings(key,value) VALUES(?,?)", ("xrayTemplateConfig", val))
    conn.commit()
    conn.close()
    print(json.dumps({"ok": True, "db": db_path}, indent=2))


if __name__ == "__main__":
    main()
