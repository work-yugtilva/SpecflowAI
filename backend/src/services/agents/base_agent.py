# services/agents/base_agent.py

import asyncio
import json
import logging
import re
from typing import Any, Dict, List, Optional

from json_repair import loads as repair_loads
from core.exceptions import JSONParsingError
from services.ai.client import run_ai, run_ai_async

logger = logging.getLogger(__name__)


class BaseAgent:
    def __init__(self, name: str, config: dict):
        self.name = name
        self.config = config
        self.role = config.get("role", "Agent")
        self.instructions = config.get("instructions", "")
        self.max_retries = config.get("max_retries", 2)
        self.use_critic = config.get("use_critic", False)
        self.tools = config.get("tools", {})

    # -------------------------
    # PROMPT BUILDER
    # -------------------------
    def build_prompt(
        self,
        task: str,
        context: dict = None,
        memory: dict = None,
        response_contract_extra: str = "",
    ) -> str:
        output_schema = self.config.get("output_schema", {})
        schema_hint = self._build_schema_hint(output_schema) if output_schema else "JSON"
        blocks = [
            self._wrap_xml("role", self.role),
            self._wrap_xml("instructions", self.instructions),
            self._wrap_xml("task", task),
        ]

        for tag, value in self._iter_context_blocks(context):
            blocks.append(self._wrap_xml(tag, value))

        blocks.append(
            self._wrap_xml(
                "response_contract",
                self._build_response_contract(output_schema, schema_hint, response_contract_extra),
            )
        )
        return "\n\n".join(blocks)

    def _iter_context_blocks(self, context: dict | None) -> list[tuple[str, Any]]:
        if not context:
            return []
        if not isinstance(context, dict):
            return [("context", context)]

        blocks: list[tuple[str, Any]] = []
        for key, value in context.items():
            if value is None:
                continue
            tag = re.sub(r"[^a-zA-Z0-9_]+", "_", str(key)).strip("_") or "context"
            blocks.append((tag, value))
        return blocks

    def _wrap_xml(self, tag: str, value: Any) -> str:
        if isinstance(value, str):
            rendered = value.strip()
        else:
            rendered = json.dumps(value, indent=2, ensure_ascii=True)
        return f"<{tag}>\n{rendered}\n</{tag}>"

    def _build_response_contract(
        self,
        output_schema: dict,
        schema_hint: str,
        response_contract_extra: str = "",
    ) -> str:
        schema_type = (output_schema or {}).get("type", "object")
        lines = [
            "Return ONLY JSON. Do not emit markdown, prose, or code fences.",
            "Fill the top-level reasoning field first using only facts grounded in the tagged context.",
            "After reasoning, fill the final payload fields.",
        ]

        if schema_type == "list":
            lines.append("For list outputs, return an object with top-level metadata plus an items array.")

        if response_contract_extra:
            lines.append(response_contract_extra.strip())

        lines.append("Schema:")
        lines.append(schema_hint)
        return "\n".join(lines)

    def _build_schema_hint(self, schema: dict) -> str:
        """Generate a concrete JSON example from the output_schema config."""
        if not schema:
            return '{"result": "..."}'

        schema_type = schema.get("type", "object")

        if schema_type == "list":
            envelope_fields = {}
            for key in ("sections", "groups"):
                value = schema.get(key)
                if isinstance(value, dict):
                    envelope_fields.update(value)
            item_fields = schema.get("fields") or {}

            example = self._fields_to_example(envelope_fields) if envelope_fields else {}
            example["items"] = [self._fields_to_example(item_fields)] if item_fields else []
            return json.dumps(example, indent=2)

        combined = {}
        for key in ("fields", "sections", "groups"):
            value = schema.get(key)
            if isinstance(value, dict):
                combined.update(value)

        if not combined:
            return '{"result": "..."}'
        return json.dumps(self._fields_to_example(combined), indent=2)

    def _fields_to_example(self, fields) -> Any:
        """Recursively build an example object from field definitions."""
        if isinstance(fields, list):
            if not fields:
                return ["..."]
            return [self._fields_to_example(fields[0])]

        if not isinstance(fields, dict):
            if fields == "string":
                return "..."
            if fields == "number":
                return 0
            if fields == "boolean":
                return False
            if fields == "list":
                return ["..."]
            if fields == "object":
                return {}
            return "..."

        result = {}
        for key, val in fields.items():
            result[key] = self._fields_to_example(val)
        return result

    def _clip_list(self, values: Any, limit: int | None) -> list:
        if not isinstance(values, list):
            return [values] if values else []
        if limit is None:
            return values
        return values[:limit]

    # -------------------------
    # JSON PARSER
    # -------------------------
    def parse_json(self, text: str):
        snippet = (text or "")[:200]
        try:
            result = repair_loads(text)
            # json_repair returns the input as a string when it cannot find JSON structure
            if not isinstance(result, (dict, list)):
                raise ValueError(f"json_repair returned {type(result).__name__}, expected dict or list")
            return result
        except JSONParsingError:
            raise
        except Exception as e:
            logger.error(
                "[parse_json] agent=%s failed: %s | snippet=%r",
                self.name, e, snippet,
            )
            raise JSONParsingError(str(e), raw_snippet=snippet) from e

    def strip_reasoning_field(self, output: Any) -> Any:
        if isinstance(output, dict) and "reasoning" in output:
            return {key: value for key, value in output.items() if key != "reasoning"}
        return output

    # -------------------------
    # TOOL EXECUTION
    # -------------------------
    def run_tools(self, output):
        if not isinstance(output, dict):
            return output

        tool_name = output.get("tool")

        if tool_name and tool_name in self.tools:
            tool_fn = self.tools[tool_name]
            result = tool_fn(**output.get("input", {}))
            output["tool_result"] = result

        return output

    # -------------------------
    # RETRY FEEDBACK
    # -------------------------
    def build_failure_feedback(
        self,
        source: str,
        attempt: int,
        score: int | None = None,
        critical_issues: Optional[list[str]] = None,
        item_results: Optional[list[dict]] = None,
    ) -> dict:
        item_failures = []
        for item in item_results or []:
            checks = item.get("binary_checks", {}) if isinstance(item, dict) else {}
            failed_checks = [name for name, passed in checks.items() if passed is False]
            quality_issues = [
                str(issue) for issue in item.get("quality_issues", [])
            ] if isinstance(item, dict) else []
            if failed_checks or quality_issues:
                item_failures.append({
                    "index": item.get("index"),
                    "failed_checks": failed_checks,
                    "quality_issues": quality_issues,
                })

        feedback = {
            "source": source,
            "attempt": attempt,
            "critical_issues": [str(issue) for issue in (critical_issues or [])],
            "item_failures": item_failures,
        }
        if score is not None:
            feedback["score"] = score
        return feedback

    # -------------------------
    # CRITIC LOOP
    # -------------------------
    def _build_checks_text(self, binary_checks: list) -> str:
        lines = []
        for c in binary_checks:
            lines.append(f"CHECK: {c['name']}")
            lines.append(f"PASS: {c['pass_condition']}")
            lines.append(f"FAIL: {c['fail_condition']}")
            if c.get("auto_pass_if_missing"):
                lines.append("NOTE: auto-PASS if the field is absent")
        return "\n".join(lines)

    def _critic_check(self, output: list, binary_checks: list) -> list:
        """
        Phase 1 — Binary check each item against the configured binary_checks.
        Returns list of dicts: [{index, binary_checks: {name: bool}, quality_issues: [...]}]
        """
        check_names = [c["name"] for c in binary_checks]
        prompt = "\n\n".join([
            self._wrap_xml("role", self.role),
            self._wrap_xml(
                "instructions",
                "You are a skeptical principal engineer reviewing AI-generated output. "
                "Evaluate every item against every binary check with no partial credit.",
            ),
            self._wrap_xml("items_to_check", output),
            self._wrap_xml("binary_checks", binary_checks),
            self._wrap_xml(
                "response_contract",
                (
                    "Return ONLY a JSON array.\n"
                    "Each object must contain:\n"
                    "- index: 0-based item position\n"
                    "- binary_checks: object mapping each check name to true or false\n"
                    "- quality_issues: array with one specific sentence per failed check"
                ),
            ),
        ])

        token_ctrl = self.config.get("token_control", {})
        max_output_tokens = token_ctrl.get("max_output_tokens", 2048)
        retries = token_ctrl.get("retries", self.max_retries)

        response = run_ai(
            prompt,
            max_tokens=max_output_tokens,
            retries=retries,
            model=self.config.get("model"),
            temperature=self.config.get("temperature"),
        )
        try:
            parsed = self.parse_json(response)
        except JSONParsingError:
            logger.warning("[critic_check] agent=%s failed to parse check results — skipping", self.name)
            return []

        for item_result in parsed:
            checks = item_result.setdefault("binary_checks", {})
            for name in check_names:
                checks.setdefault(name, True)
            item_result.setdefault("quality_issues", [])

        return parsed

    def _critic_rewrite(self, output: list, failing: list, binary_checks: list) -> list:
        """
        Phase 2 — Rewrite only the items that failed >= 1 binary check.
        Returns rewritten items in the same order as `failing`.
        """
        annotated = []
        for item_result in failing:
            idx = item_result.get("index", 0)
            original = output[idx] if idx < len(output) else {}
            annotated.append({
                **original,
                "__quality_issues": item_result.get("quality_issues", []),
            })

        feedback = self.build_failure_feedback(
            source="critic",
            attempt=1,
            critical_issues=[
                issue
                for item in failing
                for issue in item.get("quality_issues", [])
            ],
            item_results=failing,
        )

        prompt = "\n\n".join([
            self._wrap_xml("role", self.role),
            self._wrap_xml(
                "instructions",
                (
                    "Rewrite only the failing items. Fix every listed issue, keep intact fields that already pass, "
                    "and remove the temporary __quality_issues field from the final output."
                ),
            ),
            self._wrap_xml("previous_attempt_failure", feedback),
            self._wrap_xml("binary_checks", binary_checks),
            self._wrap_xml("failing_items", annotated),
            self._wrap_xml("output_schema", self.config.get("output_schema", {})),
            self._wrap_xml(
                "response_contract",
                "Return ONLY a JSON array of rewritten items in the same count and order as failing_items.",
            ),
        ])

        token_ctrl = self.config.get("token_control", {})
        max_output_tokens = token_ctrl.get("max_output_tokens", 2048)
        retries = token_ctrl.get("retries", self.max_retries)

        response = run_ai(
            prompt,
            max_tokens=max_output_tokens,
            retries=retries,
            model=self.config.get("model"),
            temperature=self.config.get("temperature"),
        )
        try:
            parsed = self.parse_json(response)
        except JSONParsingError:
            logger.warning(
                "[critic_rewrite] agent=%s failed to parse rewrite — using originals",
                self.name,
            )
            return [output[r.get("index", 0)] for r in failing if r.get("index", 0) < len(output)]

        if isinstance(parsed, list) and len(parsed) == len(failing):
            return parsed

        logger.warning(
            "[critic_rewrite] agent=%s rewrite count mismatch (expected=%d got=%d) — using originals",
            self.name,
            len(failing),
            len(parsed) if isinstance(parsed, list) else 0,
        )
        return [output[r.get("index", 0)] for r in failing if r.get("index", 0) < len(output)]

    def run_critic(self, output):
        critic_config = self.config.get("critic", {})
        binary_checks = critic_config.get("binary_checks", [])

        if not binary_checks or not isinstance(output, list) or not output:
            return output

        check_results = self._critic_check(output, binary_checks)
        failing = [r for r in check_results if not all(r.get("binary_checks", {}).values())]

        logger.info(
            "[critic] agent=%s total=%d failing=%d",
            self.name,
            len(output),
            len(failing),
        )

        if not failing:
            return output

        rewritten = self._critic_rewrite(output, failing, binary_checks)

        result = list(output)
        for item_result, rewrite in zip(failing, rewritten):
            idx = item_result.get("index", 0)
            if idx < len(result):
                result[idx] = rewrite
        return result

    async def _critic_check_async(self, output: list, binary_checks: list) -> list:
        """
        Async version of _critic_check — uses run_ai_async.
        Phase 1 — Binary check each item against the configured binary_checks.
        Returns list of dicts: [{index, binary_checks: {name: bool}, quality_issues: [...]}]
        """
        check_names = [c["name"] for c in binary_checks]
        prompt = "\n\n".join([
            self._wrap_xml("role", self.role),
            self._wrap_xml(
                "instructions",
                "You are a skeptical principal engineer reviewing AI-generated output. "
                "Evaluate every item against every binary check with no partial credit.",
            ),
            self._wrap_xml("items_to_check", output),
            self._wrap_xml("binary_checks", binary_checks),
            self._wrap_xml(
                "response_contract",
                (
                    "Return ONLY a JSON array.\n"
                    "Each object must contain:\n"
                    "- index: 0-based item position\n"
                    "- binary_checks: object mapping each check name to true or false\n"
                    "- quality_issues: array with one specific sentence per failed check"
                ),
            ),
        ])

        token_ctrl = self.config.get("token_control", {})
        max_output_tokens = token_ctrl.get("max_output_tokens", 2048)
        retries = token_ctrl.get("retries", self.max_retries)

        response = await run_ai_async(
            prompt,
            max_tokens=max_output_tokens,
            retries=retries,
            model=self.config.get("model"),
            temperature=self.config.get("temperature"),
        )
        try:
            parsed = self.parse_json(response)
        except JSONParsingError:
            logger.warning("[critic_check] agent=%s failed to parse check results — skipping", self.name)
            return []

        for item_result in parsed:
            checks = item_result.setdefault("binary_checks", {})
            for name in check_names:
                checks.setdefault(name, True)
            item_result.setdefault("quality_issues", [])

        return parsed

    async def _critic_rewrite_async(self, output: list, failing: list, binary_checks: list) -> list:
        """
        Async version of _critic_rewrite — uses run_ai_async.
        Phase 2 — Rewrite only the items that failed >= 1 binary check.
        Returns rewritten items in the same order as `failing`.
        """
        annotated = []
        for item_result in failing:
            idx = item_result.get("index", 0)
            original = output[idx] if idx < len(output) else {}
            annotated.append({
                **original,
                "__quality_issues": item_result.get("quality_issues", []),
            })

        feedback = self.build_failure_feedback(
            source="critic",
            attempt=1,
            critical_issues=[
                issue
                for item in failing
                for issue in item.get("quality_issues", [])
            ],
            item_results=failing,
        )

        prompt = "\n\n".join([
            self._wrap_xml("role", self.role),
            self._wrap_xml(
                "instructions",
                (
                    "Rewrite only the failing items. Fix every listed issue, keep intact fields that already pass, "
                    "and remove the temporary __quality_issues field from the final output."
                ),
            ),
            self._wrap_xml("previous_attempt_failure", feedback),
            self._wrap_xml("binary_checks", binary_checks),
            self._wrap_xml("failing_items", annotated),
            self._wrap_xml("output_schema", self.config.get("output_schema", {})),
            self._wrap_xml(
                "response_contract",
                "Return ONLY a JSON array of rewritten items in the same count and order as failing_items.",
            ),
        ])

        token_ctrl = self.config.get("token_control", {})
        max_output_tokens = token_ctrl.get("max_output_tokens", 2048)
        retries = token_ctrl.get("retries", self.max_retries)

        response = await run_ai_async(
            prompt,
            max_tokens=max_output_tokens,
            retries=retries,
            model=self.config.get("model"),
            temperature=self.config.get("temperature"),
        )
        try:
            parsed = self.parse_json(response)
        except JSONParsingError:
            logger.warning(
                "[critic_rewrite] agent=%s failed to parse rewrite — using originals",
                self.name,
            )
            return [output[r.get("index", 0)] for r in failing if r.get("index", 0) < len(output)]

        if isinstance(parsed, list) and len(parsed) == len(failing):
            return parsed

        logger.warning(
            "[critic_rewrite] agent=%s rewrite count mismatch (expected=%d got=%d) — using originals",
            self.name,
            len(failing),
            len(parsed) if isinstance(parsed, list) else 0,
        )
        return [output[r.get("index", 0)] for r in failing if r.get("index", 0) < len(output)]

    async def run_critic_async(self, output):
        """Async version of run_critic."""
        critic_config = self.config.get("critic", {})
        binary_checks = critic_config.get("binary_checks", [])

        if not binary_checks or not isinstance(output, list) or not output:
            return output

        check_results = await self._critic_check_async(output, binary_checks)
        failing = [r for r in check_results if not all(r.get("binary_checks", {}).values())]

        logger.info(
            "[critic] agent=%s total=%d failing=%d",
            self.name,
            len(output),
            len(failing),
        )

        if not failing:
            return output

        rewritten = await self._critic_rewrite_async(output, failing, binary_checks)

        result = list(output)
        for item_result, rewrite in zip(failing, rewritten):
            idx = item_result.get("index", 0)
            if idx < len(result):
                result[idx] = rewrite
        return result

    def validate_evidence_chain(self, output: Any, memory: dict) -> Any:
        """
        Cross-reference check: validates that each feature item's research_evidence
        is non-empty and that every entry in linked_problems matches a known problem
        title in memory["problems"] (case-insensitive).

        Only runs if memory contains a "problems" key with a non-empty list.
        Never throws — returns output unchanged if memory is missing or malformed.
        Appends to existing quality_issues list if the item was already flagged.
        """
        if not isinstance(output, list):
            return output

        try:
            problems_raw = memory.get("problems") if isinstance(memory, dict) else None
        except Exception:
            return output

        if not isinstance(problems_raw, list) or not problems_raw:
            return output

        known_titles: set = set()
        for p in problems_raw:
            if isinstance(p, dict):
                title = p.get("title")
                if isinstance(title, str) and title.strip():
                    known_titles.add(title.strip().lower())

        result: list = []
        for item in output:
            if not isinstance(item, dict):
                result.append(item)
                continue

            issues: list = list(item.get("quality_issues", []))

            evidence = item.get("research_evidence", "")
            if not isinstance(evidence, str) or len(evidence.strip()) <= 10:
                issues.append(
                    "research_evidence is missing or too short (must be > 10 chars)"
                )

            linked = item.get("linked_problems")
            if not linked or not isinstance(linked, list):
                issues.append("linked_problems is missing or empty")
            else:
                for lp in linked:
                    if not isinstance(lp, str):
                        continue
                    if lp.strip().lower() not in known_titles:
                        issues.append(
                            f"linked_problem '{lp}' not found in memory problems"
                        )

            if issues:
                result.append({
                    **item,
                    "quality_flag": "low_confidence",
                    "quality_issues": issues,
                })
            else:
                result.append(item)

        return result

    # -------------------------
    # EXECUTE
    # -------------------------
    def execute(self, task: str, context: dict = None, memory: dict = None, session: dict = None):
        if session:
            logger.debug(
                json.dumps({
                    "event": "agent_execute",
                    "agent": self.name,
                    "session_id": session.get("id", ""),
                })
            )

        compression_config = self.config.get("compression", {})
        if compression_config:
            from services.context.context_compressor import compress

            context = compress(
                context,
                strategy=compression_config.get("strategy", "none"),
                params=compression_config.get("params", {}),
            )

        prompt = self.build_prompt(task, context, memory=memory)

        from services.token.token_manager import allocate_budget, estimate_tokens, trim_to_budget

        budget = allocate_budget(self.name, self.config)
        prompt_tokens = estimate_tokens(prompt)

        max_output_tokens = self.config.get("token_control", {}).get("max_output_tokens", 2048)
        retries = self.config.get("token_control", {}).get("retries", self.max_retries)

        if prompt_tokens > budget:
            if context:
                context = trim_to_budget(context, budget // 3)
            if memory:
                memory = trim_to_budget(memory, budget // 3)
            prompt = self.build_prompt(task, context, memory=memory)

        output_schema = self.config.get("output_schema") or {}

        if output_schema:
            from services.agents.agent_schema_factory import (
                build_response_model,
                extract_payload_and_reasoning,
            )
            from services.ai.client import run_ai_structured

            ResponseModel = build_response_model(output_schema, self.name)
            structured = run_ai_structured(
                prompt,
                ResponseModel,
                max_tokens=max_output_tokens,
                model=self.config.get("model"),
                temperature=self.config.get("temperature"),
                max_retries=retries,
            )
            parsed, reasoning = extract_payload_and_reasoning(structured, output_schema)
            if reasoning:
                logger.info("[execute] agent=%s reasoning_len=%d", self.name, len(reasoning))
            logger.info(
                "[execute] agent=%s structured_output parsed_type=%s parsed_len=%s",
                self.name,
                type(parsed).__name__,
                len(parsed) if isinstance(parsed, (list, dict)) else "N/A",
            )
        else:
            attempt_prompt = prompt
            parse_error: JSONParsingError | None = None
            for attempt in range(retries + 1):
                response = run_ai(
                    attempt_prompt,
                    max_tokens=max_output_tokens,
                    model=self.config.get("model"),
                    temperature=self.config.get("temperature"),
                )
                logger.info(
                    "[execute] agent=%s raw_response_len=%d attempt=%d",
                    self.name, len(response), attempt,
                )
                try:
                    parsed = self.parse_json(response)
                    parse_error = None
                    logger.info(
                        "[execute] agent=%s parsed_type=%s parsed_len=%s",
                        self.name,
                        type(parsed).__name__,
                        len(parsed) if isinstance(parsed, (list, dict)) else "N/A",
                    )
                    break
                except JSONParsingError as exc:
                    parse_error = exc
                    if attempt < retries:
                        logger.warning(
                            "[execute] agent=%s JSON parse failed (attempt %d/%d): %s",
                            self.name, attempt + 1, retries + 1, exc,
                        )
                        attempt_prompt = "\n\n".join([
                            "Your previous response could not be parsed as JSON.",
                            f"Parse error: {exc}",
                            f"Failing snippet: {exc.raw_snippet!r}",
                            "Return ONLY a valid JSON object or array, with no preamble or markdown fences.",
                            "Original task:",
                            prompt,
                        ])
                    else:
                        logger.error(
                            "[execute] agent=%s JSON parsing failed after %d attempts — halting",
                            self.name, retries + 1,
                        )

            if parse_error:
                return {"status": "error", "message": "Critical JSON parsing failure after retries."}

        parsed = self.strip_reasoning_field(parsed)
        parsed = self.run_tools(parsed)

        if self.use_critic:
            pre_critic_len = len(parsed) if isinstance(parsed, (list, dict)) else "N/A"
            parsed = self.run_critic(parsed)
            post_critic_len = len(parsed) if isinstance(parsed, (list, dict)) else "N/A"
            logger.info(
                "[execute] agent=%s critic: before=%s after=%s",
                self.name,
                pre_critic_len,
                post_critic_len,
            )

        if self.config.get("validate_evidence_chain") and memory:
            parsed = self.validate_evidence_chain(parsed, memory)

        return self.strip_reasoning_field(parsed)

    # -------------------------
    # ASYNC
    # -------------------------
    async def execute_async(self, task: str, context: dict = None, memory: dict = None, session: dict = None):
        """
        Native async version of execute() — uses await on all I/O (AI calls, critic, tools).
        No thread pool blocking. Mirrors execute() exactly but with async/await.
        """
        if session:
            logger.debug(
                json.dumps({
                    "event": "agent_execute",
                    "agent": self.name,
                    "session_id": session.get("id", ""),
                })
            )

        compression_config = self.config.get("compression", {})
        if compression_config:
            from services.context.context_compressor import compress

            context = compress(
                context,
                strategy=compression_config.get("strategy", "none"),
                params=compression_config.get("params", {}),
            )

        prompt = self.build_prompt(task, context, memory=memory)

        from services.token.token_manager import allocate_budget, estimate_tokens, trim_to_budget

        budget = allocate_budget(self.name, self.config)
        prompt_tokens = estimate_tokens(prompt)

        max_output_tokens = self.config.get("token_control", {}).get("max_output_tokens", 2048)
        retries = self.config.get("token_control", {}).get("retries", self.max_retries)

        if prompt_tokens > budget:
            if context:
                context = trim_to_budget(context, budget // 3)
            if memory:
                memory = trim_to_budget(memory, budget // 3)
            prompt = self.build_prompt(task, context, memory=memory)

        output_schema = self.config.get("output_schema") or {}

        if output_schema:
            from services.agents.agent_schema_factory import (
                build_response_model,
                extract_payload_and_reasoning,
            )
            from services.ai.client import run_ai_structured_async

            ResponseModel = build_response_model(output_schema, self.name)
            structured = await run_ai_structured_async(
                prompt,
                ResponseModel,
                max_tokens=max_output_tokens,
                model=self.config.get("model"),
                temperature=self.config.get("temperature"),
                max_retries=retries,
            )
            parsed, reasoning = extract_payload_and_reasoning(structured, output_schema)
            if reasoning:
                logger.info("[execute_async] agent=%s reasoning_len=%d", self.name, len(reasoning))
            logger.info(
                "[execute_async] agent=%s structured_output parsed_type=%s parsed_len=%s",
                self.name,
                type(parsed).__name__,
                len(parsed) if isinstance(parsed, (list, dict)) else "N/A",
            )
        else:
            from services.ai.client import run_ai_async

            attempt_prompt = prompt
            parse_error: JSONParsingError | None = None
            for attempt in range(retries + 1):
                response = await run_ai_async(
                    attempt_prompt,
                    max_tokens=max_output_tokens,
                    model=self.config.get("model"),
                    temperature=self.config.get("temperature"),
                )
                logger.info(
                    "[execute_async] agent=%s raw_response_len=%d attempt=%d",
                    self.name, len(response), attempt,
                )
                try:
                    parsed = self.parse_json(response)
                    parse_error = None
                    logger.info(
                        "[execute_async] agent=%s parsed_type=%s parsed_len=%s",
                        self.name,
                        type(parsed).__name__,
                        len(parsed) if isinstance(parsed, (list, dict)) else "N/A",
                    )
                    break
                except JSONParsingError as exc:
                    parse_error = exc
                    if attempt < retries:
                        logger.warning(
                            "[execute_async] agent=%s JSON parse failed (attempt %d/%d): %s",
                            self.name, attempt + 1, retries + 1, exc,
                        )
                        attempt_prompt = "\n\n".join([
                            "Your previous response could not be parsed as JSON.",
                            f"Parse error: {exc}",
                            f"Failing snippet: {exc.raw_snippet!r}",
                            "Return ONLY a valid JSON object or array, with no preamble or markdown fences.",
                            "Original task:",
                            prompt,
                        ])
                    else:
                        logger.error(
                            "[execute_async] agent=%s JSON parsing failed after %d attempts — halting",
                            self.name, retries + 1,
                        )

            if parse_error:
                return {"status": "error", "message": "Critical JSON parsing failure after retries."}

        parsed = self.strip_reasoning_field(parsed)
        parsed = self.run_tools(parsed)

        if self.use_critic:
            pre_critic_len = len(parsed) if isinstance(parsed, (list, dict)) else "N/A"
            parsed = await self.run_critic_async(parsed)
            post_critic_len = len(parsed) if isinstance(parsed, (list, dict)) else "N/A"
            logger.info(
                "[execute_async] agent=%s critic: before=%s after=%s",
                self.name,
                pre_critic_len,
                post_critic_len,
            )

        if self.config.get("validate_evidence_chain") and memory:
            parsed = self.validate_evidence_chain(parsed, memory)

        return self.strip_reasoning_field(parsed)

    # -------------------------
    # STREAMING
    # -------------------------
    def stream(self, task: str, context: dict = None):
        prompt = self.build_prompt(task, context)
        response = run_ai(
            prompt,
            model=self.config.get("model"),
            temperature=self.config.get("temperature"),
        )

        for chunk in response.split():
            yield chunk
