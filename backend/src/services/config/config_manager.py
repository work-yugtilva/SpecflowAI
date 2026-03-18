import yaml
from pathlib import Path
from services.config.config_schema import AgentConfig


class ConfigManager:
    BASE_PATH = Path("config/agents")

    @staticmethod
    def load_agent(name: str) -> AgentConfig:
        path = ConfigManager.BASE_PATH / f"{name}.yaml"

        with open(path, "r") as f:
            raw = yaml.safe_load(f)

        return AgentConfig(**raw)  # validation happens here