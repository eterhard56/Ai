"""Telegram Agent - Bot commands and daily reports."""

import asyncio
import os
import sys
from datetime import datetime, timezone

import httpx
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.base import setup_agent_logging

logger = setup_agent_logging("agent-telegram")
AGENT_SLUG = "telegram"

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")


def get_db():
    url = (
        f"postgresql://{os.getenv('POSTGRES_USER', 'ai_platform')}:"
        f"{os.getenv('POSTGRES_PASSWORD', 'change-me')}@{os.getenv('POSTGRES_HOST', 'postgres')}:"
        f"{os.getenv('POSTGRES_PORT', '5432')}/{os.getenv('POSTGRES_DB', 'ai_platform')}"
    )
    return sessionmaker(bind=create_engine(url, pool_pre_ping=True))()


async def call_agent(port: int, endpoint: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(f"http://agent-{['direct','seo','analytics','crm','parser','telegram'][port-8001] if port < 8006 else 'telegram'}:{port}{endpoint}")
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        return {"error": str(e)}
    return {"error": "unavailable"}


AGENT_PORTS = {
    "direct": 8001,
    "seo": 8002,
    "analytics": 8003,
    "crm": 8004,
    "parser": 8005,
}


async def get_status() -> str:
    services = [
        ("Backend", f"{BACKEND_URL}/health"),
        ("Direct", "http://agent-direct:8001/health"),
        ("SEO", "http://agent-seo:8002/health"),
        ("Analytics", "http://agent-analytics:8003/health"),
        ("CRM", "http://agent-crm:8004/health"),
        ("Parser", "http://agent-parser:8005/health"),
    ]
    lines = ["📊 <b>Статус AI Platform</b>\n"]
    async with httpx.AsyncClient(timeout=5.0) as client:
        for name, url in services:
            try:
                resp = await client.get(url)
                status = "✅" if resp.status_code == 200 else "❌"
            except Exception:
                status = "❌"
            lines.append(f"{status} {name}")
    return "\n".join(lines)


async def get_leads_report() -> str:
    db = get_db()
    from sqlalchemy import Column, String
    from sqlalchemy.orm import DeclarativeBase

    class CRMClient(DeclarativeBase):
        __tablename__ = "crm_clients"
        status = Column(String(50))

    total = db.query(func.count()).select_from(CRMClient).scalar() or 0
    new = db.query(func.count()).select_from(CRMClient).filter(CRMClient.status == "new").scalar() or 0
    db.close()
    return f"👥 <b>Лиды</b>\nВсего клиентов: {total}\nНовых: {new}"


async def get_daily_report() -> str:
    lines = [
        f"📅 <b>Ежедневный отчёт AI Platform</b>",
        f"Дата: {datetime.now(timezone.utc).strftime('%d.%m.%Y')}\n",
    ]
    lines.append(await get_status())
    lines.append("")
    lines.append(await get_leads_report())
    return "\n".join(lines)


HELP_TEXT = """
🤖 <b>AI Platform Bot</b>

Команды:
/report — Ежедневный отчёт
/direct — Анализ Яндекс Директ
/parser — Запуск парсера
/seo — SEO аудит (укажите URL)
/status — Статус сервисов
/leads — Отчёт по лидам
/help — Справка
"""


async def handle_update(update: dict):
    message = update.get("message", {})
    text = message.get("text", "")
    chat_id = message.get("chat", {}).get("id")
    if not chat_id or not text:
        return

    response = ""
    if text.startswith("/help"):
        response = HELP_TEXT
    elif text.startswith("/status"):
        response = await get_status()
    elif text.startswith("/leads"):
        response = await get_leads_report()
    elif text.startswith("/report"):
        response = await get_daily_report()
    elif text.startswith("/direct"):
        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.post("http://agent-direct:8001/run/analyze")
            data = resp.json() if resp.status_code == 200 else {"error": resp.text}
        response = f"📈 <b>Direct Agent</b>\nКампаний: {data.get('campaigns', 0)}\nПроблем: {len(data.get('issues', []))}"
    elif text.startswith("/parser"):
        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.post("http://agent-parser:8005/run/parse", json={"query": "стоматология", "city": "moscow", "limit": 10})
            data = resp.json() if resp.status_code == 200 else {"error": resp.text}
        response = f"🔍 <b>Parser Agent</b>\nОбработано: {data.get('processed', 0)}"
    elif text.startswith("/seo"):
        url = text.replace("/seo", "").strip()
        if url:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post("http://agent-seo:8002/run/audit", json={"url": url})
                data = resp.json() if resp.status_code == 200 else {"error": resp.text}
            response = f"🔎 <b>SEO Audit</b>\nScore: {data.get('score', 'N/A')}\nПроблем: {len(data.get('issues', []))}"
        else:
            response = "Укажите URL: /seo https://example.com"
    else:
        response = "Неизвестная команда. /help"

    async with httpx.AsyncClient(timeout=10.0) as client:
        await client.post(
            f"https://api.telegram.org/bot{TOKEN}/sendMessage",
            json={"chat_id": chat_id, "text": response, "parse_mode": "HTML"},
        )


async def poll_updates():
    offset = 0
    while True:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    f"https://api.telegram.org/bot{TOKEN}/getUpdates",
                    params={"offset": offset, "timeout": 20},
                )
                data = resp.json()
                for update in data.get("result", []):
                    offset = update["update_id"] + 1
                    await handle_update(update)
        except Exception as e:
            logger.error(f"Poll error: {e}")
            await asyncio.sleep(5)


def start_api_server_thread():
    from fastapi import FastAPI
    import uvicorn

    api = FastAPI(title="Telegram Agent API")

    @api.get("/health")
    async def health():
        return {"status": "healthy", "agent": AGENT_SLUG, "bot_configured": bool(TOKEN)}

    @api.post("/send/daily-report")
    async def send_daily():
        chat_id = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")
        if not TOKEN or not chat_id:
            return {"status": "skipped", "reason": "Telegram not configured"}
        report = await get_daily_report()
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"https://api.telegram.org/bot{TOKEN}/sendMessage",
                json={"chat_id": chat_id, "text": report, "parse_mode": "HTML"},
            )
        return {"status": "sent"}

    uvicorn.run(api, host="0.0.0.0", port=8006, log_level="info")


async def main():
    import threading

    api_thread = threading.Thread(target=start_api_server_thread, daemon=True)
    api_thread.start()

    if not TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN not set, running API only")
        while True:
            await asyncio.sleep(3600)
        return

    logger.info("Starting Telegram bot...")
    await poll_updates()


if __name__ == "__main__":
    asyncio.run(main())
