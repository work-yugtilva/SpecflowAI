# services/pipeline.py

import asyncio
import json
import logging
from typing import Optional
from services.agent_factory import AgentFactory
from services.config.config_manager import ConfigManager
from services.memory.memory_store import MemoryStore
from services.memory.memory_manager import MemoryManager
from services.memory.memory_repository import MemoryRepository
from services.memory.memory_schemas import MemoryEntry

logger = logging.getLogger("specflow.pipeline")


class Pipeline:
    def __init__(self, pipeline_config_path: str = None):
        import yaml
        from pathlib import Path
        import os
        from services.config.config_schema import PipelineConfig
        
        path_str = pipeline_config_path or os.environ.get("PIPELINE_CONFIG_PATH", "config/agents/pipeline.yaml")
        pipeline_path = Path(path_str)
        with open(pipeline_path) as f:
            raw = yaml.safe_load(f)
        self.pipeline_config = PipelineConfig(**raw).model_dump()
        self.memory_repo = MemoryRepository()

    async def run(
        self,
        input_data: dict,
        project_id: str = None,
        session_id: str = None,
        session_manager=None,
        step: str = None,
    ) -> dict:
        """
        Execute the agent pipeline.

        Args:
            input_data:      Initial state dict passed to the first agent.
            project_id:      Optional. Enables project-scoped persistent memory
                             (backward-compatible /run endpoint behaviour).
            session_id:      Optional. When provided, enables session mode:
                             state is saved after each step, completed steps are
                             skipped on retry, and events are logged.
            session_manager: SessionManager instance (required when session_id set).
            step:            Optional. When set, run ONLY this agent name.
                             Enables interactive step-by-step execution.

        Returns:
            Final state dict with all completed agent outputs.
        """
        from services.db.models.session import (
            SESSION_STATUS_COMPLETED,
            SESSION_STATUS_FAILED,
        )

        state = dict(input_data)
        memory_store = MemoryStore()
        memory_manager = MemoryManager(memory_store)

        # Session-mode: validate step param and restore prior state
        completed_steps: set = set()
        session_cfg = self.pipeline_config.get("session", {})
        exec_cfg = self.pipeline_config.get("execution", {})
        persistence_on = session_cfg.get("persistence", True)
        event_tracking_on = session_cfg.get("event_tracking", True)
        resumable = exec_cfg.get("resumable", True)

        if session_id and session_manager:
            # Validate step param before doing any work
            if step is not None:
                valid_agents = {s["agent"] for s in self.pipeline_config["steps"]}
                if step not in valid_agents:
                    raise ValueError(
                        f"Step '{step}' not found in pipeline. "
                        f"Valid steps: {sorted(valid_agents)}"
                    )

            # Restore prior outputs from persisted session state
            raw_state = await session_manager.get_current_state(session_id)
            last_completed = raw_state.get("last_completed_step")

            if last_completed is not None:
                # Merge previously computed outputs back into state
                for key, value in raw_state.get("outputs", {}).items():
                    state[key] = value

            # Load session-scoped memory into the runtime store
            entries = await self.memory_repo.get_by_session(session_id)
            for entry in entries:
                await memory_store.set(entry.memory_key, entry.content)

            # Determine which steps are already done
            if resumable:
                completed_steps = self._steps_completed_before(
                    last_completed, self.pipeline_config["steps"]
                )

            # Log input event on very first call
            if last_completed is None and event_tracking_on:
                await session_manager.append_event(
                    session_id, "input", {"input_data": input_data}
                )

        elif project_id:
            # Original /run behaviour: load project-scoped persistent memory
            await self._load_persisted_memory(memory_store, project_id)

        max_parallel = self.pipeline_config.get("settings", {}).get("max_parallelism", 2)
        semaphore = asyncio.Semaphore(max_parallel)

        steps_run_this_call: list = []

        for step_cfg in self.pipeline_config["steps"]:
            agent_name = step_cfg["agent"]

            # Skip already-completed steps (resume logic)
            if agent_name in completed_steps:
                continue

            # Interactive mode: skip steps that don't match the requested step
            if step is not None and agent_name != step:
                continue

            # Pre-check: ensure required input_key exists in state
            if step_cfg.get("input_key") and step_cfg["input_key"] not in state:
                raise ValueError(
                    f"Cannot run step '{agent_name}': required input "
                    f"'{step_cfg['input_key']}' is not in state. "
                    f"Run prerequisite steps first."
                )

            agent = AgentFactory.create(agent_name)

            # Build memory config for this agent
            agent_memory_config = None
            if hasattr(agent, "config") and isinstance(agent.config, dict):
                memory_raw = agent.config.get("memory")
                if memory_raw:
                    from services.memory.memory_schemas import MemoryConfig
                    agent_memory_config = MemoryConfig(**memory_raw)

            memory_slice = await memory_manager.read_for_agent(agent_memory_config)

            # Session context passed to agents (for logging only — not in AI prompt)
            agent_session = (
                {"id": session_id, "state": {}} if session_id else None
            )

            try:
                # Execute the step
                if step_cfg.get("mode") == "parallel":
                    async def execute_with_semaphore(item, _agent=agent, _step=step_cfg):
                        async with semaphore:
                            return await _agent.execute_async(
                                _step["task"], item, memory=memory_slice,
                                session=agent_session
                            )

                    results = await asyncio.gather(*[
                        execute_with_semaphore(item)
                        for item in state[step_cfg["input_key"]]
                    ])
                    state[step_cfg["output_key"]] = results
                else:
                    result = await agent.execute_async(
                        step_cfg["task"], state, memory=memory_slice,
                        session=agent_session
                    )
                    state[step_cfg["output_key"]] = result

                # Optional: compress output before passing forward
                if "compression" in step_cfg:
                    from services.context.context_compressor import compress
                    state[step_cfg["output_key"]] = compress(
                        state[step_cfg["output_key"]],
                        strategy=step_cfg["compression"].get("strategy", "none"),
                        params=step_cfg["compression"].get("params", {}),
                    )

                output = state[step_cfg["output_key"]]

                # Write output to runtime memory store
                await memory_manager.write_from_agent(
                    agent_memory_config, agent_name, output
                )

                # Persist to database
                if session_id and session_manager and persistence_on:
                    await self._persist_step_memory(
                        project_id or "",
                        agent_name,
                        step_cfg.get("output_key", agent_name),
                        output,
                        session_id=session_id,
                    )
                elif project_id:
                    await self._persist_step_memory(
                        project_id,
                        agent_name,
                        step_cfg.get("output_key", agent_name),
                        output,
                    )

                steps_run_this_call.append(agent_name)
                completed_steps.add(agent_name)

                # Save session state snapshot after each successful step
                if session_id and session_manager and persistence_on:
                    snapshot = {
                        "last_completed_step": agent_name,
                        "outputs": {
                            key: state[key]
                            for s in self.pipeline_config["steps"]
                            for key in [s.get("output_key")]
                            if key and key in state
                        },
                    }
                    await session_manager.update_state(session_id, snapshot, agent_name)

                if session_id and session_manager and event_tracking_on:
                    await session_manager.append_event(
                        session_id,
                        "agent_step",
                        {
                            "agent": agent_name,
                            "output_key": step_cfg.get("output_key", agent_name),
                            "status": "completed",
                            "data_keys": (
                                list(output.keys())
                                if isinstance(output, dict)
                                else []
                            ),
                        },
                    )

                logger.info(
                    json.dumps({
                        "session_id": session_id,
                        "step": agent_name,
                        "agent": agent_name,
                        "status": "completed",
                        "data_keys": (
                            list(output.keys()) if isinstance(output, dict) else []
                        ),
                    })
                )

            except Exception as e:
                if session_id and session_manager:
                    await session_manager.update_status(session_id, SESSION_STATUS_FAILED)
                    if event_tracking_on:
                        await session_manager.append_event(
                            session_id,
                            "agent_step",
                            {"agent": agent_name, "status": "failed", "error": str(e)},
                        )
                raise

        # Mark session completed if all pipeline steps are now done
        if session_id and session_manager:
            all_agents = {s["agent"] for s in self.pipeline_config["steps"]}
            if all_agents.issubset(completed_steps):
                await session_manager.update_status(session_id, SESSION_STATUS_COMPLETED)
                if event_tracking_on:
                    await session_manager.append_event(
                        session_id,
                        "output",
                        {"keys": list(state.keys())},
                    )

        return state

    # -------------------------------------------------------------------------
    # Private helpers
    # -------------------------------------------------------------------------

    def _steps_completed_before(
        self,
        last_completed_agent: Optional[str],
        steps: list,
    ) -> set:
        """
        Return the set of agent names that are fully completed.
        Scans the steps list in order until last_completed_agent is found.

        Example: last_completed_agent="features", steps=[problems, features, decompose, tasks]
        Returns: {"problems", "features"}
        """
        if last_completed_agent is None:
            return set()
        completed = set()
        for s in steps:
            completed.add(s["agent"])
            if s["agent"] == last_completed_agent:
                break
        return completed

    async def _load_persisted_memory(
        self, store: MemoryStore, project_id: str
    ) -> None:
        """Load all prior project-scoped memory entries into the runtime store."""
        entries = await self.memory_repo.get_by_project(project_id)
        for entry in entries:
            await store.set(entry.memory_key, entry.content)

    async def _persist_step_memory(
        self,
        project_id: str,
        agent_name: str,
        memory_key: str,
        content,
        session_id: str = None,
    ) -> None:
        """Persist a single step's output to the database."""
        entry = MemoryEntry(
            project_id=project_id,
            session_id=session_id,
            agent_name=agent_name,
            memory_key=memory_key,
            content=content if isinstance(content, dict) else {"data": content},
        )
        if session_id:
            await self.memory_repo.save_for_session(entry)
        else:
            await self.memory_repo.save(entry)
