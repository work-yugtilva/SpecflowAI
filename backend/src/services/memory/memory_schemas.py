# services/memory/memory_schemas.py

import uuid
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional, Union


class MemoryReadConfig(BaseModel):
    """Config for how an agent reads from memory."""
    strategy: str = "selective"        # "selective" | "all" | "none" | "top_k"
    keys: Optional[Union[List[str], Dict[str, Any]]] = []
    params: Optional[Dict[str, Any]] = {}


class MemoryWriteConfig(BaseModel):
    """Config for how an agent writes to memory."""
    key: Optional[str] = None          # target memory key
    mode: str = "overwrite"            # "overwrite" | "append" | "merge"


class MemoryConfig(BaseModel):
    """Memory configuration block for an agent."""
    read: Optional[MemoryReadConfig] = None
    write: Optional[MemoryWriteConfig] = None


class MemoryEntry(BaseModel):
    """Represents a row in the memory_entries table."""
    id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    session_id: Optional[str] = None    # session scope key; None for project-scoped entries
    agent_name: str
    memory_key: str
    content: Dict[str, Any] = {}
    metadata: Dict[str, Any] = {}
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
