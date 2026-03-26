# services/agents/product_context_agent.py

from services.agents.base_agent import BaseAgent
import json


class ProductContextAgent(BaseAgent):
    """
    Step 0: Extracts structured product context from raw ingest + user context.
    Runs before all other agents. Output stored as 'product_context' in memory.
    """

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
            f"IMPORTANT: Extract only what is explicitly stated. "
            f"You have {len(ingest)} research input(s). "
            f"Return a single JSON object with exactly these keys: "
            f"product_name, product_description, target_user, core_workflow, "
            f"constraints, competitors, goals, raw_summary."
        )
        return super().build_prompt(enriched_task, context=slice_, memory=None)
