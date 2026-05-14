# services/agent_factory.py

from pathlib import Path
import logging

import yaml

from services.config.config_manager import ConfigManager
from services.agents.base_agent import BaseAgent
from services.agents.product_context_agent import ProductContextAgent
from services.agents.quality_gate_agent import QualityGateAgent
from services.agents.problems_agent import ProblemsAgent
from services.agents.features_agent import FeaturesAgent
from services.agents.decompose_agent import DecomposeAgent
from services.agents.tasks_agent import TasksAgent
from services.agents.prd_agent import PRDAgent
from .agents.agent_handoff_agent import AgentHandoffAgent
from services.agents.query_agent import QueryAgent

logger = logging.getLogger("specflow.agent_factory")

MODEL_ROUTING_PATH = Path(__file__).resolve().parent / "config" / "agents" / "model_routing.yaml"
MODEL_ROUTING = yaml.safe_load(MODEL_ROUTING_PATH.read_text()) or {}

# Map agent names to their typed classes. Only this file may hardcode these names.
AGENT_MAP: dict[str, type[BaseAgent]] = {
    "product_context": ProductContextAgent,
    "quality_gate": QualityGateAgent,
    "problems": ProblemsAgent,
    "features": FeaturesAgent,
    "decompose": DecomposeAgent,
    "tasks":    TasksAgent,
    "prd":      PRDAgent,
    "agent_handoff": AgentHandoffAgent,
    "query":         QueryAgent,
}


class AgentFactory:
    @classmethod
    def create(cls, agent_name: str) -> BaseAgent:
        config = ConfigManager.load_agent(agent_name)
        routing = MODEL_ROUTING.get(agent_name, {})
        merged_config = {
            **config.model_dump(),
            "provider": routing.get("provider", "anthropic"),
            "model": routing.get("model", config.model),
            "use_cache": routing.get("use_cache", False),
            "use_batch": routing.get("use_batch", False),
        }
        agent_class = AGENT_MAP.get(agent_name, BaseAgent)
        logger.info(
            "[agent_factory] name=%s dispatched_to=%s provider=%s model=%s",
            agent_name,
            agent_class.__name__,
            merged_config["provider"],
            merged_config["model"],
        )
        return agent_class(agent_name, merged_config)
