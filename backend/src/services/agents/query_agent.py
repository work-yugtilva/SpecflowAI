# services/agents/query_agent.py

from services.agents.base_agent import BaseAgent


class QueryAgent(BaseAgent):
    """Answers ad-hoc PM questions grounded in session research entries, problems, and PRD."""

    def _unwrap(self, val):
        if isinstance(val, dict) and list(val.keys()) == ["data"]:
            return val["data"]
        return val

    def build_prompt(self, task: str, context: dict = None, memory: dict = None) -> str:
        ctx = context or {}

        prompt_context = {
            "research_entries": ctx.get("research_entries", []),
            "problems": self._unwrap(ctx.get("problems", [])),
        }

        prd = ctx.get("prd")
        if prd:
            prompt_context["prd"] = self._unwrap(prd)

        return super().build_prompt(task, context=prompt_context, memory=None)
