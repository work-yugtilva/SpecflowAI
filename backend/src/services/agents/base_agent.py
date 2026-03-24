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
        schema_hint = json.dumps(output_schema, indent=2) if output_schema else "JSON"
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
    def run_critic(self, output):
        critic_config = self.config.get("critic", {})

        if not critic_config:
            return output

        prompt = (
            f"ROLE: {self.role}\n\n"
            f"You are reviewing AI-generated output for quality.\n\n"
            f"ORIGINAL OUTPUT:\n{json.dumps(output, indent=2)}\n\n"
            f"EVALUATION CRITERIA:\n{json.dumps(critic_config.get('criteria', []))}\n\n"
            f"OUTPUT SCHEMA (every item must conform to this):\n"
            f"{json.dumps(self.config.get('output_schema', {}), indent=2)}\n\n"
            f"For each item that fails a criterion or violates the schema:\n"
            f"- Rewrite it to fix the issue\n"
            f"- Ensure research_evidence is non-empty and references specific input data\n"
            f"- Ensure all required fields are present and non-vague\n\n"
            f"Return ONLY a JSON array of the improved items. No preamble. No markdown."
        )

        # Output token control for critic
        token_ctrl = self.config.get("token_control", {})
        max_output_tokens = token_ctrl.get("max_output_tokens", 2048)
        retries = token_ctrl.get("retries", self.max_retries)

        response = run_ai(prompt, max_tokens=max_output_tokens, retries=retries)
        parsed = self.parse_json(response)

        if isinstance(parsed, list):
            return parsed

        return output

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

        if self.name == "features":
            messages = [{"role": "user", "content": prompt}]
            logger.info(f"FEATURES_PROMPT_DEBUG: {json.dumps(messages, indent=2)}")

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

        for _ in range(self.max_retries + 1):
            response = run_ai(prompt, max_tokens=max_output_tokens, retries=retries)

            parsed = self.parse_json(response)

            if parsed:
                parsed = self.run_tools(parsed)

                if self.use_critic:
                    parsed = self.run_critic(parsed)

                if self.config.get("validate_evidence_chain") and memory:
                    parsed = self.validate_evidence_chain(parsed, memory)

                return parsed

            prompt += "\nFix JSON. Return ONLY valid JSON."

        return {"error": "Invalid JSON", "raw": response}

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
        response = run_ai(prompt)

        for chunk in response.split():
            yield chunk