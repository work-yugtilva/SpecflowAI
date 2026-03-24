# services/pipeline.py

import asyncio
import json
import logging
from typing import Any, Optional
from services.agent_factory import AgentFactory
from services.config.config_manager import ConfigManager
from services.memory.memory_store import MemoryStore
from services.memory.memory_manager import MemoryManager
from services.memory.memory_repository import MemoryRepository
from services.memory.memory_schemas import MemoryEntry

logger = logging.getLogger("specflow.pipeline")


def _collect_lists_of_dicts(node: Any, depth: int, acc: list) -> None:
    """Find every list whose items are all dicts (e.g. nested groups/sections)."""
    if depth > 14:
        return
    if isinstance(node, list):
        if node and all(isinstance(x, dict) for x in node):
            if not any(isinstance(x, dict) and "error" in x for x in node):
                acc.append(node)
        for x in node:
            if isinstance(x, (dict, list)):
                _collect_lists_of_dicts(x, depth + 1, acc)
        return
    if isinstance(node, dict):
        if "error" in node:
            return
        for v in node.values():
            _collect_lists_of_dicts(v, depth + 1, acc)


def _discover_longest_dict_list(root: Any) -> Optional[list]:
    acc: list = []
    _collect_lists_of_dicts(root, 0, acc)
    if not acc:
        return None
    return max(acc, key=len)


def _is_single_problem_dict(d: dict) -> bool:
    """Model returned one problem row instead of a JSON array."""
    if "error" in d:
        return False
    title = d.get("title") or d.get("name")
    if not isinstance(title, str) or not str(title).strip():
        return False
    schema_keys = (
        "summary",
        "description",
        "time_cost",
        "error_risk",
        "user_frustration",
        "desired_outcome",
        "cluster",
        "sources",
        "attributes",
        "metadata",
    )
    return any(k in d for k in schema_keys)


def _coerce_problems_output(value: Any) -> Any:
    """
    Problems agent is instructed to return a JSON array but models often wrap it
    ({ "problems": [...] }, { "items": [...] }, groups/sections, or stringified JSON).
    Keep { "error": ... } payloads from failed parses unchanged.
    """
    if value is None:
        return []
    if isinstance(value, str):
        try:
            return _coerce_problems_output(json.loads(value))
        except Exception:
            return value
    if isinstance(value, dict) and "error" in value:
        return value
    if isinstance(value, list):
        if not value:
            return value
        if all(isinstance(x, str) for x in value):
            return [{"title": (s or "")[:240], "summary": s or ""} for s in value]
        if all(isinstance(x, dict) for x in value):
            return value
        # Mixed list — try to salvage dict rows
        dict_rows = [x for x in value if isinstance(x, dict) and "error" not in x]
        if dict_rows:
            return dict_rows
        return value
    if isinstance(value, dict):
        if _is_single_problem_dict(value):
            return [value]
        for k in (
            "problems",
            "items",
            "identified_problems",
            "problem_list",
            "issues",
            "pain_points",
            "data",
            "results",
            "value",
        ):
            inner = value.get(k)
            if isinstance(inner, list) and inner:
                coerced = _coerce_problems_output(inner)
                if isinstance(coerced, list):
                    return coerced
            if isinstance(inner, dict):
                for k2 in ("items", "problems", "results"):
                    v2 = inner.get(k2)
                    if isinstance(v2, list) and v2:
                        return _coerce_problems_output(v2)
        discovered = _discover_longest_dict_list(value)
        if discovered:
            return discovered
    return value


def _is_single_feature_dict(d: dict) -> bool:
    """Model returned one feature object instead of a JSON array."""
    if "error" in d:
        return False
    title = d.get("title") or d.get("name")
    if not isinstance(title, str) or not str(title).strip():
        return False
    schema_keys = (
        "description",
        "summary",
        "linked_problems",
        "linked_items",
        "priority_tier",
        "success_metrics",
        "attributes",
        "reasoning",
        "metadata",
    )
    return any(k in d for k in schema_keys)


def _coerce_features_output(value: Any) -> Any:
    """
    Features agent should return a JSON array; normalize wrapped / single-object shapes.
    """
    if value is None:
        return []
    if isinstance(value, str):
        try:
            return _coerce_features_output(json.loads(value))
        except Exception:
            return value
    if isinstance(value, dict) and "error" in value:
        return value
    if isinstance(value, list):
        if not value:
            return value
        if all(isinstance(x, str) for x in value):
            return [
                {"title": (s or "")[:240], "description": s or "", "linked_problems": []}
                for s in value
            ]
        if all(isinstance(x, dict) for x in value):
            return value
        dict_rows = [x for x in value if isinstance(x, dict) and "error" not in x]
        if dict_rows:
            return dict_rows
        return value
    if isinstance(value, dict):
        if _is_single_feature_dict(value):
            return [value]
        for k in (
            "features",
            "items",
            "capabilities",
            "results",
            "data",
            "value",
            "product_features",
        ):
            inner = value.get(k)
            if isinstance(inner, list) and inner:
                coerced = _coerce_features_output(inner)
                if isinstance(coerced, list):
                    return coerced
            if isinstance(inner, dict):
                for k2 in ("items", "features", "results"):
                    v2 = inner.get(k2)
                    if isinstance(v2, list) and v2:
                        return _coerce_features_output(v2)
        discovered = _discover_longest_dict_list(value)
        if discovered:
            return discovered
    return value


