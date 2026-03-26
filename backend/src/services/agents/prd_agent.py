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
            "problems": problems,
            "features": features,
            "decompositions": decompositions,
            "tasks": tasks,
        }

        context_str = json.dumps(slice_, indent=2)

        # Concrete output template so the model cannot confuse object vs array
        output_template = json.dumps({
            "executive_summary": "One-paragraph overview of the product and its purpose.",
            "problem_statement": "Detailed description of the core problems being solved.",
            "goals": ["Specific, measurable goal 1", "Goal 2"],
            "features": [{"title": "Feature name", "description": "Feature description and value"}],
            "architecture": "Technical architecture and system design overview.",
            "implementation_plan": [{"phase": "Phase name", "description": "What gets built and why"}],
            "risks": [{"risk": "Risk description", "mitigation": "Mitigation strategy"}],
            "success_metrics": ["Metric 1 with target value", "Metric 2"],
        }, indent=2)

        return (
            f"ROLE: {self.role}\n\n"
            f"CONTEXT (pipeline outputs — use this data, do not invent):\n{context_str}\n\n"
            f"INSTRUCTIONS:\n{self.instructions}\n\n"
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
