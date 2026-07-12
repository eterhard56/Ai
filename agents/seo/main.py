"""SEO Agent - Website auditing and recommendations."""

import os
import sys
import uuid
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
from sqlalchemy import Column, DateTime, Float, String, Text, create_engine
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import DeclarativeBase, sessionmaker

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.base import OllamaClient, setup_agent_logging

logger = setup_agent_logging("agent-seo")
app = FastAPI(title="SEO Agent", version="1.0.0")
ollama = OllamaClient()
AGENT_SLUG = "seo"


class Base(DeclarativeBase):
    pass


class SEOAudit(Base):
    __tablename__ = "seo_audits"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    url = Column(String(1000))
    score = Column(Float, nullable=True)
    results = Column(JSON)
    recommendations = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


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


class AuditRequest(BaseModel):
    url: HttpUrl


async def check_ssl(url: str) -> dict:
    parsed = urlparse(url)
    return {"has_ssl": parsed.scheme == "https", "scheme": parsed.scheme}


async def fetch_page(url: str) -> tuple[int, str, dict]:
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, verify=False) as client:
        start = datetime.now()
        resp = await client.get(url)
        elapsed = (datetime.now() - start).total_seconds()
        return resp.status_code, resp.text, {"response_time": elapsed, "final_url": str(resp.url)}


async def check_robots(url: str) -> dict:
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(robots_url)
            return {"exists": resp.status_code == 200, "status": resp.status_code, "content_length": len(resp.text)}
    except Exception:
        return {"exists": False, "status": 0}


async def check_sitemap(url: str) -> dict:
    parsed = urlparse(url)
    sitemap_url = f"{parsed.scheme}://{parsed.netloc}/sitemap.xml"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(sitemap_url)
            return {"exists": resp.status_code == 200, "status": resp.status_code}
    except Exception:
        return {"exists": False, "status": 0}


def analyze_html(html: str, url: str) -> dict:
    soup = BeautifulSoup(html, "lxml")
    title = soup.find("title")
    meta_desc = soup.find("meta", attrs={"name": "description"})
    h1_tags = soup.find_all("h1")
    images = soup.find_all("img")
    images_without_alt = [img for img in images if not img.get("alt")]
    schema_scripts = soup.find_all("script", type="application/ld+json")

    return {
        "title": title.get_text(strip=True) if title else None,
        "title_length": len(title.get_text(strip=True)) if title else 0,
        "description": meta_desc.get("content", "") if meta_desc else None,
        "description_length": len(meta_desc.get("content", "")) if meta_desc else 0,
        "h1_count": len(h1_tags),
        "h1_texts": [h.get_text(strip=True) for h in h1_tags[:5]],
        "images_total": len(images),
        "images_without_alt": len(images_without_alt),
        "has_schema": len(schema_scripts) > 0,
        "schema_count": len(schema_scripts),
    }


def calculate_score(results: dict) -> float:
    score = 100.0
    if not results.get("ssl", {}).get("has_ssl"):
        score -= 15
    if not results.get("meta", {}).get("title"):
        score -= 10
    if results.get("meta", {}).get("title_length", 0) > 60:
        score -= 5
    if not results.get("meta", {}).get("description"):
        score -= 10
    if results.get("meta", {}).get("h1_count", 0) == 0:
        score -= 10
    if results.get("meta", {}).get("h1_count", 0) > 1:
        score -= 5
    if results.get("meta", {}).get("images_without_alt", 0) > 0:
        score -= 5
    if not results.get("robots", {}).get("exists"):
        score -= 5
    if not results.get("sitemap", {}).get("exists"):
        score -= 5
    if not results.get("meta", {}).get("has_schema"):
        score -= 5
    if results.get("performance", {}).get("response_time", 0) > 3:
        score -= 10
    if results.get("status_code", 200) != 200:
        score -= 20
    return max(0, score)


def generate_issues(results: dict) -> list[dict]:
    issues = []
    if not results.get("ssl", {}).get("has_ssl"):
        issues.append({"type": "ssl", "priority": "high", "message": "Сайт не использует HTTPS"})
    if not results.get("meta", {}).get("title"):
        issues.append({"type": "title", "priority": "high", "message": "Отсутствует тег title"})
    if not results.get("meta", {}).get("description"):
        issues.append({"type": "description", "priority": "medium", "message": "Отсутствует meta description"})
    if results.get("meta", {}).get("h1_count", 0) == 0:
        issues.append({"type": "h1", "priority": "high", "message": "Отсутствует заголовок H1"})
    if results.get("meta", {}).get("images_without_alt", 0) > 0:
        issues.append({"type": "alt", "priority": "medium", "message": f"Изображения без alt: {results['meta']['images_without_alt']}"})
    if not results.get("robots", {}).get("exists"):
        issues.append({"type": "robots", "priority": "low", "message": "Файл robots.txt не найден"})
    if not results.get("sitemap", {}).get("exists"):
        issues.append({"type": "sitemap", "priority": "medium", "message": "Sitemap.xml не найден"})
    if results.get("performance", {}).get("response_time", 0) > 3:
        issues.append({"type": "speed", "priority": "high", "message": f"Медленная загрузка: {results['performance']['response_time']:.2f}с"})
    if results.get("status_code", 200) >= 400:
        issues.append({"type": "status", "priority": "critical", "message": f"HTTP статус: {results['status_code']}"})
    return issues


@app.get("/health")
async def health():
    return {"status": "healthy", "agent": AGENT_SLUG}


@app.post("/run/audit")
async def run_audit(req: AuditRequest):
    url = str(req.url)
    logger.info(f"Starting SEO audit for {url}")
    try:
        ssl = await check_ssl(url)
        status_code, html, perf = await fetch_page(url)
        robots = await check_robots(url)
        sitemap = await check_sitemap(url)
        meta = analyze_html(html, url) if status_code == 200 else {}

        results = {
            "url": url,
            "status_code": status_code,
            "ssl": ssl,
            "robots": robots,
            "sitemap": sitemap,
            "meta": meta,
            "performance": perf,
        }
        score = calculate_score(results)
        issues = generate_issues(results)

        ai_recs = ""
        if issues:
            ai_recs = await ollama.generate(
                f"SEO проблемы сайта {url}:\n{issues}\nДай рекомендации по исправлению.",
                system="Ты SEO-эксперт. Дай конкретные рекомендации на русском.",
            )

        db = get_db()
        audit = SEOAudit(url=url, score=score, results=results, recommendations={"issues": issues, "ai": ai_recs})
        db.add(audit)

        for issue in issues:
            rec = Recommendation(
                agent_slug=AGENT_SLUG,
                title=issue["message"],
                description=issue["message"],
                category=issue["type"],
                priority=issue["priority"],
                status="pending",
                data=issue,
            )
            db.add(rec)
        db.commit()
        db.close()

        return {"status": "ok", "url": url, "score": score, "issues": issues, "ai_recommendations": ai_recs}
    except Exception as e:
        logger.error(f"SEO audit failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
