# services/agents/base_agent.py

from services.ai.client import run_ai
import json
import logging
import time
import asyncio
from typing import Any, Dict, List, Optional

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
    def build_prompt(self, task: str, context: dict = None, memory: dict = None) -> str:
        output_schema = self.config.get("output_schema", {})
        schema_hint = self._build_schema_hint(output_schema) if output_schema else "JSON"
        context_str = json.dumps(context or {}, indent=2)

        return (
            f"ROLE: {self.role}\n\n"
            f"CONTEXT:\n{context_str}\n\n"
            f"TASK: {task}\n\n"
            f"OUTPUT FORMAT: Return ONLY a JSON array. No preamble. No markdown. No explanation.\n"
            f"{schema_hint}"
        )

    def _format_list(self, items):
        if not items:
            return "None"
        return "\n".join([f"- {i}" for i in items])

    def _format_dict(self, d):
        if not d:
            return "None"
        if isinstance(d, dict):
            return "\n".join([f"- {k}: {v}" for k, v in d.items()])
        return str(d)

    def _build_schema_hint(self, schema: dict) -> str:
        """Generate a concrete JSON example from the output_schema config."""
        if not schema:
            return '{"result": "..."}'
        schema_type = schema.get("type", "object")
        
        # Merge all structure-defining keys
        combined = {}
        if "fields" in schema and schema["fields"]:
            combined.update(schema["fields"])
        if "sections" in schema and schema["sections"]:
            combined.update(schema["sections"])
        if "groups" in schema and schema["groups"]:
            combined.update(schema["groups"])

        if schema_type == "list":
            example = self._fields_to_example(combined)
            return f"[\n  {json.dumps(example, indent=2)}\n]"
        else:
            if not combined:
                return '{"result": "..."}'
            example = self._fields_to_example(combined)
            return json.dumps(example, indent=2)

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
            if fields == "list":
                return ["..."]
            if fields == "object":
                return {}
            return "..."

        result = {}
        for key, val in fields.items():
            result[key] = self._fields_to_example(val)
        return result

    # -------------------------
    # JSON PARSER
    # -------------------------
    def parse_json(self, text: str):
        try:
            return json.loads(text)
        except:
            pass

        # Try to extract JSON from markdown code blocks
        import re
        match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
        if match:
            try:
                return json.loads(match.group(1))
            except:
                pass

        # Try to find JSON object/array pattern
        for start in range(len(text)):
            if text[start] in ('{', '['):
                for end in range(len(text), start, -1):
                    if text[end-1] in ('}', ']'):
                        try:
                            return json.loads(text[start:end])
                        except:
                            pass

        return None

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
    # CRITIC LOOP
    # -------------------------
    def _build_checks_text(self, binary_checks: list) -> str:
        """Format binary_checks list from config into a prompt-ready string."""
        lines = []
        for c in binary_checks:
            lines.append(f"  CHECK — {c['name'].upper()}:")
            lines.append(f"    PASS: {c['pass_condition']}")
            lines.append(f"    FAIL: {c['fail_condition']}")
            if c.get("auto_pass_if_missing"):
                lines.append(f"    NOTE: auto-PASS if the field is absent")
        return "\n".join(lines)

    def _critic_check(self, output: list, binary_checks: list) -> list:
        """
        Phase 1 — Binary check each item against the configured binary_checks.
        Returns list of dicts: [{index, binary_checks: {name: bool}, quality_issues: [...]}]
        """
        checks_text = self._build_checks_text(binary_checks)
        check_names = [c["name"] for c in binary_checks]

        prompt = (
            f"ROLE: {self.role}\n\n"
            f"You are a Skeptical Principal Engineer reviewing AI-generated output.\n\n"
            f"ITEMS TO CHECK ({len(output)} total):\n{json.dumps(output, indent=2)}\n\n"
            f"BINARY CHECKS — apply each to every item:\n{checks_text}\n\n"
            f"For each item, return an object with:\n"
            f"  index (int, 0-based position in the array above)\n"
            f"  binary_checks: object mapping each check name to true (PASS) or false (FAIL)\n"
            f"  quality_issues: array of strings — one specific sentence per failing check\n\n"
            f"Return ONLY a JSON array of these objects. No preamble. No markdown."
        )

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
        parsed = self.parse_json(response)

        if not isinstance(parsed, list):
            logger.warning("[critic_check] agent=%s failed to parse check results — skipping", self.name)
            return []

        # Guarantee all check names are present; default to True (pass) if missing
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
        checks_text = self._build_checks_text(binary_checks)

        # Build a list of failing items annotated with their issues
        annotated = []
        for item_result in failing:
            idx = item_result.get("index", 0)
            original = output[idx] if idx < len(output) else {}
            annotated.append({
                **original,
                "__quality_issues": item_result.get("quality_issues", []),
            })

        prompt = (
            f"ROLE: {self.role}\n\n"
            f"The following items FAILED one or more binary quality checks.\n"
            f"Each item includes a '__quality_issues' field listing exactly what failed.\n\n"
            f"BINARY CHECKS (all items must pass these after rewrite):\n{checks_text}\n\n"
            f"OUTPUT SCHEMA (every rewritten item must conform to this):\n"
            f"{json.dumps(self.config.get('output_schema', {}), indent=2)}\n\n"
            f"FAILING ITEMS TO REWRITE:\n{json.dumps(annotated, indent=2)}\n\n"
            f"For each item:\n"
            f"- Fix every issue listed in '__quality_issues'\n"
            f"- Remove the '__quality_issues' field from the rewritten item\n"
            f"- Keep all other fields intact unless they caused a failure\n\n"
            f"Return ONLY a JSON array of the rewritten items (same count and order). "
            f"No preamble. No markdown."
        )

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
        parsed = self.parse_json(response)

        if isinstance(parsed, list) and len(parsed) == len(failing):
            return parsed

        # If rewrite count mismatches, fall back to original failing items unchanged
        logger.warning(
            "[critic_rewrite] agent=%s rewrite count mismatch (expected=%d got=%d) — using originals",
            self.name, len(failing), len(parsed) if isinstance(parsed, list) else 0,
        )
        return [output[r.get("index", 0)] for r in failing if r.get("index", 0) < len(output)]

    def run_critic(self, output):
        critic_config = self.config.get("critic", {})
        binary_checks = critic_config.get("binary_checks", [])

        if not binary_checks or not isinstance(output, list) or not output:
            return output  # no checks defined — nothing to do

        # Phase 1: check each item against configured binary_checks
        check_results = self._critic_check(output, binary_checks)
        failing = [r for r in check_results if not all(r.get("binary_checks", {}).values())]

        logger.info(
            "[critic] agent=%s total=%d failing=%d",
            self.name, len(output), len(failing),
        )

        if not failing:
            return output  # all items passed — skip rewrite

        # Phase 2: mandatory targeted rewrite of failing items only
        rewritten = self._critic_rewrite(output, failing, binary_checks)

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

        # Build case-insensitive set of known problem titles
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

            # Check research_evidence length
            evidence = item.get("research_evidence", "")
            if not isinstance(evidence, str) or len(evidence.strip()) <= 10:
                issues.append(
                    "research_evidence is missing or too short (must be > 10 chars)"
                )

            # Check linked_problems exists and is a non-empty list
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
        # Log session context for observability (not injected into AI prompt)
        if session:
            logger.debug(
                json.dumps({
                    "event": "agent_execute",
                    "agent": self.name,
                    "session_id": session.get("id", ""),
                })
            )

        # 1. Compress context
        compression_config = self.config.get("compression", {})
        if compression_config:
            from services.context.context_compressor import compress
            context = compress(
                context, 
                strategy=compression_config.get("strategy", "none"), 
                params=compression_config.get("params", {})
            )

        # 2. Build Prompt
        prompt = self.build_prompt(task, context, memory=memory)

        # 3. Apply token budget
        from services.token.token_manager import estimate_tokens, allocate_budget, trim_to_budget
        budget = allocate_budget(self.name, self.config)
        prompt_tokens = estimate_tokens(prompt)

        # Output token control from config, default to something sensible
        max_output_tokens = self.config.get("token_control", {}).get("max_output_tokens", 2048)
        retries = self.config.get("token_control", {}).get("retries", self.max_retries)

        if prompt_tokens > budget:
            # Rebuild prompt with trimmed context/memory
            if context:
                context = trim_to_budget(context, budget // 3)
            if memory:
                memory = trim_to_budget(memory, budget // 3)
            prompt = self.build_prompt(task, context, memory=memory)

        output_schema = self.config.get("output_schema") or {}

        if output_schema:
            from services.agents.agent_schema_factory import build_response_model, extract_output
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
            parsed = extract_output(structured, output_schema)
            logger.info("[execute] agent=%s structured_output parsed_type=%s parsed_len=%s",
                self.name, type(parsed).__name__,
                len(parsed) if isinstance(parsed, (list, dict)) else "N/A")
        else:
            response = run_ai(prompt, max_tokens=max_output_tokens, retries=retries,
                              model=self.config.get("model"), temperature=self.config.get("temperature"))
            logger.info("[execute] agent=%s raw_response_len=%d", self.name, len(response))
            parsed = self.parse_json(response)
            logger.info("[execute] agent=%s parsed_type=%s parsed_len=%s",
                self.name, type(parsed).__name__,
                len(parsed) if isinstance(parsed, (list, dict)) else "N/A")
            if not parsed:
                return {"error": "Invalid JSON", "raw": response}

        parsed = self.run_tools(parsed)

        if self.use_critic:
            pre_critic_len = len(parsed) if isinstance(parsed, (list, dict)) else "N/A"
            parsed = self.run_critic(parsed)
            post_critic_len = len(parsed) if isinstance(parsed, (list, dict)) else "N/A"
            logger.info("[execute] agent=%s critic: before=%s after=%s",
                self.name, pre_critic_len, post_critic_len)

        if self.config.get("validate_evidence_chain") and memory:
            parsed = self.validate_evidence_chain(parsed, memory)

        return parsed

    # -------------------------
    # ASYNC
    # -------------------------
    async def execute_async(self, task: str, context: dict = None, memory: dict = None, session: dict = None):
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, lambda: self.execute(task, context, memory=memory, session=session)
        )

    # -------------------------
    # STREAMING
    # -------------------------
    def stream(self, task: str, context: dict = None):
        prompt = self.build_prompt(task, context)
        response = run_ai(prompt, model=self.config.get("model"), temperature=self.config.get("temperature"))

        for chunk in response.split():
            yield chunk