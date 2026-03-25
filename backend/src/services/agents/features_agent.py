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
        product_context = ctx.get("product_context") or ctx.get("context", {})
        ingest = ctx.get("ingest", [])
        problems = self._unwrap(ctx.get("problems") or mem.get("problems", []))
        if not isinstance(problems, list):
            problems = [problems] if problems else []

        slice_ = {
            "product_context": product_context,
            "ingest": ingest,
            "problems": problems,
        }

        enriched_task = (
            f"{self.instructions}\n\n{task}\n\n"
            f"IMPORTANT: There are {len(problems)} validated problems. "
            f"Return 4-8 features covering ALL of them."
        )
        return super().build_prompt(enriched_task, context=slice_, memory=None)
