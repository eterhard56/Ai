import uuid
import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.database import get_db
from app.models import (
    Agent,
    AgentLog,
    AnalyticsReport,
    CRMClient,
    ChatMessage,
    ChatSession,
    ParserResult,
    Recommendation,
    SEOAudit,
    Setting,
    User,
)
from app.schemas import (
    AgentPluginRegister,
    AgentResponse,
    ChatMessageCreate,
    ChatMessageResponse,
    ChatSessionCreate,
    ChatSessionResponse,
    CRMClientCreate,
    CRMClientResponse,
    DashboardStats,
    RecommendationResponse,
    RecommendationReview,
    SettingCreate,
    SettingResponse,
)
from app.services.ollama import ollama_service
from app.services.plugin_loader import plugin_loader
from app.services.chat_context import (
    CHAT_SYSTEM_PROMPT,
    build_platform_context,
    direct_fallback_response,
    is_refusal,
    mentions_direct,
    try_run_direct_agent,
)

router = APIRouter(tags=["API"])

AGENT_ENDPOINTS: dict[str, dict] = {
    "direct": {"url": "http://127.0.0.1:8101", "path": "/run/analyze", "method": "POST", "body": {}},
    "seo": {"url": "http://127.0.0.1:8102", "path": "/run/audit", "method": "POST", "body": {"url": "https://skolesnikov.site"}},
    "analytics": {"url": "http://127.0.0.1:8103", "path": "/run/daily", "method": "POST", "body": {}},
    "crm": {"url": "http://127.0.0.1:8104", "path": "/run/reminders", "method": "POST", "body": {}},
    "parser": {"url": "http://127.0.0.1:8105", "path": "/run/parse", "method": "POST", "body": {"query": "стоматология", "city": "moscow", "limit": 10}},
    "telegram": {"url": "http://127.0.0.1:8106", "path": "/send/daily-report", "method": "POST", "body": {}},
}


@router.get("/dashboard/stats", response_model=DashboardStats)
async def dashboard_stats(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    agents = await db.execute(select(func.count(Agent.id)))
    active = await db.execute(select(func.count(Agent.id)).where(Agent.status == "running"))
    pending = await db.execute(
        select(func.count(Recommendation.id)).where(Recommendation.status == "pending")
    )
    clients = await db.execute(select(func.count(CRMClient.id)))
    leads = await db.execute(select(func.count(CRMClient.id)).where(CRMClient.status == "new"))
    parser = await db.execute(select(func.count(ParserResult.id)))
    errors = await db.execute(
        select(func.count(AgentLog.id)).where(AgentLog.level == "error")
    )
    return DashboardStats(
        total_agents=agents.scalar() or 0,
        active_agents=active.scalar() or 0,
        pending_recommendations=pending.scalar() or 0,
        total_clients=clients.scalar() or 0,
        total_leads=leads.scalar() or 0,
        parser_results=parser.scalar() or 0,
        recent_errors=errors.scalar() or 0,
    )


@router.get("/agents", response_model=list[AgentResponse])
async def list_agents(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Agent).order_by(Agent.name))
    agents = result.scalars().all()

    # Enrich with live health status
    for agent in agents:
        ep = AGENT_ENDPOINTS.get(agent.slug)
        if ep:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(f"{ep['url']}/health")
                    agent.status = "running" if resp.status_code == 200 else "error"
            except Exception:
                agent.status = "error"

    return agents


@router.get("/agents/{slug}/status")
async def agent_status(slug: str, _: User = Depends(get_current_user)):
    ep = AGENT_ENDPOINTS.get(slug)
    if not ep:
        raise HTTPException(status_code=404, detail="Agent not found")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{ep['url']}/health")
            data = resp.json() if resp.status_code == 200 else {}
            return {"slug": slug, "online": resp.status_code == 200, "status": data.get("status", "offline")}
    except Exception as e:
        return {"slug": slug, "online": False, "status": "error", "error": str(e)}


