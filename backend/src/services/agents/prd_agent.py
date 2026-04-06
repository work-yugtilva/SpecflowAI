# services/agents/prd_agent.py

import logging

from services.agents.base_agent import BaseAgent
from services.ai.client import run_ai, run_ai_async

logger = logging.getLogger("specflow.prd_agent")


class PRDAgent(BaseAgent):
    """Receives product_context + problems + features + decompositions + tasks."""

    def _unwrap(self, val):
        if isinstance(val, dict) and list(val.keys()) == ["data"]:
            return val["data"]
        return val

    def _build_prompt_context(self, context: dict = None, memory: dict = None) -> dict:
        ctx = context or {}
        mem = memory or {}

        product_context = self._unwrap(
            ctx.get("product_context") or ctx.get("context") or mem.get("product_context", {})
        )
        problems = self._clip_list(
            self._unwrap(ctx.get("problems") or mem.get("problems", [])),
            5,
        )
        features = self._clip_list(
            self._unwrap(ctx.get("features") or mem.get("features", [])),
            6,
        )
        decompositions = self._clip_list(
            self._unwrap(ctx.get("decompositions") or mem.get("decompositions", [])),
            8,
        )
        tasks = self._clip_list(
            self._unwrap(ctx.get("tasks") or mem.get("tasks", [])),
            10,
        )

        prompt_context = {
            "product_context": product_context,
            "prior_problems": problems,
            "prior_features": features,
            "prior_decompositions": decompositions,
            "prior_tasks": tasks,
        }

        if ctx.get("previous_attempt_failure"):
            prompt_context["previous_attempt_failure"] = ctx["previous_attempt_failure"]

        return prompt_context

    def build_prompt(self, task: str, context: dict = None, memory: dict = None) -> str:
        prompt_context = self._build_prompt_context(context=context, memory=memory)
        return super().build_prompt(task, context=prompt_context, memory=None)

    @staticmethod
    def _run_prd_deterministic_checks(prd_output: dict) -> list[str]:
        """
        Pure-Python structural pre-checks for PRD output before LLM critique.
        Returns list of failure strings; empty = all passed.
        """
        failures = []
        if not isinstance(prd_output, dict):
            return ["PRD output is not a dict"]
        exec_summary = prd_output.get("executive_summary")
        if not isinstance(exec_summary, str) or not exec_summary.strip():
            failures.append("PRD: executive_summary is missing or not a non-empty string")
        arch = prd_output.get("architecture")
        if not isinstance(arch, dict):
            failures.append("PRD: architecture is missing or not an object")
        else:
            for key in ("frontend", "backend"):
                if not arch.get(key):
                    failures.append(f"PRD: architecture.{key} is missing or empty")
        return failures

    async def self_critique(self, prd_output) -> dict:
        """
        Score the PRD 0-100 on specificity, completeness, actionability, coherence.
        Returns {reasoning: str, score: int, critical_gaps: [str]}.
        Async version — uses run_ai_async to avoid blocking the event loop.
        """
        # Deterministic pre-checks — fail fast before touching the LLM
        det_failures = self._run_prd_deterministic_checks(prd_output)
        if det_failures:
            logger.warning("[prd][deterministic] pre-check failed: %s", det_failures)
            return {
                "reasoning": "Deterministic structural checks failed before LLM critique.",
                "score": 0,
                "critical_gaps": det_failures,
            }

        prompt = "\n\n".join([
            self._wrap_xml(
                "instructions",
                (
                    "Score this PRD 0-100 on four dimensions, weighted equally:\n"
                    "1. Evidence grounding (25pts): Every factual claim traces to a verbatim quote or data point from the research context. Deduct 5pts per invented claim.\n"
                    "2. Goal quality (25pts): Every goal has a before/after baseline from research, a bounded target, and a measurement timeframe. Deduct 5pts per goal missing any of these.\n"
                    "3. Structural correctness (25pts): Architecture section contains no schema details, column names, or endpoint specs. Implementation plan has stated assumptions per phase. Deduct 10pts for each violation.\n"
                    "4. User outcome clarity (25pts): A non-technical reader (e.g. investor, new PM) could read the PRD and understand the user's problem, why existing tools fail, and what success looks like in 90 days. Deduct 5pts if the competitive displacement is absent.\n\n"
                    "Return score as the sum of all four dimensions. A PRD scoring below 70 MUST have critical_gaps listing the exact field and the exact fix needed."
                ),
            ),
            self._wrap_xml("prd_draft", prd_output),
            self._wrap_xml(
                "response_contract",
                (
                    "Return ONLY a JSON object with keys: reasoning, score, critical_gaps.\n"
                    "reasoning must briefly explain the score.\n"
                    "critical_gaps must be an array of concrete fixes."
                ),
            ),
        ])

        try:
            raw = await run_ai_async(
                prompt,
                max_tokens=1024,
                model=self.config.get("model"),
                temperature=0.3,
            )
            result = self.parse_json(raw)
            score = int(result.get("score", 0))
            gaps = [str(gap) for gap in result.get("critical_gaps", [])]
            reasoning = str(result.get("reasoning", ""))
            if score < 70:
                logger.warning("[prd] quality_score=%d critical_gaps=%s", score, gaps)
            else:
                logger.info("[prd] quality_score=%d", score)
            return {"reasoning": reasoning, "score": score, "critical_gaps": gaps}
        except Exception as e:
            logger.error("[prd] self_critique failed: %s", e)
            return {
                "reasoning": "Self-critique failed before a reliable score could be produced.",
                "score": 0,
                "critical_gaps": ["Self-critique failed"],
            }

    async def run(self, memory: dict):
        """
        Wraps execute_async with critique-gated single retry.
        Returns (draft_dict, quality_dict).
        """
        memory = memory or {}
        context = {}
        if memory.get("previous_attempt_failure"):
            context["previous_attempt_failure"] = memory["previous_attempt_failure"]
        elif memory.get("_prd_gaps"):
            context["previous_attempt_failure"] = memory["_prd_gaps"]

        draft = await self.execute_async(
            "Generate a comprehensive Product Requirements Document.",
            context=context,
            memory=memory,
        )
        if isinstance(draft, list) and len(draft) >= 1 and isinstance(draft[0], dict):
            logger.warning("[prd] LLM returned list, unwrapping first element")
            draft = draft[0]

        critique = await self.self_critique(draft)
        if critique["score"] < 70 and not memory.get("_prd_retry"):
            memory["_prd_retry"] = True
            memory["_prd_gaps"] = self.build_failure_feedback(
                source="prd_self_critique",
                attempt=1,
                score=critique["score"],
                critical_issues=critique["critical_gaps"],
            )
            memory["_prd_gaps"]["reasoning"] = critique.get("reasoning", "")
            logger.info("[prd] score=%d < 70, retrying once with structured failure context", critique["score"])
            return await self.run(memory)

        public_quality = {
            "score": critique["score"],
            "critical_gaps": critique["critical_gaps"],
        }
        return draft, public_quality
