import logging

from services.agents.base_agent import BaseAgent
from services.ai.client import run_ai, run_ai_async
from services.db.supabase_async import run_sync
from services.db.supabase_client import get_supabase_client

logger = logging.getLogger("specflow.quality_gate")


class QualityGateAgent(BaseAgent):
    """
    Validates pipeline step output using a binary pass/fail rubric.
    Check definitions and thresholds are read from quality_gate.yaml — nothing hardcoded here.
    Does NOT modify the output — only evaluates it.
    """

    _IMPERATIVE_VERBS = frozenset({
        "implement", "add", "create", "build", "write", "fix", "update",
        "integrate", "configure", "deploy", "set", "migrate", "refactor",
        "test", "define", "establish", "connect", "generate", "validate",
        "optimize", "remove", "delete", "move", "expose", "wire",
        "seed", "scaffold", "document", "enable", "disable",
    })

    def _get_threshold(self, step_name: str) -> int:
        thresholds = self.config.get("thresholds", {})
        return thresholds.get(step_name, thresholds.get("default", 65))

    async def _persist_quality_score(
        self,
        session_id: str,
        step_name: str,
        score: float,
        passed: bool,
        details: dict,
    ):
        payload = {
            "session_id": session_id,
            "step_name": step_name,
            "score": score,
            "passed": passed,
            "critical_issues": details.get("critical_issues", []),
            "item_scores": details.get("item_scores", []),
            "created_at": "now()",
        }

        def _insert():
            client = get_supabase_client()
            return client.table("quality_scores").insert(payload).execute()

        await run_sync(_insert)

    async def _persist_quality_score_if_session(self, step_name: str, result: dict) -> dict:
        session_id = getattr(self, "session_id", None)
        if not session_id:
            logger.debug(
                "Skipping quality score persistence for step=%s: missing session_id",
                step_name,
            )
            return result

        try:
            await self._persist_quality_score(
                session_id=session_id,
                step_name=step_name,
                score=result.get("score", 0),
                passed=result.get("passed", False),
                details=result,
            )
        except Exception:
            logger.exception(
                "Failed to persist quality score for session_id=%s step=%s",
                session_id,
                step_name,
            )

        return result

    def _build_check_prompt(self, step_name: str, output: list, research_context: dict) -> str:
        binary_checks = self.config.get("binary_checks", [])

        return "\n\n".join([
            self._wrap_xml("role", self.role),
            self._wrap_xml("instructions", self.instructions),
            self._wrap_xml("step_name", step_name),
            self._wrap_xml("binary_checks", binary_checks),
            self._wrap_xml("output_to_evaluate", output[:8]),
            self._wrap_xml("research_context", research_context),
            self._wrap_xml(
                "response_contract",
                (
                    "Return ONLY a JSON object with keys: reasoning, items, critical_issues.\n"
                    "Each items entry must include index, binary_checks, quality_issues, and quality_flag.\n"
                    "Set quality_flag to 'binary_fail' when any binary check fails, otherwise null."
                ),
            ),
        ])

    def _run_deterministic_checks(self, step_name: str, output: list) -> list[str]:
        """
        Run pure-Python structural checks before calling the LLM.
        Returns a list of human-readable failure strings; empty list means all passed.
        """
        failures = []

        if step_name == "features":
            if not output:
                failures.append("features: output list is empty")
                return failures
            for i, feat in enumerate(output):
                ac = feat.get("acceptance_criteria")
                if not ac or (isinstance(ac, str) and not ac.strip()) or (isinstance(ac, list) and len(ac) == 0):
                    failures.append(f"features[{i}]: acceptance_criteria is missing or empty")
                linked = feat.get("linked_problems")
                if not linked or not isinstance(linked, list) or len(linked) == 0:
                    failures.append(f"features[{i}]: linked_problems is missing or empty")

        elif step_name == "tasks":
            for i, task in enumerate(output):
                title = task.get("title", "")
                first_word = title.split()[0].lower().rstrip(".,;:!") if title.split() else ""
                if first_word not in self._IMPERATIVE_VERBS:
                    failures.append(
                        f"tasks[{i}]: title '{title}' does not start with an imperative verb"
                    )
                ac = task.get("acceptance_criteria")
                if not ac or (isinstance(ac, str) and not ac.strip()):
                    failures.append(f"tasks[{i}]: acceptance_criteria is missing or empty")

        for i, item in enumerate(output):
            research_evidence = item.get("research_evidence")
            if "research_evidence" in item:
                if not research_evidence or (isinstance(research_evidence, str) and not research_evidence.strip()):
                    failures.append(
                        f"{step_name}[{i}]: research_evidence is empty — must cite source or state 'Insufficient source data'"
                    )
            citation_confidence = item.get("citation_confidence")
            if citation_confidence is not None and citation_confidence not in (
                "high", "medium", "insufficient", "high | medium | low"
            ):
                failures.append(
                    f"{step_name}[{i}]: citation_confidence has invalid value '{citation_confidence}'"
                )

        return failures

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

        # Deterministic pre-checks — fail fast before touching the LLM
        det_failures = self._run_deterministic_checks(step_name, output)
        if det_failures:
            logger.warning(
                "[quality_gate][deterministic] step=%s failures=%s",
                step_name, det_failures,
            )
            return {
                "score": 0,
                "passed": False,
                "critical_issues": det_failures,
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
            result = self.parse_json(raw)

            if isinstance(result, dict):
                result.pop("reasoning", None)

            items = result.get("items", []) if isinstance(result, dict) else []
            critical_issues = result.get("critical_issues", []) if isinstance(result, dict) else []

            for item in items:
                checks = item.get("binary_checks", {})
                if checks and not all(checks.values()):
                    item["quality_flag"] = "binary_fail"
                else:
                    item.setdefault("quality_flag", None)

            fully_passing = sum(
                1 for item in items if all(item.get("binary_checks", {}).values())
            )
            total = len(items) or len(output)
            score = round((fully_passing / total) * 100)
            passed = score >= threshold

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
                    step_name,
                    score,
                    threshold,
                    critical_issues[:3],
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

    async def evaluate_async(self, step_name: str, output: list, research_context: dict) -> dict:
        """
        Async version of evaluate() — uses run_ai_async to avoid blocking the event loop.
        Returns backward-compatible dict: score, passed, critical_issues, item_scores, items.
        """
        threshold = self._get_threshold(step_name)

        if not output or not isinstance(output, list):
            result = {
                "score": 0,
                "passed": False,
                "critical_issues": [f"No valid {step_name} output — list is empty or malformed"],
                "item_scores": [],
                "items": [],
            }
            return await self._persist_quality_score_if_session(step_name, result)

        # Deterministic pre-checks — fail fast before touching the LLM
        det_failures = self._run_deterministic_checks(step_name, output)
        if det_failures:
            logger.warning(
                "[quality_gate_async][deterministic] step=%s failures=%s",
                step_name, det_failures,
            )
            result = {
                "score": 0,
                "passed": False,
                "critical_issues": det_failures,
                "item_scores": [],
                "items": [],
            }
            return await self._persist_quality_score_if_session(step_name, result)

        binary_checks = self.config.get("binary_checks", [])
        num_checks = len(binary_checks) or 1

        prompt = self._build_check_prompt(step_name, output, research_context)

        try:
            raw = await run_ai_async(
                prompt,
                max_tokens=self.config.get("token_control", {}).get("max_output_tokens", 2048),
                model=self.config.get("model"),
                temperature=self.config.get("temperature", 0.1),
            )
            result = self.parse_json(raw)

            if isinstance(result, dict):
                result.pop("reasoning", None)

            items = result.get("items", []) if isinstance(result, dict) else []
            critical_issues = result.get("critical_issues", []) if isinstance(result, dict) else []

            for item in items:
                checks = item.get("binary_checks", {})
                if checks and not all(checks.values()):
                    item["quality_flag"] = "binary_fail"
                else:
                    item.setdefault("quality_flag", None)

            fully_passing = sum(
                1 for item in items if all(item.get("binary_checks", {}).values())
            )
            total = len(items) or len(output)
            score = round((fully_passing / total) * 100)
            passed = score >= threshold

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
                    "[quality_gate_async] step=%s score=%d threshold=%d passed=False issues=%s",
                    step_name,
                    score,
                    threshold,
                    critical_issues[:3],
                )
            else:
                logger.info("[quality_gate_async] step=%s score=%d passed=True", step_name, score)

            result = {
                "score": score,
                "passed": passed,
                "critical_issues": critical_issues,
                "item_scores": item_scores,
                "items": items,
            }
            return await self._persist_quality_score_if_session(step_name, result)

        except Exception as e:
            logger.error("[quality_gate_async] evaluation failed for step=%s: %s", step_name, e)
            result = {
                "score": 0,
                "passed": False,
                "critical_issues": [f"Quality gate evaluation failed: {e}"],
                "item_scores": [],
                "items": [],
            }
            return await self._persist_quality_score_if_session(step_name, result)
