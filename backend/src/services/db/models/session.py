import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field

SESSION_STATUS_ACTIVE = "active"
SESSION_STATUS_COMPLETED = "completed"
SESSION_STATUS_FAILED = "failed"
SESSION_STATUS_PARTIAL = "partial"
SESSION_STATUS_STOPPED = "STOPPED"


class Session(BaseModel):
    """Mirrors the sessions table row."""
    id: Optional[str] = Field(default=None)
    project_id: Optional[str] = None
    user_id: Optional[str] = None       # Supabase auth user UUID (TEXT column); required for RLS
    session_name: Optional[str] = Field(default=None)
    status: str = SESSION_STATUS_ACTIVE
    metadata: Dict[str, Any] = {}
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SessionState(BaseModel):
    """Mirrors the session_state table row. One per session, upserted."""
    id: Optional[str] = Field(default=None)
    session_id: str
    state: Dict[str, Any] = {}
    step: Optional[str] = None       # agent name of last completed step
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SessionEvent(BaseModel):
    """Mirrors the session_events table row. Append-only."""
    id: Optional[str] = Field(default=None)
    session_id: str
    type: str                        # "input" | "output" | "agent_step" | "message"
    payload: Dict[str, Any] = {}
    timestamp: Optional[datetime] = None
