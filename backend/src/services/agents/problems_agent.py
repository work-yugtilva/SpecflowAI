# services/agents/problems_agent.py

from services.agents.base_agent import BaseAgent


class ProblemsAgent(BaseAgent):
    """Receives product_context + ingest only — never sees downstream outputs."""

    def _unwrap(self, val):
        if isinstance(val, dict) and list(val.keys()) == ["data"]:
            return val["data"]
        return val

    def _has_meaningful_source_signal(self, context: dict = None, memory: dict = None) -> bool:
        ctx = context or {}
        if isinstance(ctx.get("analytics_context"), str) and ctx["analytics_context"].strip():
            return True

        items = [
            *self._bounded_research_context(ctx, memory or {}),
            *self._clip_list(self._unwrap(ctx.get("rag_context")), None),
        ]
        for item in items:
            if isinstance(item, str) and item.strip():
                return True
            if not isinstance(item, dict):
                continue
            for key in ("content", "summary", "pain_point", "text", "title", "notes"):
                value = item.get(key)
                if isinstance(value, str) and value.strip():
                    return True
        return False

    def build_prompt(self, task: str, context: dict = None, memory: dict = None) -> str:
        ctx = context or {}
        mem = memory or {}
        product_context = self._unwrap(
            ctx.get("product_context") or ctx.get("context") or mem.get("product_context", {})
        )
        ingest = self._bounded_research_context(ctx, mem)

        prompt_context = {
            "product_context": product_context,
            "research_context": ingest,
        }

        if ctx.get("rag_context"):
            prompt_context["rag_context"] = ctx["rag_context"]

        if ctx.get("analytics_context"):
            prompt_context["analytics_context"] = ctx["analytics_context"]

        if ctx.get("previous_attempt_failure"):
            prompt_context["previous_attempt_failure"] = ctx["previous_attempt_failure"]

        return super().build_prompt(task, context=prompt_context, memory=None)

    async def execute_async(
        self,
        task: str,
        context: dict = None,
        memory: dict = None,
        session: dict = None,
    ):
        if not self._has_meaningful_source_signal(context, memory):
            return []

        problems = await super().execute_async(
            task,
            context=context,
            memory=memory,
            session=session,
        )
        if not problems or len(problems) == 0:
            return []
        return problems

    def execute(
        self,
        task: str,
        context: dict = None,
        memory: dict = None,
        session: dict = None,
    ):
        if not self._has_meaningful_source_signal(context, memory):
            return []

        problems = super().execute(
            task,
            context=context,
            memory=memory,
            session=session,
        )
        if not problems or len(problems) == 0:
            return []
        return problems
