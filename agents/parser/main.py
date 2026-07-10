"""Parser Agent - 2GIS integration and company analysis."""

import json
import os
import re
import subprocess
import sys
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urlparse

import httpx
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sqlalchemy import Boolean, Column, DateTime, Float, String, Text, create_engine
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import DeclarativeBase, sessionmaker

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.base import OllamaClient, setup_agent_logging

logger = setup_agent_logging("agent-parser")
app = FastAPI(title="Parser Agent", version="1.0.0")
ollama = OllamaClient()
AGENT_SLUG = "parser"


class Base(DeclarativeBase):
    pass


class ParserResult(Base):
    __tablename__ = "parser_results"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_name = Column(String(500))
    address = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True)
    website = Column(String(500), nullable=True)
    has_https = Column(Boolean, nullable=True)
    has_whatsapp = Column(Boolean, nullable=True)
    has_telegram = Column(Boolean, nullable=True)
    has_form = Column(Boolean, nullable=True)
    lead_score = Column(Float, nullable=True)
    issues = Column(JSON, nullable=True)
    raw_data = Column(JSON, nullable=True)
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


class ParseRequest(BaseModel):
    query: str
    city: str = "moscow"
    limit: int = 50


class Parser2GISClient:
    def __init__(self):
        self.base_url = os.getenv("PARSER_2GIS_URL", "")
        self.api_key = os.getenv("PARSER_2GIS_API_KEY", "")
        self.cli_bin = os.getenv(
            "PARSER_2GIS_BIN",
            "/opt/client-finder/parser-2gis/venv/bin/parser-2gis",
        )

    def _build_2gis_url(self, city: str, query: str) -> str:
        city_map = {
            "moscow": "moscow", "москва": "moscow",
            "spb": "spb", "санкт-петербург": "spb", "петербург": "spb",
            "novosibirsk": "novosibirsk", "екатеринбург": "ekaterinburg",
        }
        city_slug = city_map.get(city.lower().strip(), city.lower().strip())
        return f"https://2gis.ru/{city_slug}/search/{quote(query.strip())}"

    def _parse_xlsx_results(self, path: Path) -> list[dict]:
        try:
            import openpyxl
        except ImportError:
            logger.warning("openpyxl not installed, cannot read parser output")
            return []

        wb = openpyxl.load_workbook(path, read_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return []
        headers = [str(h or "").strip() for h in rows[0]]
        results = []
        for row in rows[1:]:
            data = {headers[i]: row[i] for i in range(min(len(headers), len(row)))}
            name = data.get("Название") or data.get("name") or ""
            if not name:
                continue
            website = data.get("Сайт") or data.get("website")
            results.append({
                "name": str(name),
                "address": data.get("Адрес") or data.get("address"),
                "phone": data.get("Телефон") or data.get("phone"),
                "website": str(website) if website else None,
                "source_url": data.get("2GIS URL"),
            })
        wb.close()
        return results

    async def _search_cli(self, query: str, city: str, limit: int) -> list[dict]:
        parser = Path(self.cli_bin)
        if not parser.is_file():
            logger.warning(f"parser-2gis CLI not found: {self.cli_bin}")
            return []

        url = self._build_2gis_url(city, query)
        logger.info(f"Running parser-2gis CLI: {url}")

        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "companies.xlsx"
            cmd = [
                str(parser), "-i", url, "-o", str(output), "-f", "xlsx",
                "--chrome.headless", "yes", "--parser.max-records", str(limit),
            ]
            chrome = os.getenv("CHROME_BINARY_PATH", "")
            if chrome:
                cmd.extend(["--chrome.binary_path", chrome])

            try:
                proc = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
                if proc.returncode != 0:
                    logger.warning(f"parser-2gis failed: {proc.stderr[:500]}")
                    return []
            except subprocess.TimeoutExpired:
                logger.warning("parser-2gis timeout")
                return []

            if not output.exists():
                return []
            return self._parse_xlsx_results(output)

    async def search(self, query: str, city: str, limit: int) -> list[dict]:
        # Prefer existing CLI parser (does not touch client-finder)
        if self.cli_bin and Path(self.cli_bin).is_file():
            return await self._search_cli(query, city, limit)

        # Fallback: HTTP API if configured
        if not self.base_url:
            return []

        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{self.base_url}/api/parse",
                    json={"query": query, "city": city, "limit": limit},
                    headers=headers,
                )
                if resp.status_code == 200:
                    return resp.json().get("results", [])
        except Exception as e:
            logger.warning(f"parser-2gis API unavailable: {e}")

        return []


