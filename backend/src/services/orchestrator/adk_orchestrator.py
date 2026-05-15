# services/orchestrator/adk_orchestrator.py
#
# Wraps the SpecFlow agent pipeline as a Google ADK SequentialAgent.
# Each step reads its context slice from ADK session state and writes
# its output back via EventActions(state_delta=...).
#
# pipeline.py remains responsible for: coercion, scoring, validation,
# Supabase persistence, session snapshots, and event tracking.

import json
import logging
from typing import Any, Callable, Coroutine, Optional

from google.adk.agents import BaseAgent as GoogleBaseAgent, SequentialAgent
from google.adk.events import Event, EventActions
from google.adk.runners import InMemoryRunner
from google.genai.types import Content, Part
from services.pipeline_stop import stopped_after_no_problems

logger = logging.getLogger(__name__)


class _SpecFlowStep(GoogleBaseAgent):
    """
    ADK sub-agent that wraps a single SpecFlow typed agent.
    Reads its context slice from ADK session state (populated by prior steps),
    calls the typed agent via AgentFactory, and writes output to state_delta.
    """

    def __init__(self, agent_name: str, task: str, output_key: str):
        super().__init__(name=agent_name, description=f"SpecFlow {agent_name} step")
        self._agent_name = agent_name
        self._task = task
        self._output_key = output_key

    async def _run_async_impl(self, ctx):
        state = ctx.session.state

        # Skip if already completed (session resume support)
        if state.get("_completed", {}).get(self._agent_name):
            logger.info("[ADK] skipping completed step: %s", self._agent_name)
            yield Event(
                author=self.name,
                content=Content(parts=[Part(text="skipped")]),
            )
            return

        if state.get("_pipeline_stop"):
            logger.info("[ADK] skipping %s because pipeline is stopped", self._agent_name)
            yield Event(
                author=self.name,
                content=Content(parts=[Part(text="stopped")]),
            )
            return

        if self._agent_name == "features" and state.get("problems") == []:
            stop_status = stopped_after_no_problems()
            logger.info(
                "[ADK] stopping pipeline before features because problems output is empty"
            )
            yield Event(
                author=self.name,
                content=Content(parts=[Part(text=json.dumps(stop_status))]),
                actions=EventActions(
                    state_delta={
                        "_pipeline_stop": stop_status,
                        "pipeline_status": stop_status,
                    }
                ),
            )
            return

        # Lazy import to avoid circular imports at module load time
        from services.agent_factory import AgentFactory

        agent = AgentFactory.create(self._agent_name)
        # Pass the full ADK session state as context; each typed agent's
        # build_prompt() extracts only the keys it needs.
        result = await agent.execute_async(
            self._task,
            context=dict(state),
            session={
                "id": state.get("_session_id"),
                "user_id": state.get("_user_id"),
            },
        )

        size = len(result) if isinstance(result, (list, dict)) else 0
        logger.info(
            "[ADK] %s completed — output_key=%s size=%d",
            self._agent_name, self._output_key, size,
        )

        yield Event(
            author=self.name,
            content=Content(parts=[Part(text=json.dumps({"step": self._agent_name, "size": size}))]),
            actions=EventActions(state_delta={self._output_key: result}),
        )


class ADKOrchestrator:
    """
    Runs the SpecFlow pipeline as an ADK SequentialAgent.

    Usage:
        orchestrator = ADKOrchestrator(pipeline_config)
        result = await orchestrator.run(input_data, session_id, completed_steps, prior_state)
        # result == {"problems": [...], "features": [...], "decompositions": [...], "tasks": {...}}
    """

    def __init__(self, pipeline_config: dict):
        steps = pipeline_config["steps"]
        self._step_output_keys: dict[str, str] = {
            s["agent"]: s.get("output_key", s["agent"]) for s in steps
        }
        sub_agents = [
            _SpecFlowStep(
                agent_name=s["agent"],
                task=s["task"],
                output_key=s.get("output_key", s["agent"]),
            )
            for s in steps
        ]
        self._pipeline = SequentialAgent(
            name="specflow_pipeline",
            sub_agents=sub_agents,
        )
        self._runner = InMemoryRunner(agent=self._pipeline, app_name="specflow")

    async def run(
        self,
        input_data: dict,
        session_id: str,
        user_id: str | None = None,
        completed_steps: Optional[set] = None,
        prior_state: Optional[dict] = None,
        progress_callback: Optional[Callable[[dict], Coroutine]] = None,
    ) -> dict:
        """
        Execute the pipeline (or resume from completed_steps).

        Args:
            input_data:      Dict with at minimum "context" (product_context) and "ingest".
            session_id:      Unique identifier — used as both ADK user_id and session_id.
            completed_steps: Set of agent names already finished; those steps are skipped.
            prior_state:     Already-computed outputs for completed steps to seed ADK state.

        Returns:
            Dict mapping each output_key to the raw agent output (pre-coercion).
        """
        initial_state: dict[str, Any] = {
            # Normalize "context" → "product_context" for agent context slicing
            "product_context": input_data.get(
                "product_context", input_data.get("context", {})
            ),
            "ingest": input_data.get("ingest", []),
            "research": input_data.get("research", []),
            "_completed": {s: True for s in (completed_steps or set())},
            "_session_id": session_id,
            "_user_id": user_id,
        }
        if input_data.get("analytics_context"):
            initial_state["analytics_context"] = input_data["analytics_context"]
        if input_data.get("rag_context"):
            initial_state["rag_context"] = input_data["rag_context"]
        # Seed prior outputs so skipped steps' data is still available downstream
        if prior_state:
            initial_state.update(prior_state)

        await self._runner.session_service.create_session(
            app_name="specflow",
            user_id=session_id,
            session_id=session_id,
            state=initial_state,
        )

        async for event in self._runner.run_async(
            user_id=session_id,
            session_id=session_id,
            new_message=Content(parts=[Part(text="run")]),
        ):
            # Intercept step completion events to fire progress callbacks.
            # Each _SpecFlowStep yields exactly one Event with state_delta containing
            # the step's output key when it finishes.
            if (
                progress_callback
                and event.actions
                and event.actions.state_delta
            ):
                for out_key in self._step_output_keys.values():
                    if out_key in event.actions.state_delta:
                        await progress_callback(
                            {"type": "step_complete", "step": out_key}
                        )

        final_session = await self._runner.session_service.get_session(
            app_name="specflow",
            user_id=session_id,
            session_id=session_id,
        )
        result = {
            out_key: final_session.state.get(out_key)
            for out_key in self._step_output_keys.values()
        }
        pipeline_status = final_session.state.get("pipeline_status")
        if pipeline_status is not None:
            result["pipeline_status"] = pipeline_status
        return result
