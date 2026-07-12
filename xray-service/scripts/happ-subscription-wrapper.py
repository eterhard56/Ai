#!/usr/bin/env python3
"""Wrap 3X-UI subscription with Happ DNS + global routing directives."""
import base64
import json
import os
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

ROUTING_B64 = (
    "eyJOYW1lIjoiVlBOLUdsb2JhbCIsIkdsb2JhbFByb3h5IjoidHJ1ZSIsIlJlbW90ZUROU1R5cGUiOiJEb0giLCJS"
    "ZW1vdGVETlNEb21haW4iOiJodHRwczovL2Nsb3VkZmxhcmUtZG5zLmNvbS9kbnMtcXVlcnkiLCJSZW1vdGVETlNJUCI6"
    "IjEuMS4xLjEiLCJEb21lc3RpY0ROU1R5cGUiOiJEb1UiLCJEb21lc3RpY0ROU0RvbWFpbiI6IiIsIkRvbWVzdGljRE5TSVAi"
    "OiIxLjEuMS4xIiwiRG5zSG9zdHMiOnsiY2xvdWRmbGFyZS1kbnMuY29tIjoiMS4xLjEuMSIsImRucy5nb29nbGUiOiI4Ljgu"
    "OC44In0sIkRpcmVjdFNpdGVzIjpbXSwiRGlyZWN0SXAiOlsiMTAuMC4wLjAvOCIsIjE3Mi4xNi4wLjAvMTIiLCIxOTIu"
    "MTY4LjAuMC8xNiJdLCJQcm94eVNpdGVzIjpbXSwiUHJveHlJcCI6W10sIkJsb2NrU2l0ZXMiOltdLCJCbG9ja0lwIjpb"
    "XSwiRG9tYWluU3RyYXRlZ3kiOiJJUElmTm9uTWF0Y2giLCJGYWtlRE5TIjoiZmFsc2UifQ=="
)
PREFIX = (
    "#dns-from-json-enable: true\n"
    f"happ://routing/onadd/{ROUTING_B64}\n"
)
UPSTREAM = os.environ.get("XUI_SUB_UPSTREAM", "http://127.0.0.1:2096")


def wrap_subscription(path: str, host: str) -> bytes:
    req = urllib.request.Request(
        f"{UPSTREAM}{path}",
        headers={"Host": host, "User-Agent": "happ-subscription-wrapper/1.0"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()
    try:
        body = base64.b64decode(raw).decode()
    except Exception:
        body = raw.decode()
    # Public Reality endpoint is 443 (nginx stream SNI passthrough -> xray 8444)
    body = body.replace(":8444", ":443")
    wrapped = PREFIX + body
    return base64.b64encode(wrapped.encode())


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        host = self.headers.get("Host", "skolesnikov.site")
        try:
            payload = wrap_subscription(self.path, host)
        except Exception as exc:
            self.send_response(502)
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(exc)}).encode())
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("dns-from-json-enable", "true")
        self.send_header("routing-enable", "true")
        self.send_header("profile-update-interval", "12")
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt, *args):
        return


def main():
    port = int(os.environ.get("HAPP_SUB_PORT", "2097"))
    HTTPServer(("127.0.0.1", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
