# services/agents/base_agent.py

from services.ai.client import run_ai
import json
import time
import asyncio


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
    def build_prompt(self, task: str, context: dict = None, memory: dict = None):
        memory_section = ""
        if memory:
            memory_section = f"""
Previous Analysis (from prior pipeline steps):
{json.dumps(memory, indent=2)}
"""
        schema = self.config.get("output_schema", {})
        schema_hint = self._build_schema_hint(schema)

        return f"""
You are a {self.role}.

Instructions:
{self.instructions}

Context:
{json.dumps(context or {}, indent=2)}
{memory_section}
Task:
{task}

Output Format (return a JSON value that exactly matches this structure):
{schema_hint}

Return ONLY valid JSON matching the format above. No markdown, no explanation.
"""

    def _build_schema_hint(self, schema: dict) -> str:
        """Generate a concrete JSON example from the output_schema config."""
        if not schema:
            return '{"result": "..."}'
        schema_type = schema.get("type", "object")
        fields = schema.get("fields", {})

        if schema_type == "list":
            example = self._fields_to_example(fields)
            return f"[\n  {json.dumps(example, indent=2)}\n]"
        else:
            example = self._fields_to_example(fields)
            return json.dumps(example, indent=2)

    def _fields_to_example(self, fields) -> dict:
        """Recursively build an example object from field definitions."""
        if not fields or not isinstance(fields, dict):
            return {}
        result = {}
        for key, val in fields.items():
            if isinstance(val, dict):
                # Check if this dict has nested fields (nested object)
                result[key] = self._fields_to_example(val)
            elif val == "string":
                result[key] = "..."
            elif val == "number":
                result[key] = 0
            elif val == "list":
                result[key] = ["..."]
            elif val == "object":
                result[key] = {}
            else:
                result[key] = "..."
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

        prompt = f"""
Evaluate and improve this output:

{json.dumps(output, indent=2)}

Evaluation Criteria:
{json.dumps(critic_config.get("criteria", []))}

Improve weak areas.

Return JSON:
{{
  "scores": [...],
  "improved": [...]
}}
"""

        # Output token control for critic
        token_ctrl = self.config.get("token_control", {})
        max_output_tokens = token_ctrl.get("max_output_tokens", 2048)
        retries = token_ctrl.get("retries", self.max_retries)

        response = run_ai(prompt, max_tokens=max_output_tokens, retries=retries)
        parsed = self.parse_json(response)

        if isinstance(parsed, dict):
            return parsed.get("improved", output)
        
        return output

    # -------------------------
    # EXECUTE
    # -------------------------
    def execute(self, task: str, context: dict = None, memory: dict = None):
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

        for _ in range(self.max_retries + 1):
            response = run_ai(prompt, max_tokens=max_output_tokens, retries=retries)

            parsed = self.parse_json(response)

            if parsed:
                parsed = self.run_tools(parsed)

                if self.use_critic:
                    parsed = self.run_critic(parsed)

                return parsed

            prompt += "\nFix JSON. Return ONLY valid JSON."

        return {"error": "Invalid JSON", "raw": response}

    # -------------------------
    # ASYNC
    # -------------------------
    async def execute_async(self, task: str, context: dict = None, memory: dict = None):
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, lambda: self.execute(task, context, memory=memory)
        )

    # -------------------------
    # STREAMING
    # -------------------------
    def stream(self, task: str, context: dict = None):
        prompt = self.build_prompt(task, context)
        response = run_ai(prompt)

        for chunk in response.split():
            yield chunk