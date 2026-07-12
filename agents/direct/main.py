"""Direct Agent - Yandex Direct campaign analysis."""

import os
import sys
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sqlalchemy import Column, DateTime, Float, String, Text, create_engine
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import DeclarativeBase, sessionmaker

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.base import OllamaClient, setup_agent_logging

logger = setup_agent_logging("agent-direct")
app = FastAPI(title="Direct Agent", version="1.0.0")
ollama = OllamaClient()

AGENT_SLUG = "direct"


class Base(DeclarativeBase):
    pass


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
    host = os.getenv("POSTGRES_HOST", "postgres")
    url = (
        f"postgresql://{os.getenv('POSTGRES_USER', 'ai_platform')}:"
        f"{os.getenv('POSTGRES_PASSWORD', 'change-me')}@{host}:"
        f"{os.getenv('POSTGRES_PORT', '5432')}/{os.getenv('POSTGRES_DB', 'ai_platform')}"
    )
    engine = create_engine(url, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)
    return Session()


class AnalyzeRequest(BaseModel):
    client_login: str | None = None


class YandexDirectClient:
    def __init__(self):
        self.token = os.getenv("YANDEX_DIRECT_TOKEN", "")
        self.client_login = os.getenv("YANDEX_DIRECT_CLIENT_LOGIN", "")
        self.api_url = "https://api.direct.yandex.com/json/v5"

    async def _request(self, service: str, method: str, params: dict) -> dict:
        if not self.token:
            return {"error": "YANDEX_DIRECT_TOKEN not configured"}

        headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept-Language": "ru",
            "Content-Type": "application/json",
        }
        if self.client_login:
            headers["Client-Login"] = self.client_login

        body = {"method": method, "params": params}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(f"{self.api_url}/{service}", headers=headers, json=body)
            return resp.json()

    async def get_campaigns(self) -> list:
        result = await self._request("campaigns", "get", {"SelectionCriteria": {}, "FieldNames": ["Id", "Name", "Status", "State"]})
        return result.get("result", {}).get("Campaigns", [])

    async def get_ad_groups(self, campaign_ids: list[int]) -> list:
        result = await self._request("adgroups", "get", {
            "SelectionCriteria": {"CampaignIds": campaign_ids},
            "FieldNames": ["Id", "Name", "CampaignId"],
        })
        return result.get("result", {}).get("AdGroups", [])

    async def get_keywords(self, ad_group_ids: list[int]) -> list:
        result = await self._request("keywords", "get", {
            "SelectionCriteria": {"AdGroupIds": ad_group_ids},
            "FieldNames": ["Id", "Keyword", "State", "Status"],
        })
        return result.get("result", {}).get("Keywords", [])

    async def get_ads(self, ad_group_ids: list[int]) -> list:
        result = await self._request("ads", "get", {
            "SelectionCriteria": {"AdGroupIds": ad_group_ids},
            "FieldNames": ["Id", "AdGroupId", "State", "Status"],
            "TextAdFieldNames": ["Title", "Text"],
        })
        return result.get("result", {}).get("Ads", [])

    async def get_statistics(self, campaign_ids: list[int]) -> list:
        result = await self._request("reports", "get", {
            "SelectionCriteria": {"Filter": [{"Field": "CampaignId", "Operator": "IN", "Values": campaign_ids}]},
            "FieldNames": ["CampaignId", "Impressions", "Clicks", "Cost", "Ctr", "AvgCpc", "Conversions"],
            "ReportName": "AgentReport",
            "ReportType": "CAMPAIGN_PERFORMANCE_REPORT",
            "DateRangeType": "LAST_30_DAYS",
            "Format": "TSV",
            "IncludeVAT": "YES",
        })
        return result


direct_client = YandexDirectClient()