def validate_output(agent_name: str, output: Any, output_schema: dict) -> dict:
    """
    Validate agent output against required fields from output_schema.
    Returns: {"valid": bool, "issues": list[str], "flagged": list}

    Rules (all derived from output_schema["fields"] — no hardcoded names):
    - Every item must have all declared fields (non-None, non-empty)
    - Fields whose type string contains " | " are enums: value must match one option
    - "title": min 5 chars
    - "description": min 50 chars
    - "research_evidence": min 10 chars
    - All other string fields: non-blank
    Failing items get quality_flag + quality_issues added. Not dropped.
    """
    if not isinstance(output, list):
        return {"valid": True, "issues": [], "flagged": output}

    fields: dict = {}
    if isinstance(output_schema, dict):
        fields = output_schema.get("fields") or {}

    if not fields:
        return {"valid": True, "issues": [], "flagged": output}

    # Detect enum fields: type string contains " | " (e.g. "high | medium | low")
    enum_fields: dict = {}
    for fname, ftype in fields.items():
        if isinstance(ftype, str) and " | " in ftype:
            enum_fields[fname] = [v.strip().lower() for v in ftype.split("|")]

    # Min-length thresholds keyed by field name
    MIN_LENGTHS: dict = {"title": 5, "description": 50, "research_evidence": 10}

    all_issues: list = []
    flagged_output: list = []

    for i, item in enumerate(output):
        if not isinstance(item, dict):
            flagged_output.append(item)
            continue

        item_issues: list = []

        for fname in fields:
            value = item.get(fname)

            if value is None or value == "":
                item_issues.append(f"field '{fname}' is missing or empty")
                continue

            if fname in enum_fields:
                if str(value).lower() not in enum_fields[fname]:
                    item_issues.append(
                        f"field '{fname}' value '{value}' not in {enum_fields[fname]}"
                    )
            elif fname in MIN_LENGTHS and isinstance(value, str):
                if len(value) < MIN_LENGTHS[fname]:
                    item_issues.append(
                        f"field '{fname}' too short (len={len(value)}, min={MIN_LENGTHS[fname]})"
                    )
            elif isinstance(value, str) and not value.strip():
                item_issues.append(f"field '{fname}' is blank")

        if item_issues:
            flagged_output.append({
                **item,
                "quality_flag": "low_confidence",
                "quality_issues": item_issues,
            })
            all_issues.extend(f"item[{i}].{iss}" for iss in item_issues)
        else:
            flagged_output.append(item)

    return {"valid": len(all_issues) == 0, "issues": all_issues, "flagged": flagged_output}


def validate_pipeline_input(input_data: dict) -> None:
    """
    Raise ValueError with structured detail if required context fields or ingest are missing.
    Called before the first pipeline step executes.
    Error format: "INCOMPLETE_CONTEXT:field1,field2" — parsed by the API layer into HTTP 422.
    """
    context = input_data.get("context") or {}
    missing = []

    for field in ("companyName", "productName", "productDescription"):
        val = context.get(field)
        if not val or not str(val).strip():
            missing.append(field)

    ingest = input_data.get("ingest")
    if not ingest or not isinstance(ingest, list) or len(ingest) == 0:
        missing.append("ingest")

    if missing:
        raise ValueError(f"INCOMPLETE_CONTEXT:{','.join(missing)}")


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

        # Gate: reject immediately if required context fields or ingest are missing
        validate_pipeline_input(input_data)

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
                    out_key = step_cfg.get("output_key", agent_name)
                    if out_key == "problems":
                        state[out_key] = _coerce_problems_output(result)
                    elif out_key == "features":
                        state[out_key] = _coerce_features_output(result)
                    else:
                        state[out_key] = result

                # Optional: compress output before passing forward
                if "compression" in step_cfg:
                    from services.context.context_compressor import compress
                    state[step_cfg["output_key"]] = compress(
                        state[step_cfg["output_key"]],
                        strategy=step_cfg["compression"].get("strategy", "none"),
                        params=step_cfg["compression"].get("params", {}),
                    )

                output = state[step_cfg["output_key"]]

                # Validate output quality against agent's output_schema
                _schema = agent.config.get("output_schema") or {}
                _validation = validate_output(agent_name, output, _schema)
                if not _validation["valid"]:
                    _flagged_count = sum(
                        1 for x in _validation["flagged"]
                        if isinstance(x, dict) and x.get("quality_flag")
                    )
                    logger.warning(
                        "[validate_output] %s: %d item(s) flagged — %s",
                        agent_name, _flagged_count, _validation["issues"][:5],
                    )
                    output = _validation["flagged"]
                    state[step_cfg["output_key"]] = output

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
