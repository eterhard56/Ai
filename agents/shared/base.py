"""Shared utilities for AI Platform agents."""

import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path

import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def setup_agent_logging(name: str) -> logging.Logger:
    log_dir = os.getenv("LOG_DIR", "/app/logs")
    Path(log_dir).mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    if logger.handlers:
        return logger

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
    )
    console = logging.StreamHandler()
    console.setFormatter(formatter)
    logger.addHandler(console)

    fh = RotatingFileHandler(f"{log_dir}/{name}.log", maxBytes=10 * 1024 * 1024, backupCount=5)
    fh.setFormatter(formatter)
    logger.addHandler(fh)
    return logger


def get_db_session():
    host = os.getenv("POSTGRES_HOST", "postgres")
    port = os.getenv("POSTGRES_PORT", "5432")
    db = os.getenv("POSTGRES_DB", "ai_platform")
    user = os.getenv("POSTGRES_USER", "ai_platform")
    password = os.getenv("POSTGRES_PASSWORD", "change-me")
    url = f"postgresql://{user}:{password}@{host}:{port}/{db}"
    engine = create_engine(url, pool_pre_ping=True)
    return sessionmaker(bind=engine)()


class OllamaClient:
    def __init__(self):
        self.host = os.getenv("OLLAMA_HOST", "http://ollama:11434")
        self.model = os.getenv("OLLAMA_MODEL", "qwen3:8b")

    async def generate(self, prompt: str, system: str | None = None) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.post(
                f"{self.host}/api/chat",
                json={"model": self.model, "messages": messages, "stream": False},
            )
            resp.raise_for_status()
            return resp.json().get("message", {}).get("content", "")


async def log_to_backend(agent_slug: str, level: str, message: str, details: dict | None = None):
    backend_url = os.getenv("BACKEND_URL", "http://backend:8000")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"{backend_url}/api/v1/internal/logs",
                json={"agent_slug": agent_slug, "level": level, "message": message, "details": details},
            )
    except Exception:
        pass
