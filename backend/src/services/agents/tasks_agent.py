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
        problems = self._clip_list(
            self._unwrap(ctx.get("problems") or mem.get("problems", [])),
            4,
        )
        features = self._clip_list(
            self._unwrap(ctx.get("features") or mem.get("features", [])),
            6,
        )
        decompositions = self._clip_list(
            self._unwrap(ctx.get("decompositions") or mem.get("decompositions", [])),
            8,
        )

        prompt_context = {
            "prior_problems": problems,
            "prior_features": features,
            "prior_decompositions": decompositions,
        }

        if ctx.get("previous_attempt_failure"):
            prompt_context["previous_attempt_failure"] = ctx["previous_attempt_failure"]

        return super().build_prompt(task, context=prompt_context, memory=None)