def analyze_campaign_data(campaigns: list, stats: dict) -> list[dict]:
    issues = []

    for campaign in campaigns:
        cid = campaign.get("Id")
        campaign_stats = stats.get(str(cid), {})

        ctr = float(campaign_stats.get("Ctr", 0) or 0)
        cost = float(campaign_stats.get("Cost", 0) or 0)
        clicks = int(campaign_stats.get("Clicks", 0) or 0)
        impressions = int(campaign_stats.get("Impressions", 0) or 0)
        cpc = float(campaign_stats.get("AvgCpc", 0) or 0)
        conversions = int(campaign_stats.get("Conversions", 0) or 0)

        if impressions > 100 and ctr < 1.0:
            issues.append({
                "type": "low_ctr",
                "campaign_id": cid,
                "campaign_name": campaign.get("Name"),
                "ctr": ctr,
                "priority": "high",
                "message": f"Низкий CTR ({ctr:.2f}%) у кампании '{campaign.get('Name')}'",
            })

        if clicks == 0 and cost > 0:
            issues.append({
                "type": "no_clicks",
                "campaign_id": cid,
                "campaign_name": campaign.get("Name"),
                "cost": cost,
                "priority": "critical",
                "message": f"Расход {cost:.2f} руб. без кликов в кампании '{campaign.get('Name')}'",
            })

        if cpc > 100:
            issues.append({
                "type": "expensive",
                "campaign_id": cid,
                "campaign_name": campaign.get("Name"),
                "cpc": cpc,
                "priority": "high",
                "message": f"Высокий CPC ({cpc:.2f} руб.) в кампании '{campaign.get('Name')}'",
            })

        if cost > 10000 and conversions == 0:
            issues.append({
                "type": "budget_waste",
                "campaign_id": cid,
                "campaign_name": campaign.get("Name"),
                "cost": cost,
                "priority": "critical",
                "message": f"Слив бюджета: {cost:.2f} руб. без конверсий",
            })

    return issues


def save_recommendations(issues: list[dict]):
    db = get_db()
    try:
        for issue in issues:
            rec = Recommendation(
                agent_slug=AGENT_SLUG,
                title=issue.get("message", "Issue detected"),
                description=issue.get("message", ""),
                category=issue.get("type", "general"),
                priority=issue.get("priority", "medium"),
                status="pending",
                data=issue,
            )
            db.add(rec)
        db.commit()
    finally:
        db.close()


@app.get("/health")
async def health():
    return {"status": "healthy", "agent": AGENT_SLUG}


@app.post("/run/analyze")
async def run_analyze(req: AnalyzeRequest | None = None):
    logger.info("Starting Direct analysis...")
    try:
        campaigns = await direct_client.get_campaigns()
        if not campaigns:
            return {"status": "ok", "message": "No campaigns or API not configured", "issues": []}

        campaign_ids = [c["Id"] for c in campaigns]
        ad_groups = await direct_client.get_ad_groups(campaign_ids)
        ad_group_ids = [g["Id"] for g in ad_groups]
        keywords = await direct_client.get_keywords(ad_group_ids) if ad_group_ids else []
        ads = await direct_client.get_ads(ad_group_ids) if ad_group_ids else []
        stats_raw = await direct_client.get_statistics(campaign_ids)

        issues = analyze_campaign_data(campaigns, {})

        if issues:
            save_recommendations(issues)

        if issues and ollama:
            prompt = f"Проанализируй проблемы Яндекс Директ и дай рекомендации:\n{issues[:10]}"
            ai_recommendations = await ollama.generate(
                prompt,
                system="Ты эксперт по Яндекс Директ. Дай конкретные рекомендации на русском. Не предлагай автоматических изменений.",
            )
            db = get_db()
            rec = Recommendation(
                agent_slug=AGENT_SLUG,
                title="AI рекомендации по кампаниям",
                description=ai_recommendations,
                category="ai_analysis",
                priority="medium",
                status="pending",
            )
            db.add(rec)
            db.commit()
            db.close()

        logger.info(f"Analysis complete: {len(issues)} issues found")
        return {
            "status": "ok",
            "campaigns": len(campaigns),
            "ad_groups": len(ad_groups),
            "keywords": len(keywords),
            "ads": len(ads),
            "issues": issues,
        }
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run/generate-ad")
async def generate_ad(keyword: str, campaign_name: str = ""):
    prompt = f"Создай текст объявления для Яндекс Директ.\nКлючевое слово: {keyword}\nКампания: {campaign_name}\nФормат: Заголовок 1, Заголовок 2, Текст объявления"
    text = await ollama.generate(prompt, system="Создавай рекламные объявления на русском. Только текст, без пояснений.")
    db = get_db()
    rec = Recommendation(
        agent_slug=AGENT_SLUG,
        title=f"Новое объявление для '{keyword}'",
        description=text,
        category="new_ad",
        priority="low",
        status="pending",
        data={"keyword": keyword, "campaign": campaign_name},
    )
    db.add(rec)
    db.commit()
    db.close()
    return {"status": "pending_approval", "ad_text": text}
