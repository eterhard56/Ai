from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class XrayServerConfig(BaseSettings):
    name: str
    panel_url: str
    username: str
    password: str
    inbound_id: int
    sub_domain: str
    sub_uri: str
    enabled: bool = True


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    bot_token: str
    admin_ids: str = ""

    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_db: str = "vpn_bot"
    postgres_user: str = "vpn_bot"
    postgres_password: str

    redis_url: str = "redis://redis:6379/0"

    trial_days: int = 3
    referral_bonus_days: int = 7
    payment_provider: str = "demo"
    yookassa_shop_id: str = ""
    yookassa_secret_key: str = ""
    default_sub_path: str = "/sub/"
    log_level: str = "INFO"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def admin_id_list(self) -> List[int]:
        if not self.admin_ids.strip():
            return []
        return [int(x.strip()) for x in self.admin_ids.split(",") if x.strip()]

    def load_servers(self) -> List[XrayServerConfig]:
        import os

        servers: List[XrayServerConfig] = []
        idx = 1
        while True:
            prefix = f"SERVER_{idx}_"
            if not os.getenv(f"{prefix}NAME"):
                break
            servers.append(
                XrayServerConfig(
                    name=os.getenv(f"{prefix}NAME", f"Server {idx}"),
                    panel_url=os.getenv(f"{prefix}PANEL_URL", ""),
                    username=os.getenv(f"{prefix}USERNAME", "admin"),
                    password=os.getenv(f"{prefix}PASSWORD", ""),
                    inbound_id=int(os.getenv(f"{prefix}INBOUND_ID", "1")),
                    sub_domain=os.getenv(f"{prefix}SUB_DOMAIN", ""),
                    sub_uri=os.getenv(f"{prefix}SUB_URI", ""),
                    enabled=os.getenv(f"{prefix}ENABLED", "true").lower() in ("1", "true", "yes"),
                )
            )
            idx += 1
        return [s for s in servers if s.enabled and s.panel_url]


@lru_cache
def get_settings() -> Settings:
    return Settings()
