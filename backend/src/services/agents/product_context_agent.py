# services/agents/product_context_agent.py

import logging
from typing import Any

from services.agents.base_agent import BaseAgent
from services.db.supabase_async import run_sync
from services.db.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


class ProductContextAgent(BaseAgent):
    """
    Step 0: Extracts structured product context from raw ingest + user context.
    Runs before all other agents. Output stored as 'product_context' in memory.
    """

    def build_prompt(self, task: str, context: dict = None, memory: dict = None) -> str:
        ctx = context or {}
        mem = memory or {}
        product_context = ctx.get("product_context") or ctx.get("context", {})
        ingest = self._merged_research_context(ctx, mem)

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

    async def _persist_product_profile(self, session_id: str, user_id: str, profile_data: dict):
        payload = {
            "user_id": user_id,
            "product_name": profile_data.get("product_name"),
            "product_description": profile_data.get("product_description"),
            "target_user": profile_data.get("target_user"),
            "core_workflow": profile_data.get("core_workflow"),
            "constraints": profile_data.get("constraints"),
            "competitors": profile_data.get("competitors"),
            "goals": profile_data.get("goals"),
            "raw_summary": profile_data.get("raw_summary"),
            "updated_at": "now()",
        }

        def _upsert():
            client = get_supabase_client()
            return (
                client.table("product_profiles")
                .upsert(payload, on_conflict="user_id,product_name")
                .execute()
            )

        await run_sync(_upsert)
        logger.info(f"[ProductContextAgent] persisted product_profile for session {session_id}")

    async def execute_async(
        self,
        task: str,
        context: dict = None,
        memory: dict = None,
        session: dict = None,
    ) -> Any:
        result = await super().execute_async(task, context=context, memory=memory, session=session)
        if not isinstance(result, dict):
            logger.debug(
                "Skipping product profile persistence for agent=%s: result is %s",
                self.name,
                type(result).__name__,
            )
            return result

        session_id = (session or {}).get("id")
        user_id = (session or {}).get("user_id")
        product_name = result.get("product_name")
        if not user_id or not product_name:
            logger.debug(
                "Skipping product profile persistence for agent=%s: user_id_present=%s product_name_present=%s",
                self.name,
                bool(user_id),
                bool(product_name),
            )
            return result

        try:
            await self._persist_product_profile(session_id, user_id, result)
        except Exception:
            logger.exception(
                "Failed to persist product profile for user_id=%s product_name=%s",
                user_id,
                product_name,
            )

        return result
