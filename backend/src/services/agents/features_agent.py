from services.agents.base_agent import BaseAgent


class FeaturesAgent(BaseAgent):
    def __init__(self, config: dict):
        super().__init__("FeaturesAgent", config)

    def run(self, context, problems):
        # Everything dynamic
        structured_context = {
            "product_context": context,
            "problems": problems,
            "agent_config": self.config
        }

        task = self.build_dynamic_task()

        return self.execute(task, structured_context)

    # -------------------------
    # DYNAMIC TASK BUILDER
    # -------------------------
    def build_dynamic_task(self):
        cfg = self.config

        steps = cfg.get("steps", [])
        fields = cfg.get("output_fields", [])
        scoring = cfg.get("scoring", {})
        constraints = cfg.get("constraints", {})
        instructions = cfg.get("generation_rules", [])

        return f"""
Generate outputs based on the provided context.

Steps:
{self._format_list(steps)}

Instructions:
{self._format_list(instructions)}

Constraints:
{self._format_dict(constraints)}

Scoring Rules:
{self._format_dict(scoring)}

Output Requirements:
- Follow the fields exactly
- Use this structure:

{self._format_output_schema(fields)}

Do not assume anything outside config.
"""

    # -------------------------
    # HELPERS
    # -------------------------
    def _format_list(self, items):
        if not items:
            return "None"
        return "\n".join([f"- {i}" for i in items])

    def _format_dict(self, d):
        if not d:
            return "None"
        return "\n".join([f"- {k}: {v}" for k, v in d.items()])

    def _format_output_schema(self, fields):
        if not fields:
            return "[]"

        field_str = "\n".join([f'    "{f}": "..."' for f in fields])

        return f"""
[
  {{
{field_str}
  }}
]
"""