# services/agents/tasks_agent.py

from services.agents.base_agent import BaseAgent


class TasksAgent(BaseAgent):
    """Receives problems + features + decompositions — no raw ingest or context."""

    def _unwrap(self, val):
        if isinstance(val, dict) and list(val.keys()) == ["data"]:
            return val["data"]
        return val

    def build_prompt(self, task: str, context: dict = None, memory: dict = None) -> str:
        ctx = context or {}
        mem = memory or {}
        problems = self._unwrap(ctx.get("problems") or mem.get("problems", []))
        features = self._unwrap(ctx.get("features") or mem.get("features", []))
        decompositions = self._unwrap(ctx.get("decompositions") or mem.get("decompositions", []))
        if not isinstance(problems, list):
            problems = [problems] if problems else []
        if not isinstance(features, list):
            features = [features] if features else []
        if not isinstance(decompositions, list):
            decompositions = [decompositions] if decompositions else []

        slice_ = {
            "problems": problems,
            "features": features,
            "decompositions": decompositions,
        }

        enriched_task = (
            f"{self.instructions}\n\n{task}\n\n"
            f"IMPORTANT: Generate 8-15 tasks from {len(decompositions)} components. "
            f"Return a JSON object with exactly 4 keys: frontend, backend, api, infrastructure. "
            f"Each key must contain a list of 2-5 task objects."
        )
        return super().build_prompt(enriched_task, context=slice_, memory=None)
