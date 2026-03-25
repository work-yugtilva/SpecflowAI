# services/agents/problems_agent.py

from services.agents.base_agent import BaseAgent


class ProblemsAgent(BaseAgent):
    """Receives product_context + ingest only — never sees downstream outputs."""

    def _unwrap(self, val):
        if isinstance(val, dict) and list(val.keys()) == ["data"]:
            return val["data"]
        return val

    def build_prompt(self, task: str, context: dict = None, memory: dict = None) -> str:
        ctx = context or {}
        product_context = ctx.get("product_context") or ctx.get("context", {})
        ingest = ctx.get("ingest", [])

        slice_ = {
            "product_context": product_context,
            "ingest": ingest,
        }

        enriched_task = (
            f"{self.instructions}\n\n{task}\n\n"
            f"IMPORTANT: You have {len(ingest)} research inputs. "
            f"Return 3-7 problems covering all of them."
        )
        return super().build_prompt(enriched_task, context=slice_, memory=None)
