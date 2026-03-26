# services/agents/prd_agent.py

import json
import logging

from services.agents.base_agent import BaseAgent
from services.ai.client import run_ai

logger = logging.getLogger("specflow.prd_agent")


class PRDAgent(BaseAgent):
    """Receives product_context + problems + features + decompositions + tasks."""

    def _unwrap(self, val):
        if isinstance(val, dict) and list(val.keys()) == ["data"]:
            return val["data"]
        return val

    def build_prompt(self, task: str, context: dict = None, memory: dict = None) -> str:
        ctx = context or {}
        mem = memory or {}
        product_context = self._unwrap(ctx.get("product_context") or mem.get("product_context", {}))
        problems = self._unwrap(ctx.get("problems") or mem.get("problems", []))
        features = self._unwrap(ctx.get("features") or mem.get("features", []))
        decompositions = self._unwrap(ctx.get("decompositions") or mem.get("decompositions", []))
        tasks = self._unwrap(ctx.get("tasks") or mem.get("tasks", {}))

        if not isinstance(problems, list):
            problems = [problems] if problems else []
        if not isinstance(features, list):
            features = [features] if features else []
        if not isinstance(decompositions, list):
            decompositions = [decompositions] if decompositions else []

        slice_ = {
            "product_context": product_context,
            "problems": problems,
            "features": features,
            "decompositions": decompositions,
            "tasks": tasks,
        }

        context_str = json.dumps(slice_, indent=2)

        # Nested output template — model must return an object, not an array
        output_template = json.dumps({
            "executive_summary": "2-3 sentences. Must name the product, target user, and core value prop.",
            "problem_statement": "Specific problem with evidence from the research. No generic claims.",
            "goals": [
                {
                    "goal": "Specific measurable outcome",
                    "metric": "How we measure it",
                    "target": "Specific number or threshold",
                    "timeline": "When",
                }
            ],
            "features": [
                {
                    "title": "Feature name",
                    "description": "What it does",
                    "acceptance_criteria": "Specific, testable pass/fail criteria",
                    "linked_problem": "Which problem it solves",
                }
            ],
            "architecture": {
                "frontend": "What the UI layer does",
                "backend": "What the server layer does",
                "data": "What gets stored and how",
            },
            "implementation_plan": [
                {
                    "phase": "Phase name",
                    "deliverables": ["specific thing 1", "specific thing 2"],
                    "duration": "estimate",
                }
            ],
            "risks": [
                {
                    "risk": "Specific risk description",
                    "likelihood": "high | medium | low",
                    "mitigation": "Concrete mitigation step",
                }
            ],
            "success_metrics": [
                {
                    "metric": "Metric name",
                    "baseline": "Current state",
                    "target": "Goal state",
                    "measurement": "How to measure",
                }
            ],
        }, indent=2)

        gaps_note = ""
        if ctx.get("_prd_gaps") or mem.get("_prd_gaps"):
            gaps_note = f"\nPREVIOUS ATTEMPT GAPS (fix these): {ctx.get('_prd_gaps') or mem.get('_prd_gaps')}\n"

        return (
            f"ROLE: {self.role}\n\n"
            f"CONTEXT (pipeline outputs — use this data, do not invent):\n{context_str}\n\n"
            f"INSTRUCTIONS:\n{self.instructions}\n"
            f"{gaps_note}\n"
            f"TASK: {task}\n"
            f"INPUT: {len(problems)} problems, {len(features)} features, "
            f"{len(decompositions)} components, {len(tasks) if isinstance(tasks, list) else 1} task group(s).\n\n"
            f"CRITICAL: Return a SINGLE JSON object — NOT an array. "
            f"The object must have exactly these keys: "
            f"executive_summary, problem_statement, goals, features, architecture, "
            f"implementation_plan, risks, success_metrics.\n"
            f"Required format:\n{output_template}\n\n"
            f"Return ONLY the JSON object. No markdown fences. No arrays wrapping it. No extra text."
        )

    def self_critique(self, prd_output) -> dict:
        """
        Score the PRD 0-100 on specificity, completeness, actionability, coherence.
        Returns {score: int, critical_gaps: [str]}.
        If score < 70, logs gaps but does NOT block generation.
        """
        prompt = (
            "Score this PRD 0-100 on specificity, completeness, actionability, coherence.\n"
            'Return JSON: {"score": <int>, "critical_gaps": [<str>]}.\n'
            "If score < 70, list the gaps. If score >= 70, critical_gaps can be empty.\n\n"
            f"PRD:\n{json.dumps(prd_output, indent=2)}"
        )
        try:
            raw = run_ai(
                prompt,
                max_tokens=1024,
                model=self.config.get("model"),
                temperature=0.3,
            )
            cleaned = raw.strip()
            # Strip markdown fences if present
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[-1]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("```", 1)[0]
            cleaned = cleaned.strip()

            result = json.loads(cleaned)
            score = int(result.get("score", 0))
            gaps = result.get("critical_gaps", [])
            if score < 70:
                logger.warning("[prd] quality_score=%d critical_gaps=%s", score, gaps)
            else:
                logger.info("[prd] quality_score=%d", score)
            return {"score": score, "critical_gaps": gaps}
        except Exception as e:
            logger.error("[prd] self_critique failed: %s", e)
            return {"score": 0, "critical_gaps": ["Self-critique failed"]}

    async def run(self, memory: dict):
        """
        Wraps execute_async with critique-gated single retry.
        Returns (draft_dict, quality_dict).
        """
        context = {
            key: self._unwrap(memory.get(key, []))
            for key in ("product_context", "problems", "features", "decompositions", "tasks")
        }
        if memory.get("_prd_gaps"):
            context["_prd_gaps"] = memory["_prd_gaps"]

        draft = await self.execute_async(
            "Generate a comprehensive Product Requirements Document.",
            context=context,
            memory=memory,
        )
        # LLM sometimes wraps the PRD dict in an array — unwrap it
        if isinstance(draft, list) and len(draft) >= 1 and isinstance(draft[0], dict):
            logger.warning("[prd] LLM returned list, unwrapping first element")
            draft = draft[0]
        critique = self.self_critique(draft)
        if critique["score"] < 70 and not memory.get("_prd_retry"):
            memory["_prd_retry"] = True
            gaps_str = "; ".join(critique["critical_gaps"])
            memory["_prd_gaps"] = f"Previous draft scored {critique['score']}/100. Fix: {gaps_str}"
            logger.info("[prd] score=%d < 70, retrying once with gap context", critique["score"])
            return await self.run(memory)
        return draft, critique
