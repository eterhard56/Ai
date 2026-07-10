"""CRM Agent - Client management and Telegram notifications."""

import os
import sys
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sqlalchemy import Boolean, Column, DateTime, Float, String, Text, create_engine
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, sessionmaker

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.base import setup_agent_logging

logger = setup_agent_logging("agent-crm")
app = FastAPI(title="CRM Agent", version="1.0.0")
AGENT_SLUG = "crm"


class Base(DeclarativeBase):
    pass


class CRMClient(Base):
    __tablename__ = "crm_clients"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255))
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    company = Column(String(255), nullable=True)
    status = Column(String(50), default="new")
    source = Column(String(100), nullable=True)
    lead_score = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class CRMTask(Base):
    __tablename__ = "crm_tasks"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True))
    title = Column(String(500))
    description = Column(Text, nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    is_completed = Column(Boolean, default=False)
    reminder_sent = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


def get_db():
    url = (
        f"postgresql://{os.getenv('POSTGRES_USER', 'ai_platform')}:"
        f"{os.getenv('POSTGRES_PASSWORD', 'change-me')}@{os.getenv('POSTGRES_HOST', 'postgres')}:"
        f"{os.getenv('POSTGRES_PORT', '5432')}/{os.getenv('POSTGRES_DB', 'ai_platform')}"
    )
    return sessionmaker(bind=create_engine(url, pool_pre_ping=True))()


class ClientCreate(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    company: str | None = None
    status: str = "new"
    source: str | None = None
    notes: str | None = None


class TaskCreate(BaseModel):
    client_id: str
    title: str
    description: str | None = None
    due_date: datetime | None = None


async def send_telegram(message: str):
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")
    if not token or not chat_id:
        return False
    async with httpx.AsyncClient(timeout=10.0) as client:
        await client.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": message, "parse_mode": "HTML"},
        )
    return True


@app.get("/health")
async def health():
    return {"status": "healthy", "agent": AGENT_SLUG}


@app.get("/clients")
async def list_clients():
    db = get_db()
    clients = db.query(CRMClient).order_by(CRMClient.created_at.desc()).limit(100).all()
    db.close()
    return [{"id": str(c.id), "name": c.name, "status": c.status, "company": c.company} for c in clients]


@app.post("/clients", status_code=201)
async def create_client(data: ClientCreate):
    db = get_db()
    client = CRMClient(**data.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    cid = str(client.id)
    db.close()
    await send_telegram(f"🆕 Новый клиент: <b>{data.name}</b>\nСтатус: {data.status}")
    return {"id": cid, "name": data.name}


@app.post("/tasks", status_code=201)
async def create_task(data: TaskCreate):
    db = get_db()
    task = CRMTask(
        client_id=uuid.UUID(data.client_id),
        title=data.title,
        description=data.description,
        due_date=data.due_date,
    )
    db.add(task)
    db.commit()
    db.close()
    return {"status": "created"}


@app.post("/run/reminders")
async def check_reminders():
    logger.info("Checking CRM reminders...")
    db = get_db()
    now = datetime.now(timezone.utc)
    tasks = db.query(CRMTask).filter(
        CRMTask.is_completed == False,
        CRMTask.reminder_sent == False,
        CRMTask.due_date <= now,
    ).all()

    sent = 0
    for task in tasks:
        client = db.query(CRMClient).filter(CRMClient.id == task.client_id).first()
        msg = f"⏰ Напоминание: <b>{task.title}</b>\nКлиент: {client.name if client else 'N/A'}"
        if await send_telegram(msg):
            task.reminder_sent = True
            sent += 1

    db.commit()
    db.close()
    return {"status": "ok", "reminders_sent": sent}
