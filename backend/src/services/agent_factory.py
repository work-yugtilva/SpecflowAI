# services/agent_factory.py

from services.config.config_manager import ConfigManager
from services.agents.base_agent import BaseAgent


class AgentFactory:
    @classmethod
    def create(cls, agent_name: str) -> BaseAgent:
        config = ConfigManager.load_agent(agent_name)
        # Always use the generic BaseAgent which reads entirely from config
        return BaseAgent(agent_name, config.model_dump())
