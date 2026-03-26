import json
import logging
from services.agents.base_agent import BaseAgent
from services.ai.client import run_ai

logger = logging.getLogger("specflow.quality_gate")

# Minimum scores required to pass each step
STEP_THRESHOLDS = {
    "problems": 65,
    "features": 65,
    "decompose": 60,
    "tasks": 60,
}


class QualityGateAgent(BaseAgent):
    """
    Validates pipeline step output. Returns score, pass/fail, and critical issues.
    Does NOT modify the output — only evaluates it.
    """

    def evaluate(self, step_name: str, output: list, research_context: dict) -> dict:
        """
        Synchronously evaluate a step output.
        Returns {"score": int, "passed": bool, "critical_issues": [str], "item_scores": []}
        """
        threshold = STEP_THRESHOLDS.get(step_name, 65)

        if not output or not isinstance(output, list):
            return {
                "score": 0,
                "passed": False,
                "critical_issues": [f"No valid {step_name} output — list is empty or malformed"],
                "item_scores": [],
            }

        prompt = (
            f"ROLE: {self.role}\n\n"
            f"INSTRUCTIONS:\n{self.instructions}\n\n"
            f"STEP: {step_name}\n"
            f"THRESHOLD: {threshold}/100 required to pass\n\n"
            f"OUTPUT TO EVALUATE ({len(output)} items):\n{json.dumps(output[:8], indent=2)}\n\n"
            f"RESEARCH CONTEXT (what the output should reference):\n"
            f"{json.dumps(research_context, indent=2)[:2000]}\n\n"
            f"Return JSON with keys: score (int 0-100), passed (bool), "
            f"critical_issues (list of strings), item_scores (list of {{id, score}} dicts).\n"
            f"'passed' must be true only if score >= {threshold}.\n"
            f"Return ONLY the JSON object. No markdown."
        )

        try:
            raw = run_ai(
                prompt,
                max_tokens=1024,
                model=self.config.get("model"),
                temperature=0.2,
            )
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[-1]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("```", 1)[0]
            result = json.loads(cleaned.strip())

            score = int(result.get("score", 0))
            passed = bool(result.get("passed", score >= threshold))
            issues = result.get("critical_issues", [])
            item_scores = result.get("item_scores", [])

            if score < threshold:
                logger.warning(
                    "[quality_gate] step=%s score=%d threshold=%d passed=%s issues=%s",
                    step_name, score, threshold, passed, issues[:3]
                )
            else:
                logger.info("[quality_gate] step=%s score=%d passed=True", step_name, score)

            return {"score": score, "passed": passed, "critical_issues": issues, "item_scores": item_scores}

        except Exception as e:
            logger.error("[quality_gate] evaluation failed for step=%s: %s", step_name, e)
            return {
                "score": 0,
                "passed": False,
                "critical_issues": [f"Quality gate evaluation failed: {e}"],
                "item_scores": [],
            }
