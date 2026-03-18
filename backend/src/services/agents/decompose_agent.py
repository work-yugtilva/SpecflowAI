# services/agents/decompose_agent.py

from services.agents.base_agent import BaseAgent


class DecomposeAgent(BaseAgent):
    def __init__(self, config):
        super().__init__("DecomposeAgent", config)

    def run(self, context):
        structured_context = {
            "input": context,
            "agent_config": self.config
        }

        task = self._build_task()

        return self.execute(task, structured_context)

    # -------------------------
    # DYNAMIC TASK BUILDER
    # -------------------------
    def _build_task(self):
        cfg = self.config

        return f"""
Perform structured decomposition based on provided configuration.

Steps:
{self._list(cfg.get("steps", []))}

Generation Rules:
{self._list(cfg.get("generation_rules", []))}

Constraints:
{self._dict(cfg.get("constraints", {}))}

Components:
{self._list(cfg.get("components", []))}

Evaluation:
{self._dict(cfg.get("evaluation", {}))}

Output Schema:
{self._schema(cfg.get("output_schema", {}))}

Do not assume anything outside the configuration.
"""

    # -------------------------
    # HELPERS
    # -------------------------
    def _list(self, items):
        if not items:
            return "None"
        return "\n".join(f"- {i}" for i in items)

    def _dict(self, d):
        if not d:
            return "None"
        return "\n".join(f"- {k}: {v}" for k, v in d.items())

    def _schema(self, schema):
        if not schema:
            return "{}"
        return str(schema)