@router.post("/agents/{slug}/run")
async def run_agent(slug: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    ep = AGENT_ENDPOINTS.get(slug)
    if not ep:
        raise HTTPException(status_code=404, detail="Agent not found")

    try:
        async with httpx.AsyncClient(timeout=600.0) as client:
            if ep["method"] == "POST":
                resp = await client.post(f"{ep['url']}{ep['path']}", json=ep.get("body", {}))
            else:
                resp = await client.get(f"{ep['url']}{ep['path']}")
            resp.raise_for_status()
            result = resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Agent error: {e.response.text[:200]}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Agent unavailable: {str(e)}")

    await db.execute(update(Agent).where(Agent.slug == slug).values(status="running", last_run_at=datetime.now(timezone.utc)))
    log = AgentLog(agent_slug=slug, level="info", message=f"Agent run triggered by {user.username}", details=result)
    db.add(log)
    await db.flush()

    return {"status": "ok", "slug": slug, "result": result}


@router.post("/agents/plugins", response_model=AgentResponse, status_code=201)
async def register_plugin(
    data: AgentPluginRegister,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    try:
        plugin_loader.load_plugin(data.plugin_path)
    except (FileNotFoundError, ImportError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    agent = Agent(
        name=data.name,
        slug=data.slug,
        description=data.description,
        version=data.version,
        is_plugin=True,
        plugin_path=data.plugin_path,
        config=data.config,
    )
    db.add(agent)
    await db.flush()
    return agent


@router.get("/settings", response_model=list[SettingResponse])
async def list_settings(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Setting).order_by(Setting.category, Setting.key))
    return result.scalars().all()


@router.post("/settings", response_model=SettingResponse, status_code=201)
async def create_setting(
    data: SettingCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    setting = Setting(**data.model_dump())
    db.add(setting)
    await db.flush()
    return setting


@router.get("/recommendations", response_model=list[RecommendationResponse])
async def list_recommendations(
    agent_slug: str | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(Recommendation).order_by(Recommendation.created_at.desc())
    if agent_slug:
        query = query.where(Recommendation.agent_slug == agent_slug)
    if status:
        query = query.where(Recommendation.status == status)
    result = await db.execute(query.limit(100))
    return result.scalars().all()


@router.patch("/recommendations/{rec_id}", response_model=RecommendationResponse)
async def review_recommendation(
    rec_id: uuid.UUID,
    data: RecommendationReview,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Recommendation).where(Recommendation.id == rec_id))
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    rec.status = data.status
    rec.reviewed_at = datetime.now(timezone.utc)
    rec.reviewed_by = user.id
    await db.flush()
    return rec


@router.get("/chat/sessions", response_model=list[ChatSessionResponse])
async def list_chat_sessions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChatSession).where(ChatSession.user_id == user.id).order_by(ChatSession.updated_at.desc())
    )
    return result.scalars().all()


@router.post("/chat/sessions", response_model=ChatSessionResponse, status_code=201)
async def create_chat_session(
    data: ChatSessionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = ChatSession(user_id=user.id, title=data.title, model=data.model)
    db.add(session)
    await db.flush()
    return session


@router.get("/chat/sessions/{session_id}/messages", response_model=list[ChatMessageResponse])
async def get_chat_messages(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = await db.get(ChatSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    result = await db.execute(
        select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at)
    )
    return result.scalars().all()


@router.post("/chat/sessions/{session_id}/messages", response_model=ChatMessageResponse)
async def send_chat_message(
    session_id: uuid.UUID,
    data: ChatMessageCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = await db.get(ChatSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    user_msg = ChatMessage(session_id=session_id, role="user", content=data.content)
    db.add(user_msg)
    await db.flush()

    history_result = await db.execute(
        select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at)
    )
    history = history_result.scalars().all()

    agent_note = None
    if mentions_direct(data.content):
        agent_note = await try_run_direct_agent()

    platform_context = build_platform_context(data.content, agent_note)
    messages: list[dict] = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]
    if platform_context:
        messages.append({"role": "system", "content": platform_context})

    for msg in history:
        if msg.role in ("user", "assistant"):
            messages.append({"role": msg.role, "content": msg.content})

    try:
        response_text = await ollama_service.chat(messages)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Ollama недоступен: {str(e)}")

    if not response_text:
        raise HTTPException(status_code=503, detail="Ollama вернул пустой ответ. Проверьте модель.")

    if mentions_direct(data.content) and is_refusal(response_text):
        token_ok = bool(os.getenv("YANDEX_DIRECT_TOKEN", ""))
        response_text = direct_fallback_response(token_ok)
        if agent_note:
            response_text = f"{agent_note}\n\n{response_text}"

    assistant_msg = ChatMessage(session_id=session_id, role="assistant", content=response_text)
    db.add(assistant_msg)
    session.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return assistant_msg


@router.get("/crm/clients", response_model=list[CRMClientResponse])
async def list_crm_clients(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(CRMClient).order_by(CRMClient.created_at.desc()))
    return result.scalars().all()


@router.post("/crm/clients", response_model=CRMClientResponse, status_code=201)
async def create_crm_client(
    data: CRMClientCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    client = CRMClient(**data.model_dump())
    db.add(client)
    await db.flush()
    return client


@router.get("/logs")
async def list_logs(
    agent_slug: str | None = None,
    level: str | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(AgentLog).order_by(AgentLog.created_at.desc())
    if agent_slug:
        query = query.where(AgentLog.agent_slug == agent_slug)
    if level:
        query = query.where(AgentLog.level == level)
    result = await db.execute(query.limit(limit))
    return result.scalars().all()


@router.get("/seo/audits")
async def list_seo_audits(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(SEOAudit).order_by(SEOAudit.created_at.desc()).limit(50))
    return result.scalars().all()


@router.get("/analytics/reports")
async def list_analytics_reports(
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    result = await db.execute(select(AnalyticsReport).order_by(AnalyticsReport.report_date.desc()).limit(30))
    return result.scalars().all()


@router.get("/parser/results")
async def list_parser_results(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(ParserResult).order_by(ParserResult.created_at.desc()).limit(100))
    return result.scalars().all()
