import json
import logging
import re
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)


class X3UIClient:
    """Async client for 3X-UI panel API."""

    def __init__(self, panel_url: str, username: str, password: str):
        self.panel_url = panel_url.rstrip("/")
        self.username = username
        self.password = password
        self._csrf: Optional[str] = None
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=60.0,
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; VPNBot/1.0)",
                    "Referer": f"{self.panel_url}/",
                },
                follow_redirects=True,
            )
        return self._client

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    async def _fetch_csrf(self) -> str:
        client = await self._get_client()
        resp = await client.get(f"{self.panel_url}/")
        resp.raise_for_status()
        match = re.search(r'csrf-token" content="([^"]+)"', resp.text)
        if not match:
            raise RuntimeError("CSRF token not found in 3X-UI panel")
        self._csrf = match.group(1)
        return self._csrf

    async def _request(
        self,
        method: str,
        path: str,
        data: Optional[dict] = None,
    ) -> dict[str, Any]:
        if not self._csrf:
            await self._fetch_csrf()
        client = await self._get_client()
        headers = {"X-CSRF-Token": self._csrf or ""}
        if data is not None:
            headers["Content-Type"] = "application/json"
        resp = await client.request(
            method,
            f"{self.panel_url}{path}",
            headers=headers,
            content=json.dumps(data) if data is not None else None,
        )
        if resp.status_code == 403:
            await self._fetch_csrf()
            headers["X-CSRF-Token"] = self._csrf or ""
            resp = await client.request(
                method,
                f"{self.panel_url}{path}",
                headers=headers,
                content=json.dumps(data) if data is not None else None,
            )
        resp.raise_for_status()
        return resp.json()

    async def login(self) -> None:
        result = await self._request(
            "POST",
            "/login",
            {"username": self.username, "password": self.password},
        )
        if not result.get("success"):
            raise RuntimeError(f"3X-UI login failed: {result}")

    async def get_inbound(self, inbound_id: int) -> dict[str, Any]:
        result = await self._request("GET", f"/panel/api/inbounds/get/{inbound_id}")
        if not result.get("success"):
            raise RuntimeError(f"get inbound failed: {result}")
        return result["obj"]

    async def list_inbounds(self) -> list[dict[str, Any]]:
        result = await self._request("GET", "/panel/api/inbounds/list")
        if not result.get("success"):
            raise RuntimeError(f"list inbounds failed: {result}")
        return result.get("obj", [])

    async def add_client(
        self,
        inbound_id: int,
        client_uuid: str,
        email: str,
        sub_id: str,
        tg_id: int,
        expiry_time_ms: int = 0,
        total_gb: int = 0,
        limit_ip: int = 0,
        flow: str = "xtls-rprx-vision",
    ) -> dict[str, Any]:
        client_obj = {
            "id": client_uuid,
            "email": email,
            "limitIp": limit_ip,
            "totalGB": total_gb,
            "expiryTime": expiry_time_ms,
            "enable": True,
            "tgId": str(tg_id),
            "subId": sub_id,
            "flow": flow,
            "reset": 0,
        }
        payload = {"id": inbound_id, "settings": json.dumps({"clients": [client_obj]})}
        result = await self._request("POST", "/panel/api/inbounds/addClient", payload)
        if not result.get("success"):
            raise RuntimeError(f"addClient failed: {result}")
        await self.restart_xray()
        return result

    async def update_client_expiry(
        self,
        inbound_id: int,
        email: str,
        expiry_time_ms: int,
        enable: bool = True,
    ) -> None:
        inbound = await self.get_inbound(inbound_id)
        settings = inbound["settings"]
        if isinstance(settings, str):
            settings = json.loads(settings)
        clients = settings.get("clients", [])
        found = False
        for c in clients:
            if c.get("email") == email:
                c["expiryTime"] = expiry_time_ms
                c["enable"] = enable
                found = True
                break
        if not found:
            raise RuntimeError(f"Client {email} not found in inbound {inbound_id}")
        await self._update_inbound(inbound_id, inbound, settings)

    async def delete_client(self, inbound_id: int, client_uuid: str) -> None:
        payload = {"id": inbound_id, "clientId": client_uuid}
        result = await self._request("POST", "/panel/api/inbounds/delClient", payload)
        if not result.get("success"):
            raise RuntimeError(f"delClient failed: {result}")
        await self.restart_xray()

    async def _update_inbound(
        self, inbound_id: int, inbound: dict, settings: dict
    ) -> None:
        payload = {
            "id": inbound_id,
            "up": inbound.get("up", 0),
            "down": inbound.get("down", 0),
            "total": inbound.get("total", 0),
            "remark": inbound.get("remark", ""),
            "enable": inbound.get("enable", True),
            "expiryTime": inbound.get("expiryTime", 0),
            "listen": inbound.get("listen", ""),
            "port": inbound.get("port"),
            "protocol": inbound.get("protocol"),
            "settings": json.dumps(settings),
            "streamSettings": json.dumps(inbound["streamSettings"])
            if isinstance(inbound.get("streamSettings"), dict)
            else inbound.get("streamSettings", "{}"),
            "sniffing": json.dumps(inbound.get("sniffing", {}))
            if isinstance(inbound.get("sniffing"), dict)
            else inbound.get("sniffing", "{}"),
        }
        result = await self._request("POST", f"/panel/api/inbounds/update/{inbound_id}", payload)
        if not result.get("success"):
            raise RuntimeError(f"update inbound failed: {result}")
        await self.restart_xray()

    async def restart_xray(self) -> None:
        await self._request("POST", "/panel/api/server/restartXrayService", None)

    async def get_client_traffic(self, email: str) -> Optional[dict[str, Any]]:
        inbounds = await self.list_inbounds()
        for inbound in inbounds:
            for stat in inbound.get("clientStats") or []:
                if stat.get("email") == email:
                    return stat
        return None
