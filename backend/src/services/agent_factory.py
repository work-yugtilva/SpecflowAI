# services/agent_factory.py

from services.config.config_manager import ConfigManager
from services.agents.base_agent import BaseAgent
from services.agents.problems_agent import ProblemsAgent
from services.agents.features_agent import FeaturesAgent
from services.agents.decompose_agent import DecomposeAgent
from services.agents.tasks_agent import TasksAgent

_REGISTRY = {
    "problems": ProblemsAgent,
    "features": FeaturesAgent,
    "decompose": DecomposeAgent,
    "tasks": TasksAgent,
}


class AgentFactory:
    @classmethod
    def create(cls, agent_name: str) -> BaseAgent:
        config = ConfigManager.load_agent(agent_name)
        agent_class = _REGISTRY.get(agent_name)
        if agent_class:
            return agent_class(config.model_dump())
        return BaseAgent(agent_name, config.model_dump())
