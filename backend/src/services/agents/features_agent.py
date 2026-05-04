# services/agents/features_agent.py

from services.agents.base_agent import BaseAgent


class FeaturesAgent(BaseAgent):
    """Receives product_context + ingest + problems — not decompositions or tasks."""

    def _unwrap(self, val):
        if isinstance(val, dict) and list(val.keys()) == ["data"]:
            return val["data"]
        return val

    def build_prompt(self, task: str, context: dict = None, memory: dict = None) -> str:
        ctx = context or {}
        mem = memory or {}
        product_context = self._unwrap(
            ctx.get("product_context") or ctx.get("context") or mem.get("product_context", {})
        )
        ingest = self._bounded_research_context(ctx, mem)
        problems = self._clip_list(
            self._unwrap(ctx.get("problems") or mem.get("problems", [])),
            7,
        )

        prompt_context = {
            "product_context": product_context,
            "research_context": ingest,
            "prior_problems": problems,
        }

        if ctx.get("rag_context"):
            prompt_context["rag_context"] = ctx["rag_context"]

        if ctx.get("analytics_context"):
            prompt_context["analytics_context"] = ctx["analytics_context"]

        if ctx.get("previous_attempt_failure"):
            prompt_context["previous_attempt_failure"] = ctx["previous_attempt_failure"]

        return super().build_prompt(task, context=prompt_context, memory=None)
