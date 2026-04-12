# services/agent_factory.py

from services.config.config_manager import ConfigManager
from services.agents.base_agent import BaseAgent
from services.agents.product_context_agent import ProductContextAgent
from services.agents.quality_gate_agent import QualityGateAgent
from services.agents.problems_agent import ProblemsAgent
from services.agents.features_agent import FeaturesAgent
from services.agents.decompose_agent import DecomposeAgent
from services.agents.tasks_agent import TasksAgent
from services.agents.prd_agent import PRDAgent
from services.agents.linear_sync_agent import LinearSyncAgent
from .agents.agent_handoff_agent import AgentHandoffAgent
from services.agents.query_agent import QueryAgent
import logging

logger = logging.getLogger("specflow.agent_factory")

# Map agent names to their typed classes. Only this file may hardcode these names.
AGENT_MAP: dict[str, type[BaseAgent]] = {
    "product_context": ProductContextAgent,
    "quality_gate": QualityGateAgent,
    "problems": ProblemsAgent,
    "features": FeaturesAgent,
    "decompose": DecomposeAgent,
    "tasks":    TasksAgent,
    "prd":      PRDAgent,
    "linear_sync": LinearSyncAgent,
    "agent_handoff": AgentHandoffAgent,
    "query":         QueryAgent,
}


class AgentFactory:
    @classmethod
    def create(cls, agent_name: str) -> BaseAgent:
        config = ConfigManager.load_agent(agent_name)
        agent_class = AGENT_MAP.get(agent_name, BaseAgent)
        logger.info("[agent_factory] name=%s dispatched_to=%s", agent_name, agent_class.__name__)
        return agent_class(agent_name, config.model_dump())
