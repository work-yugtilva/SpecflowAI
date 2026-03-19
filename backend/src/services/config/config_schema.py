from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from services.memory.memory_schemas import MemoryConfig


class ScoringConfig(BaseModel):
    dimensions: Optional[List[str]]
    method: Optional[str]
    weights: Optional[Dict[str, Any]]


class CriticConfig(BaseModel):
    criteria: List[str]


class OutputSchema(BaseModel):
    type: str
    fields: Optional[Dict[str, Any]]
    sections: Optional[Dict[str, Any]]
    groups: Optional[Dict[str, Any]]


class TokenControl(BaseModel):
    max_tokens: Optional[int] = 8000
    max_output_tokens: Optional[int] = 2048
    strategy: Optional[str] = "trim"
    retries: Optional[int] = 2


class CompressionConfig(BaseModel):
    strategy: str = "none"
    params: Optional[Dict[str, Any]] = {}


class SessionPipelineConfig(BaseModel):
    """Session behaviour flags for the pipeline."""
    persistence: bool = True        # save state + memory after each step
    event_tracking: bool = True     # append structured events to session_events


class ExecutionConfig(BaseModel):
    """Execution control flags for the pipeline."""
    resumable: bool = True          # skip already-completed steps on re-run


class PipelineConfig(BaseModel):
    """Typed model for pipeline.yaml. Used by Pipeline.__init__."""
    settings: Optional[Dict[str, Any]] = {}
    steps: List[Dict[str, Any]] = []
    session: Optional[SessionPipelineConfig] = Field(default_factory=SessionPipelineConfig)
    execution: Optional[ExecutionConfig] = Field(default_factory=ExecutionConfig)


class AgentConfig(BaseModel):
    role: str
    instructions: str

    steps: Optional[List[str]] = []
    generation_rules: Optional[List[str]] = []
    constraints: Optional[Dict[str, Any]] = {}

    scoring: Optional[ScoringConfig]
    output_schema: Optional[OutputSchema]

    critic: Optional[CriticConfig]
    use_critic: Optional[bool] = False
    
    token_control: Optional[TokenControl] = Field(default_factory=TokenControl)
    compression: Optional[CompressionConfig] = Field(default_factory=lambda: CompressionConfig(strategy="none"))
    
    memory: Optional[MemoryConfig] = None