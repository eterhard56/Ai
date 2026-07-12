import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.api.routes import api, auth
from app.config import get_settings
from app.core.logging import setup_logging
from app.core.security import get_password_hash
from app.database import async_session, init_db
from app.models import Agent, User
from app.services.ollama import ollama_service

settings = get_settings()
logger = setup_logging("backend")


DEFAULT_AGENTS = [
    {"name": "Direct Agent", "slug": "direct", "description": "Yandex Direct campaign analysis"},
    {"name": "SEO Agent", "slug": "seo", "description": "Website SEO auditing"},
    {"name": "Analytics Agent", "slug": "analytics", "description": "Daily analytics reports"},
    {"name": "CRM Agent", "slug": "crm", "description": "Client relationship management"},
    {"name": "Parser Agent", "slug": "parser", "description": "2GIS company parser integration"},
    {"name": "Telegram Agent", "slug": "telegram", "description": "Telegram bot notifications"},
]


async def seed_data():
    async with async_session() as db:
        result = await db.execute(select(User).where(User.username == "admin"))
        if not result.scalar_one_or_none():
            admin = User(
                email="admin@ai-platform.local",
                username="admin",
                hashed_password=get_password_hash("admin123"),
                full_name="Administrator",
                role="admin",
            )
            db.add(admin)
            logger.info("Created default admin user (admin / admin123)")

        for agent_data in DEFAULT_AGENTS:
            result = await db.execute(select(Agent).where(Agent.slug == agent_data["slug"]))
            if not result.scalar_one_or_none():
                db.add(Agent(**agent_data))

        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI Platform backend...")
    await init_db()
    await seed_data()
    ollama_ok = await ollama_service.health_check()
    logger.info(f"Ollama status: {'connected' if ollama_ok else 'unavailable'}")
    yield
    logger.info("Shutting down...")


app = FastAPI(
    title="AI Platform API",
    description="Autonomous local AI agents platform powered by Ollama",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(api.router, prefix="/api/v1")


@app.get("/health")
async def health():
    ollama_ok = await ollama_service.health_check()
    return {
        "status": "healthy",
        "service": "backend",
        "ollama": "connected" if ollama_ok else "unavailable",
    }
