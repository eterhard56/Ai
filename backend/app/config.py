from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "ai-platform"
    app_env: str = "production"
    secret_key: str = "change-me"
    debug: bool = False

    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_db: str = "ai_platform"
    postgres_user: str = "ai_platform"
    postgres_password: str = "change-me"

    redis_host: str = "redis"
    redis_port: int = 6379
    redis_password: str = ""

    ollama_host: str = "http://ollama:11434"
    ollama_model: str = "qwen3:8b"

    jwt_secret_key: str = "change-me-jwt"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    jwt_refresh_token_expire_days: int = 7

    telegram_bot_token: str = ""
    telegram_admin_chat_id: str = ""

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def database_url_sync(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def redis_url(self) -> str:
        if self.redis_password:
            return f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}/0"
        return f"redis://{self.redis_host}:{self.redis_port}/0"


@lru_cache
def get_settings() -> Settings:
    return Settings()
