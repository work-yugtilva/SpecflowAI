import json
import logging
from services.agents.base_agent import BaseAgent
from services.ai.client import run_ai

logger = logging.getLogger("specflow.quality_gate")


class QualityGateAgent(BaseAgent):
    """
    Validates pipeline step output using a binary pass/fail rubric.
    Check definitions and thresholds are read from quality_gate.yaml — nothing hardcoded here.
    Does NOT modify the output — only evaluates it.
    """

    def _get_threshold(self, step_name: str) -> int:
        thresholds = self.config.get("thresholds", {})
        return thresholds.get(step_name, thresholds.get("default", 65))

    def _build_check_prompt(self, step_name: str, output: list, research_context: dict) -> str:
        binary_checks = self.config.get("binary_checks", [])
        checks_text = "\n".join(
            f"  CHECK — {c['name'].upper()}:\n"
            f"    PASS: {c['pass_condition']}\n"
            f"    FAIL: {c['fail_condition']}"
            + (f"\n    NOTE: auto-PASS if the field is absent" if c.get("auto_pass_if_missing") else "")
            for c in binary_checks
        )

        return (
            f"ROLE: {self.role}\n\n"
            f"INSTRUCTIONS:\n{self.instructions}\n\n"
            f"BINARY CHECKS TO APPLY TO EACH ITEM:\n{checks_text}\n\n"
            f"STEP: {step_name}\n"
            f"OUTPUT TO EVALUATE ({len(output)} items):\n"
            f"{json.dumps(output[:8], indent=2)}\n\n"
            f"RESEARCH CONTEXT (what claims must be traceable to):\n"
            f"{json.dumps(research_context, indent=2)[:2000]}\n\n"
            f"Return a JSON object with these exact keys:\n"
            f"  items: array — one entry per evaluated item, each with:\n"
            f"    index (int), binary_checks (object mapping check name to bool),\n"
            f"    quality_issues (array of strings, one per failing check), quality_flag ('binary_fail' or null)\n"
            f"  critical_issues: array of strings (aggregate of all quality_issues)\n"
            f"Return ONLY the JSON object. No markdown."
        )

    def evaluate(self, step_name: str, output: list, research_context: dict) -> dict:
        """
        Evaluate a step output using binary pass/fail checks from config.
        Returns backward-compatible dict: score, passed, critical_issues, item_scores, items.
        """
        threshold = self._get_threshold(step_name)

        if not output or not isinstance(output, list):
            return {
                "score": 0,
                "passed": False,
                "critical_issues": [f"No valid {step_name} output — list is empty or malformed"],
                "item_scores": [],
                "items": [],
            }

        binary_checks = self.config.get("binary_checks", [])
        num_checks = len(binary_checks) or 1

        prompt = self._build_check_prompt(step_name, output, research_context)

        try:
            raw = run_ai(
                prompt,
                max_tokens=self.config.get("token_control", {}).get("max_output_tokens", 2048),
                model=self.config.get("model"),
                temperature=self.config.get("temperature", 0.1),
            )
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[-1]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("```", 1)[0]
            result = json.loads(cleaned.strip())

            items = result.get("items", [])
            critical_issues = result.get("critical_issues", [])

            # Ensure quality_flag is set on items that failed any check
            for item in items:
                checks = item.get("binary_checks", {})
                if checks and not all(checks.values()):
                    item["quality_flag"] = "binary_fail"
                else:
                    item.setdefault("quality_flag", None)

            # score = (items where all checks pass / total) * 100
            fully_passing = sum(
                1 for item in items if all(item.get("binary_checks", {}).values())
            )
            total = len(items) or len(output)
            score = round((fully_passing / total) * 100)
            passed = score >= threshold

            # item_scores: (passing checks / total checks) * 100 per item
            item_scores = []
            for i, item in enumerate(items):
                checks = item.get("binary_checks", {})
                passing = sum(1 for v in checks.values() if v)
                item_scores.append({
                    "id": output[i].get("id", f"item_{i}") if i < len(output) else f"item_{i}",
                    "score": round((passing / num_checks) * 100),
                })

            if not passed:
                logger.warning(
                    "[quality_gate] step=%s score=%d threshold=%d passed=False issues=%s",
                    step_name, score, threshold, critical_issues[:3],
                )
            else:
                logger.info("[quality_gate] step=%s score=%d passed=True", step_name, score)

            return {
                "score": score,
                "passed": passed,
                "critical_issues": critical_issues,
                "item_scores": item_scores,
                "items": items,
            }

        except Exception as e:
            logger.error("[quality_gate] evaluation failed for step=%s: %s", step_name, e)
            return {
                "score": 0,
                "passed": False,
                "critical_issues": [f"Quality gate evaluation failed: {e}"],
                "item_scores": [],
                "items": [],
            }
