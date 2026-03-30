import yaml
from pathlib import Path
from services.config.config_schema import AgentConfig

# backend/src/services/config/ -> parents[3] == backend/ (YAML lives in backend/config/agents)
_BACKEND_ROOT = Path(__file__).resolve().parents[3]


class ConfigManager:
    BASE_PATH = _BACKEND_ROOT / "config" / "agents"

    @staticmethod
    def load_agent(name: str) -> AgentConfig:
        path = ConfigManager.BASE_PATH / f"{name}.yaml"

        with open(path, "r") as f:
            raw = yaml.safe_load(f)

        return AgentConfig(**raw)  # validation happens here