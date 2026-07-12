"""Analytics Agent - Daily reports and forecasting."""

import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from pydantic import BaseModel
from sqlalchemy import Column, DateTime, String, Text, create_engine, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import DeclarativeBase, sessionmaker

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.base import OllamaClient, setup_agent_logging

logger = setup_agent_logging("agent-analytics")
app = FastAPI(title="Analytics Agent", version="1.0.0")
ollama = OllamaClient()
AGENT_SLUG = "analytics"


class Base(DeclarativeBase):
    pass


class AnalyticsReport(Base):
    __tablename__ = "analytics_reports"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_date = Column(DateTime(timezone=True))
    report_type = Column(String(50), default="daily")
    metrics = Column(JSON)
    problems = Column(JSON, nullable=True)
    forecast = Column(JSON, nullable=True)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class CRMClient(Base):
    __tablename__ = "crm_clients"
    id = Column(UUID(as_uuid=True), primary_key=True)
    status = Column(String(50))
    created_at = Column(DateTime(timezone=True))


class Recommendation(Base):
    __tablename__ = "recommendations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_slug = Column(String(100))
    title = Column(String(500))
    description = Column(Text)
    category = Column(String(100))
    priority = Column(String(20), default="medium")
    status = Column(String(50), default="pending")
    data = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


def get_db():
    url = (
        f"postgresql://{os.getenv('POSTGRES_USER', 'ai_platform')}:"
        f"{os.getenv('POSTGRES_PASSWORD', 'change-me')}@{os.getenv('POSTGRES_HOST', 'postgres')}:"
        f"{os.getenv('POSTGRES_PORT', '5432')}/{os.getenv('POSTGRES_DB', 'ai_platform')}"
    )
    return sessionmaker(bind=create_engine(url, pool_pre_ping=True))()


@app.get("/health")
async def health():
    return {"status": "healthy", "agent": AGENT_SLUG}


@app.post("/run/daily")
async def run_daily_report():
    logger.info("Generating daily analytics report...")
    db = get_db()
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)

    total_leads = db.query(func.count(CRMClient.id)).filter(CRMClient.status == "new").scalar() or 0
    new_leads_week = db.query(func.count(CRMClient.id)).filter(
        CRMClient.created_at >= week_ago, CRMClient.status == "new"
    ).scalar() or 0

    metrics = {
        "date": today.isoformat(),
        "total_leads": total_leads,
        "new_leads_week": new_leads_week,
        "spend": 0,
        "ctr": 0,
        "cpa": 0,
        "clicks": 0,
        "impressions": 0,
        "conversions": 0,
    }

    problems = []
    if total_leads == 0:
        problems.append({"type": "no_leads", "message": "Нет новых лидов"})
    if new_leads_week < 5:
        problems.append({"type": "low_leads", "message": f"Мало лидов за неделю: {new_leads_week}"})

    forecast = {
        "leads_next_week": max(new_leads_week, int(new_leads_week * 1.1)),
        "trend": "stable" if new_leads_week >= 5 else "declining",
    }

    summary = await ollama.generate(
        f"Создай краткий ежедневный отчёт на русском:\nМетрики: {metrics}\nПроблемы: {problems}\nПрогноз: {forecast}",
        system="Ты аналитик. Пиши кратко и по делу.",
    )

    report = AnalyticsReport(
        report_date=today,
        report_type="daily",
        metrics=metrics,
        problems=problems,
        forecast=forecast,
        summary=summary,
    )
    db.add(report)

    if problems:
        for p in problems:
            rec = Recommendation(
                agent_slug=AGENT_SLUG,
                title=p["message"],
                description=p["message"],
                category=p["type"],
                priority="high",
                status="pending",
                data=p,
            )
            db.add(rec)

    db.commit()
    db.close()
    logger.info("Daily report generated")
    return {"status": "ok", "metrics": metrics, "problems": problems, "summary": summary}
