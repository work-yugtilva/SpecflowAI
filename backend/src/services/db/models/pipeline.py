from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field

PIPELINE_STATUS_PENDING = "pending"
PIPELINE_STATUS_RUNNING = "running"
PIPELINE_STATUS_COMPLETED = "completed"
PIPELINE_STATUS_FAILED = "failed"
PIPELINE_STATUS_ORPHANED = "orphaned"


class PipelineRun(BaseModel):
    """Mirrors the pipelines table row."""
    id: Optional[str] = Field(default=None)
    session_id: Optional[str] = Field(default=None)
    user_id: Optional[str] = None       # Supabase auth user UUID; required for RLS (added in migration 011)
    status: str = PIPELINE_STATUS_PENDING
    input_data: Dict[str, Any] = {}
    output_data: Dict[str, Any] = {}
    current_step: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
