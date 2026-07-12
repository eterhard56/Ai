"""Example plugin agent for AI Platform.

Place this file in config/plugins/ and register via API:
POST /api/v1/agents/plugins
"""

from typing import Any


class Agent:
    name = "Example Plugin"
    slug = "example-plugin"
    version = "1.0.0"

    async def run(self, config: dict[str, Any] | None = None) -> dict[str, Any]:
        return {"status": "ok", "message": "Plugin executed successfully"}

    async def health_check(self) -> bool:
        return True
