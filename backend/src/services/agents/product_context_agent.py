# services/agents/product_context_agent.py

from services.agents.base_agent import BaseAgent


class ProductContextAgent(BaseAgent):
    """
    Step 0: Extracts structured product context from raw ingest + user context.
    Runs before all other agents. Output stored as 'product_context' in memory.
    """

    def build_prompt(self, task: str, context: dict = None, memory: dict = None) -> str:
        ctx = context or {}
        product_context = ctx.get("product_context") or ctx.get("context", {})
        ingest = ctx.get("ingest", [])

        prompt_context = {
            "existing_product_context": product_context,
            "research_context": ingest,
        }

        if ctx.get("previous_attempt_failure"):
            prompt_context["previous_attempt_failure"] = ctx["previous_attempt_failure"]

        prompt_task = (
            f"{task}\n\n"
            f"Extract only what is explicitly stated. You have {len(ingest)} research input(s). "
            "Do not infer missing product details beyond the tagged context."
        )
        return super().build_prompt(prompt_task, context=prompt_context, memory=None)
