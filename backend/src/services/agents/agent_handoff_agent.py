# services/agents/agent_handoff_agent.py

from services.agents.base_agent import BaseAgent


class AgentHandoffAgent(BaseAgent):
    """
    Generates an agent-ready handoff payload from all pipeline outputs.
    Reads product_context + problems + features + decompositions + tasks + prd.
    """

    def _unwrap(self, val):
        if isinstance(val, dict) and list(val.keys()) == ["data"]:
            return val["data"]
        return val

    def build_prompt(self, task: str, context: dict = None, memory: dict = None) -> str:
        ctx = context or {}
        mem = memory or {}

        product_context = self._unwrap(
            ctx.get("product_context") or mem.get("product_context", {})
        )
        problems = self._clip_list(
            self._unwrap(ctx.get("problems") or mem.get("problems", [])), 5
        )
        features = self._clip_list(
            self._unwrap(ctx.get("features") or mem.get("features", [])), 6
        )
        decompositions = self._clip_list(
            self._unwrap(ctx.get("decompositions") or mem.get("decompositions", [])), 8
        )
        tasks = self._clip_list(
            self._unwrap(ctx.get("tasks") or mem.get("tasks", [])), 15
        )
        prd = self._unwrap(ctx.get("prd") or mem.get("prd", {}))

        prompt_context = {
            "product_context": product_context,
            "prior_problems": problems,
            "prior_features": features,
            "prior_decompositions": decompositions,
            "prior_tasks": tasks,
            "prd": prd,
        }

        return super().build_prompt(task, context=prompt_context, memory=None)
