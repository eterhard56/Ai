import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    type: str


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=8)
    full_name: str | None = None
    role: str = "viewer"


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    username: str | None = None
    full_name: str | None = None
    role: str | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    username: str
    full_name: str | None
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    username: str
    password: str


class SettingCreate(BaseModel):
    key: str
    value: str
    category: str = "general"
    description: str | None = None


class SettingResponse(BaseModel):
    id: uuid.UUID
    key: str
    value: str
    category: str
    description: str | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class AgentResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    version: str
    status: str
    is_plugin: bool
    last_run_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AgentPluginRegister(BaseModel):
    name: str
    slug: str
    description: str | None = None
    version: str = "1.0.0"
    plugin_path: str
    config: dict[str, Any] | None = None


class RecommendationResponse(BaseModel):
    id: uuid.UUID
    agent_slug: str
    title: str
    description: str
    category: str
    priority: str
    status: str
    data: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class RecommendationReview(BaseModel):
    status: str = Field(pattern="^(approved|rejected|applied)$")


class ChatSessionCreate(BaseModel):
    title: str = "New Chat"
    model: str = "qwen3:8b"


class ChatSessionResponse(BaseModel):
    id: uuid.UUID
    title: str
    model: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageCreate(BaseModel):
    content: str


class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CRMClientCreate(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    company: str | None = None
    status: str = "new"
    source: str | None = None
    notes: str | None = None


class CRMClientResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: str | None
    phone: str | None
    company: str | None
    status: str
    source: str | None
    lead_score: float | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DashboardStats(BaseModel):
    total_agents: int
    active_agents: int
    pending_recommendations: int
    total_clients: int
    total_leads: int
    parser_results: int
    recent_errors: int