async def analyze_website(url: str) -> dict:
    result = {"has_https": False, "has_whatsapp": False, "has_telegram": False, "has_form": False, "quality": "unknown"}
    if not url:
        return result

    parsed = urlparse(url if url.startswith("http") else f"https://{url}")
    result["has_https"] = parsed.scheme == "https"

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, verify=False) as client:
            resp = await client.get(url if url.startswith("http") else f"https://{url}")
            html = resp.text
            soup = BeautifulSoup(html, "lxml")

            text = html.lower()
            result["has_whatsapp"] = bool(re.search(r"wa\.me|whatsapp", text))
            result["has_telegram"] = bool(re.search(r"t\.me/|telegram", text))
            result["has_form"] = bool(soup.find("form"))

            title = soup.find("title")
            meta = soup.find("meta", attrs={"name": "description"})
            if title and meta:
                result["quality"] = "good"
            elif title:
                result["quality"] = "average"
            else:
                result["quality"] = "poor"
    except Exception:
        result["quality"] = "unreachable"

    return result


def calculate_lead_score(company: dict, website_analysis: dict) -> float:
    score = 50.0
    if not company.get("website"):
        score += 20
    if website_analysis.get("quality") == "poor":
        score += 15
    if not website_analysis.get("has_https"):
        score += 10
    if not website_analysis.get("has_form"):
        score += 10
    if not website_analysis.get("has_whatsapp") and not website_analysis.get("has_telegram"):
        score += 5
    return min(100, score)


def detect_issues(company: dict, website_analysis: dict) -> list[str]:
    issues = []
    if not company.get("website"):
        issues.append("no_website")
    if company.get("website") and website_analysis.get("quality") == "poor":
        issues.append("bad_website")
    if company.get("website") and not website_analysis.get("has_https"):
        issues.append("no_https")
    if not website_analysis.get("has_whatsapp"):
        issues.append("no_whatsapp")
    if not website_analysis.get("has_telegram"):
        issues.append("no_telegram")
    if not website_analysis.get("has_form"):
        issues.append("no_form")
    return issues


parser_client = Parser2GISClient()


@app.get("/health")
async def health():
    return {"status": "healthy", "agent": AGENT_SLUG}


@app.post("/run/parse")
async def run_parse(req: ParseRequest):
    logger.info(f"Starting parse: {req.query} in {req.city}")
    companies = await parser_client.search(req.query, req.city, req.limit)

    if not companies:
        return {
            "status": "ok",
            "message": "parser-2gis not available or no results. Configure PARSER_2GIS_URL.",
            "processed": 0,
        }

    db = get_db()
    processed = 0
    results = []

    for company in companies:
        website = company.get("website", "")
        wa = await analyze_website(website) if website else {}
        issues = detect_issues(company, wa)
        lead_score = calculate_lead_score(company, wa)

        record = ParserResult(
            company_name=company.get("name", "Unknown"),
            address=company.get("address"),
            phone=company.get("phone"),
            website=website,
            has_https=wa.get("has_https"),
            has_whatsapp=wa.get("has_whatsapp"),
            has_telegram=wa.get("has_telegram"),
            has_form=wa.get("has_form"),
            lead_score=lead_score,
            issues={"list": issues},
            raw_data=company,
        )
        db.add(record)
        processed += 1
        results.append({"name": company.get("name"), "lead_score": lead_score, "issues": issues})

        if lead_score >= 70:
            rec = Recommendation(
                agent_slug=AGENT_SLUG,
                title=f"Горячий лид: {company.get('name')}",
                description=f"Lead Score: {lead_score}. Проблемы: {', '.join(issues)}",
                category="hot_lead",
                priority="high",
                status="pending",
                data={"company": company.get("name"), "score": lead_score},
            )
            db.add(rec)

    db.commit()
    db.close()
    return {"status": "ok", "processed": processed, "results": results[:20]}
