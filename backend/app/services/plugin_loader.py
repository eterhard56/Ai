import importlib.util
import os
import sys
from pathlib import Path
from typing import Any, Protocol

from app.core.logging import setup_logging

logger = setup_logging("plugin-loader")


class AgentPlugin(Protocol):
    name: str
    slug: str
    version: str

    async def run(self, config: dict[str, Any] | None = None) -> dict[str, Any]: ...
    async def health_check(self) -> bool: ...


class PluginLoader:
    def __init__(self, plugins_dir: str | None = None):
        default_dir = os.getenv("PLUGINS_DIR", "/app/config/plugins")
        self.plugins_dir = Path(plugins_dir or default_dir)
        self.plugins_dir.mkdir(parents=True, exist_ok=True)
        self._loaded: dict[str, Any] = {}

    def load_plugin(self, plugin_path: str) -> Any:
        if plugin_path in self._loaded:
            return self._loaded[plugin_path]

        path = Path(plugin_path)
        if not path.exists():
            path = self.plugins_dir / plugin_path

        if not path.exists():
            raise FileNotFoundError(f"Plugin not found: {plugin_path}")

        spec = importlib.util.spec_from_file_location(path.stem, path)
        if not spec or not spec.loader:
            raise ImportError(f"Cannot load plugin: {plugin_path}")

        module = importlib.util.module_from_spec(spec)
        sys.modules[path.stem] = module
        spec.loader.exec_module(module)

        if not hasattr(module, "Agent"):
            raise ImportError(f"Plugin {plugin_path} must export 'Agent' class")

        agent = module.Agent()
        self._loaded[plugin_path] = agent
        logger.info(f"Loaded plugin: {plugin_path}")
        return agent

    def list_available_plugins(self) -> list[str]:
        return [str(p) for p in self.plugins_dir.glob("*.py") if p.name != "__init__.py"]


plugin_loader = PluginLoader()
