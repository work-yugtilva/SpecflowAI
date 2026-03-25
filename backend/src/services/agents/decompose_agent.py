# services/agents/decompose_agent.py

from services.agents.base_agent import BaseAgent


class DecomposeAgent(BaseAgent):
    """Receives product_context + ingest + problems + features."""

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
        features = self._unwrap(ctx.get("features") or mem.get("features", []))
        if not isinstance(problems, list):
            problems = [problems] if problems else []
        if not isinstance(features, list):
            features = [features] if features else []

        slice_ = {
            "product_context": product_context,
            "ingest": ingest,
            "problems": problems,
            "features": features,
        }

        enriched_task = (
            f"{self.instructions}\n\n{task}\n\n"
            f"IMPORTANT: Decompose ALL {len(features)} features into 6-12 components. "
            f"Each component must have layer: ui | backend | system."
        )
        return super().build_prompt(enriched_task, context=slice_, memory=None)
