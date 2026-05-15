# services/agents/ui_spec_agent.py

import logging
from services.agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

_NO_EVIDENCE_WARNING = "No source evidence available — ui_specs skipped."


class UISpecAgent(BaseAgent):
    """
    Generates structured UI/data/workflow specification objects.
    Output shape: {"ui_specs": [...], "quality_warning": null | str}
    Reads: product_context, ingest, problems, features, decompositions (memory key: decompose).
    """

    def _unwrap(self, val):
        if isinstance(val, dict) and list(val.keys()) == ["data"]:
            return val["data"]
        return val

    def _has_meaningful_source_signal(
        self, context: dict = None, memory: dict = None
    ) -> bool:
        ctx = context or {}
        mem = memory or {}

        if isinstance(ctx.get("analytics_context"), str) and ctx["analytics_context"].strip():
            return True

        for item in self._bounded_research_context(ctx, mem):
            if isinstance(item, str) and item.strip():
                return True
            if isinstance(item, dict):
                for key in ("content", "summary", "pain_point", "text", "title", "notes"):
                    if isinstance(item.get(key), str) and item[key].strip():
                        return True

        rag = ctx.get("rag_context") or []
        if isinstance(rag, list):
            for item in rag:
                if isinstance(item, dict):
                    for key in ("content", "title", "text"):
                        if isinstance(item.get(key), str) and item[key].strip():
                            return True

        # Non-empty decompositions are sufficient signal
        decomps = self._unwrap(ctx.get("decompositions") or mem.get("decompositions", []))
        return isinstance(decomps, list) and len(decomps) > 0

    def build_prompt(self, task: str, context: dict = None, memory: dict = None) -> str:
        ctx = context or {}
        mem = memory or {}

        prompt_context = {
            "product_context": self._unwrap(
                ctx.get("product_context") or ctx.get("context") or mem.get("product_context", {})
            ),
            "research_context": self._bounded_research_context(ctx, mem),
            "prior_problems": self._clip_list(
                self._unwrap(ctx.get("problems") or mem.get("problems", [])), 4
            ),
            "prior_features": self._clip_list(
                self._unwrap(ctx.get("features") or mem.get("features", [])), 6
            ),
            "prior_decompositions": self._clip_list(
                self._unwrap(ctx.get("decompositions") or mem.get("decompositions", [])), 8
            ),
        }

        for opt in ("rag_context", "analytics_context", "previous_attempt_failure"):
            if ctx.get(opt):
                prompt_context[opt] = ctx[opt]

        return super().build_prompt(task, context=prompt_context, memory=None)

    async def execute_async(
        self,
        task: str,
        context: dict = None,
        memory: dict = None,
        session: dict = None,
    ):
        if not self._has_meaningful_source_signal(context, memory):
            logger.info("[ui_spec_agent] no source signal — returning empty ui_specs")
            return {"ui_specs": [], "quality_warning": _NO_EVIDENCE_WARNING}

        raw = await super().execute_async(
            task, context=context, memory=memory, session=session
        )

        if isinstance(raw, dict):
            specs = raw.get("ui_specs", [])
            warning = raw.get("quality_warning") or None
        elif isinstance(raw, list):
            specs = raw
            warning = None
        else:
            specs = []
            warning = "Unexpected output shape from model."

        if not isinstance(specs, list):
            specs = []

        logger.info(
            "[ui_spec_agent] specs=%d quality_warning=%s", len(specs), bool(warning)
        )
        result: dict = {"ui_specs": specs}
        if warning:
            result["quality_warning"] = warning
        return result

    def execute(
        self,
        task: str,
        context: dict = None,
        memory: dict = None,
        session: dict = None,
    ):
        if not self._has_meaningful_source_signal(context, memory):
            return {"ui_specs": [], "quality_warning": _NO_EVIDENCE_WARNING}

        raw = super().execute(task, context=context, memory=memory, session=session)

        if isinstance(raw, dict):
            specs = raw.get("ui_specs", [])
            warning = raw.get("quality_warning") or None
        elif isinstance(raw, list):
            specs = raw
            warning = None
        else:
            specs = []
            warning = "Unexpected output shape from model."

        if not isinstance(specs, list):
            specs = []

        result: dict = {"ui_specs": specs}
        if warning:
            result["quality_warning"] = warning
        return result
