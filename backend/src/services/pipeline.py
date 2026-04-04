# services/pipeline.py

import asyncio
import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Callable, Coroutine, Optional

# backend/src/services/pipeline.py -> parents[2] == backend/
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
from services.agent_factory import AgentFactory
from services.rag.retrieval_service import RetrievalService
from services.config.config_manager import ConfigManager
from services.memory.memory_store import MemoryStore
from services.memory.memory_manager import MemoryManager
from services.memory.memory_repository import MemoryRepository
from services.memory.memory_schemas import MemoryEntry

logger = logging.getLogger("specflow.pipeline")


def _score_features(items: list) -> None:
    """
    Compute score and confidence in-place on each feature dict.
    Reads impact, effort, confidence from the item.
    Weights: impact=0.5, effort=0.3, confidence=0.2
    effort is inverted: low effort = better score.
    """
    _IMPACT_MAP = {"high": 90, "medium": 60, "low": 30}
    _EFFORT_MAP = {"low": 90, "medium": 60, "high": 30}
    _W_IMPACT, _W_EFFORT, _W_CONF = 0.5, 0.3, 0.2
    _DEFAULT_CONF = 75

    for item in items:
        if not isinstance(item, dict):
            continue
        impact_raw = str(item.get("impact", "")).strip().lower()
        effort_raw = str(item.get("effort", "")).strip().lower()
        conf_raw = item.get("confidence", _DEFAULT_CONF)
        conf = float(conf_raw) if conf_raw is not None else _DEFAULT_CONF

        impact_score = _IMPACT_MAP.get(impact_raw, _IMPACT_MAP["medium"])
        effort_score = _EFFORT_MAP.get(effort_raw, _EFFORT_MAP["medium"])

        item["score"] = round(_W_IMPACT * impact_score + _W_EFFORT * effort_score + _W_CONF * conf)
        item["confidence"] = round(conf)


_UUID_PATTERN = re.compile(
    r"[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}", re.IGNORECASE
)
_ISO_TIMESTAMP_PATTERN = re.compile(
    r"\d{4}-\d{2}-\d{2}T[\d:.]+Z?"
)


def normalize_title(text: str) -> str:
    """
    Strip UUIDs and ISO timestamps from a title string, then trim to 10 words.
    Returns empty string if nothing meaningful remains.
    """
    if not isinstance(text, str):
        return ""
    cleaned = _UUID_PATTERN.sub("", text)
    cleaned = _ISO_TIMESTAMP_PATTERN.sub("", cleaned)
    # Collapse whitespace
    cleaned = " ".join(cleaned.split())
    # Trim to 10 words
    words = cleaned.split()[:10]
    return " ".join(words).strip()


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
        skip_item = False

        for fname in fields:
            value = item.get(fname)

            if fname == "title" and isinstance(value, str):
                value = normalize_title(value)
                if not value:
                    skip_item = True
                    break
                item[fname] = value  # write normalized title back

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

        if skip_item:
            continue  # exclude this item from output entirely

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
    Raise ValueError with structured detail if neither context fields nor ingest are provided.
    Called before the first pipeline step executes.
    Error format: "INCOMPLETE_CONTEXT:field1,field2" — parsed by the API layer into HTTP 422.

    Passes if at least one input source is present:
    - Product context: companyName + productName + productDescription all non-empty, OR
    - Interview ingest: at least one ingest item in the list.
    """
    context = input_data.get("context") or {}
    ingest = input_data.get("ingest")

    context_fields = ("companyName", "productName", "productDescription")
    has_context = all(
        context.get(f) and str(context.get(f)).strip()
        for f in context_fields
    )
    has_ingest = isinstance(ingest, list) and len(ingest) > 0

    if has_context or has_ingest:
        return

    # Neither source is present — report all missing fields
    missing = [
        f for f in context_fields
        if not (context.get(f) and str(context.get(f)).strip())
    ]
    missing.append("ingest")
    raise ValueError(f"INCOMPLETE_CONTEXT:{','.join(missing)}")


class Pipeline:
    def __init__(self, pipeline_config_path: str = None):
        import yaml
        from services.config.config_schema import PipelineConfig

        path_str = pipeline_config_path or os.environ.get("PIPELINE_CONFIG_PATH")
        if path_str:
            p = Path(path_str)
            pipeline_path = p if p.is_absolute() else (_BACKEND_ROOT / p)
        else:
            pipeline_path = _BACKEND_ROOT / "config" / "agents" / "pipeline.yaml"
        with open(pipeline_path) as f:
            raw = yaml.safe_load(f)
        self.pipeline_config = PipelineConfig(**raw).model_dump()
        self.memory_repo = MemoryRepository()

        from services.research.research_repository import ResearchRepository
        self.research_repo = ResearchRepository()

        from services.orchestrator.adk_orchestrator import ADKOrchestrator
        self.orchestrator = ADKOrchestrator(self.pipeline_config)

        self._retrieval_service: RetrievalService | None = None
        self._retrieval_service = RetrievalService()

    async def run(
        self,
        input_data: dict,
        project_id: str = None,
        session_id: str = None,
        session_manager=None,
        step: str = None,
        progress_callback: Optional[Callable[[dict], Coroutine]] = None,
        user_id: Optional[str] = None,
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
                await memory_store.set(
                    entry.memory_key,
                    self._unwrap_persisted_content(entry.content),
                )

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

            # Global Project Memory: save new ingest once (first call), then load accumulated context
            if project_id:
                try:
                    if last_completed is None and input_data.get("ingest"):
                        logger.info("[global-memory] Saving %d ingest items for project=%s",
                                   len(input_data["ingest"]), project_id)
                        await self.research_repo.save_global_ingest(
                            project_id, input_data["ingest"]
                        )
                    global_items = await self.research_repo.get_global_ingest(project_id)
                    if global_items:
                        logger.info("[global-memory] Loaded %d global ingest items for project=%s",
                                   len(global_items), project_id)
                        await memory_store.set("global_ingest", global_items)
                except Exception as e:
                    logger.error("[global-memory] Error managing global project memory: %s", str(e), exc_info=True)
                    raise

        elif project_id:
            # Original /run behaviour: load project-scoped persistent memory
            await self._load_persisted_memory(memory_store, project_id)

        steps_run_this_call: list = []

        # Interactive single-step mode: run exactly one named step directly,
        # bypassing the ADK orchestrator (which runs the full pipeline).
        if step is not None:
            step_cfgs = [s for s in self.pipeline_config["steps"] if s["agent"] == step]
            if not step_cfgs:
                raise ValueError(
                    f"Step '{step}' not found in pipeline. "
                    f"Valid steps: {sorted(s['agent'] for s in self.pipeline_config['steps'])}"
                )
            single_step_cfg = step_cfgs[0]
            single_agent_name = single_step_cfg["agent"]
            single_out_key = single_step_cfg.get("output_key", single_agent_name)

            agent = AgentFactory.create(single_agent_name)
            logger.info("[dispatch] step=%s agent_class=%s", single_agent_name, type(agent).__name__)
            agent_memory_config = None
            if hasattr(agent, "config") and isinstance(agent.config, dict):
                memory_raw = agent.config.get("memory")
                if memory_raw:
                    from services.memory.memory_schemas import MemoryConfig
                    agent_memory_config = MemoryConfig(**memory_raw)

            memory_slice = await memory_manager.read_for_agent(agent_memory_config)
            memory_slice = {k: self._unwrap_persisted_content(v) for k, v in memory_slice.items()}
            agent_session = {"id": session_id, "state": {}} if session_id else None

            _RAG_ELIGIBLE = {"problems", "features", "decompose", "tasks"}
            if single_agent_name in _RAG_ELIGIBLE:
                try:
                    state = await self._enrich_context_with_rag(
                        single_agent_name, state, user_id, session_id
                    )
                except Exception as _rag_err:
                    logger.warning(
                        "[pipeline] RAG enrichment failed for step %s: %s",
                        single_agent_name,
                        _rag_err,
                    )

            try:
                output, qg_result = await self._run_step_with_quality_retry(
                    agent=agent,
                    step_task=single_step_cfg["task"],
                    base_context=state,
                    memory_slice=memory_slice,
                    session=agent_session,
                    out_key=single_out_key,
                    state=state,
                )
                state[single_out_key] = self._strip_reasoning_field(output)

                if qg_result is not None:
                    state[f"{single_out_key}_quality"] = self._strip_reasoning_field(qg_result)
                    if session_id and session_manager and event_tracking_on:
                        await session_manager.append_event(
                            session_id,
                            "quality_gate",
                            {
                                "step": single_out_key,
                                "score": qg_result["score"],
                                "passed": qg_result["passed"],
                            },
                        )

                output = state[single_out_key]

                await memory_manager.write_from_agent(agent_memory_config, single_agent_name, output)

                output = self._strip_insufficient_items(output)
                state[single_out_key] = output
                if session_id and session_manager and persistence_on:
                    await self._persist_step_memory(project_id or "", single_agent_name, single_out_key, output, session_id=session_id, user_id=user_id)
                elif project_id:
                    await self._persist_step_memory(project_id, single_agent_name, single_out_key, output)

                if progress_callback:
                    await progress_callback({"type": "step_complete", "step": single_out_key})

                steps_run_this_call.append(single_agent_name)
                completed_steps.add(single_agent_name)

                if session_id and session_manager and persistence_on:
                    _quality_keys = [f"{key}_quality" for key in ("problems", "features", "decompositions", "tasks")]
                    snapshot = {
                        "last_completed_step": single_agent_name,
                        "outputs": {
                            **{key: state[key] for s in self.pipeline_config["steps"] for key in [s.get("output_key")] if key and key in state},
                            **{k: state[k] for k in _quality_keys if k in state},
                        },
                    }
                    await session_manager.update_state(session_id, snapshot, single_agent_name)

                if session_id and session_manager and event_tracking_on:
                    await session_manager.append_event(session_id, "agent_step", {"agent": single_agent_name, "output_key": single_out_key, "status": "completed", "data_keys": list(output.keys()) if isinstance(output, dict) else []})

                logger.info(json.dumps({"session_id": session_id, "step": single_agent_name, "agent": single_agent_name, "status": "completed", "data_keys": list(output.keys()) if isinstance(output, dict) else []}))

            except Exception as e:
                if session_id and session_manager:
                    await session_manager.update_status(session_id, SESSION_STATUS_FAILED)
                    if event_tracking_on:
                        await session_manager.append_event(session_id, "agent_step", {"agent": single_agent_name, "status": "failed", "error": str(e)})
                raise

        else:
            # Full pipeline: delegate agent execution to the ADK SequentialAgent orchestrator.
            # Each typed agent's build_prompt() slices only its needed context keys.
            prior_state = {
                key: state[key]
                for s in self.pipeline_config["steps"]
                for key in [s.get("output_key")]
                if key and key in state
            }
            try:
                adk_result = await self.orchestrator.run(
                    input_data,
                    session_id=session_id or "anon",
                    completed_steps=completed_steps,
                    prior_state=prior_state,
                    progress_callback=progress_callback,
                )
            except Exception as e:
                if session_id and session_manager:
                    await session_manager.update_status(session_id, SESSION_STATUS_FAILED)
                    if event_tracking_on:
                        await session_manager.append_event(session_id, "agent_step", {"status": "failed", "error": str(e)})
                raise

            # Post-process each new step output: coerce → score → validate → persist → snapshot → event
            for step_cfg in self.pipeline_config["steps"]:
                agent_name = step_cfg["agent"]
                out_key = step_cfg.get("output_key", agent_name)

                if agent_name in completed_steps:
                    continue

                raw = adk_result.get(out_key)
                if raw is None:
                    continue

                agent = AgentFactory.create(agent_name)
                logger.info("[dispatch] step=%s agent_class=%s", agent_name, type(agent).__name__)
                data = self._finalize_agent_output(agent_name, out_key, raw, agent)
                state[out_key] = self._strip_reasoning_field(data)

                qg_result = None
                try:
                    qg_result = await self._run_quality_gate_async(out_key, state[out_key], state)
                    if (
                        qg_result is not None
                        and not qg_result.get("passed", False)
                        and getattr(agent, "max_retries", 0) > 0
                    ):
                        memory_raw = agent.config.get("memory") if isinstance(agent.config, dict) else None
                        agent_memory_config = None
                        if memory_raw:
                            from services.memory.memory_schemas import MemoryConfig
                            agent_memory_config = MemoryConfig(**memory_raw)
                        memory_slice = await memory_manager.read_for_agent(agent_memory_config)
                        memory_slice = {
                            key: self._unwrap_persisted_content(value)
                            for key, value in memory_slice.items()
                        }
                        retried_output, qg_result = await self._run_step_with_quality_retry(
                            agent=agent,
                            step_task=step_cfg["task"],
                            base_context=state,
                            memory_slice=memory_slice,
                            session={"id": session_id, "state": {}} if session_id else None,
                            out_key=out_key,
                            state=state,
                        )
                        state[out_key] = self._strip_reasoning_field(retried_output)

                    if qg_result is not None:
                        state[f"{out_key}_quality"] = self._strip_reasoning_field(qg_result)
                        if session_id and session_manager and event_tracking_on:
                            await session_manager.append_event(
                                session_id,
                                "quality_gate",
                                {"step": out_key, "score": qg_result["score"], "passed": qg_result["passed"]},
                            )
                except Exception as _qg_err:
                    logger.warning("[pipeline] quality_gate failed for %s: %s", out_key, _qg_err)

                # Memory write
                agent_memory_config = None
                if hasattr(agent, "config") and isinstance(agent.config, dict):
                    memory_raw = agent.config.get("memory")
                    if memory_raw:
                        from services.memory.memory_schemas import MemoryConfig
                        agent_memory_config = MemoryConfig(**memory_raw)
                await memory_manager.write_from_agent(agent_memory_config, agent_name, data)

                # Persist to database
                data = self._strip_insufficient_items(data)
                state[out_key] = data
                if session_id and session_manager and persistence_on:
                    await self._persist_step_memory(project_id or "", agent_name, out_key, data, session_id=session_id, user_id=user_id)
                elif project_id:
                    await self._persist_step_memory(project_id, agent_name, out_key, data)

                steps_run_this_call.append(agent_name)
                completed_steps.add(agent_name)

                # Session snapshot
                if session_id and session_manager and persistence_on:
                    _quality_keys = [f"{key}_quality" for key in ("problems", "features", "decompositions", "tasks")]
                    snapshot = {
                        "last_completed_step": agent_name,
                        "outputs": {
                            **{key: state[key] for s in self.pipeline_config["steps"] for key in [s.get("output_key")] if key and key in state},
                            **{k: state[k] for k in _quality_keys if k in state},
                        },
                    }
                    await session_manager.update_state(session_id, snapshot, agent_name)

                # Event
                if session_id and session_manager and event_tracking_on:
                    await session_manager.append_event(session_id, "agent_step", {"agent": agent_name, "output_key": out_key, "status": "completed", "data_keys": list(data.keys()) if isinstance(data, dict) else []})

                logger.info(json.dumps({"session_id": session_id, "step": agent_name, "agent": agent_name, "status": "completed", "data_keys": list(data.keys()) if isinstance(data, dict) else []}))

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

    @staticmethod
    def _extract_citation_metadata(content: Any) -> tuple[Any, dict]:
        """
        Extract citation metadata from a list of items for storage in MemoryEntry.metadata.
        Does NOT modify the content — source_ids stay in session state outputs.
        Returns (content, citation_metadata_dict).
        """
        if not isinstance(content, list):
            return content, {}
        citations_map: dict = {}
        for idx, item in enumerate(content):
            if isinstance(item, dict):
                source_ids = item.get("source_ids")
                if isinstance(source_ids, list):
                    citations_map[idx] = source_ids
        total_cited = sum(1 for ids in citations_map.values() if ids)
        return content, {"citations": citations_map, "total_cited": total_cited}

    @staticmethod
    def _strip_insufficient_items(content: Any) -> Any:
        """
        Filter out items where title == 'Insufficient source data'.
        Returns filtered list, or original content if not a list.
        """
        if not isinstance(content, list):
            return content
        filtered = [
            item for item in content
            if not (isinstance(item, dict) and item.get("title") == "Insufficient source data")
        ]
        stripped_count = len(content) - len(filtered)
        if stripped_count:
            logger.warning(
                "[pipeline] stripped %d 'Insufficient source data' item(s) before persist",
                stripped_count,
            )
        return filtered

    @staticmethod
    def _strip_reasoning_field(content: Any) -> Any:
        if isinstance(content, dict) and "reasoning" in content:
            return {key: value for key, value in content.items() if key != "reasoning"}
        return content

    def _finalize_agent_output(self, agent_name: str, out_key: str, data: Any, agent) -> Any:
        data = self._strip_reasoning_field(data)

        if out_key == "features" and isinstance(data, list):
            _score_features(data)

        _schema = agent.config.get("output_schema") or {}
        _validation = validate_output(agent_name, data, _schema)
        if not _validation["valid"]:
            _flagged_count = sum(
                1 for x in _validation["flagged"]
                if isinstance(x, dict) and x.get("quality_flag")
            )
            logger.warning(
                "[validate_output] %s: %d item(s) flagged — %s",
                agent_name,
                _flagged_count,
                _validation["issues"][:5],
            )
            data = _validation["flagged"]

        return self._strip_reasoning_field(data)

    async def _run_quality_gate_async(self, out_key: str, output: Any, state: dict) -> Optional[dict]:
        """Async version of _run_quality_gate — uses evaluate_async to avoid blocking the event loop."""
        if out_key not in ("problems", "features", "decompositions", "tasks"):
            return None

        from services.agents.quality_gate_agent import QualityGateAgent

        _qg_config = ConfigManager.load_agent("quality_gate").model_dump()
        _qg_agent = QualityGateAgent("quality_gate", _qg_config)
        _research_ctx = {
            "ingest": state.get("ingest", []),
            "product_context": state.get("product_context", {}),
        }
        result = await _qg_agent.evaluate_async(out_key, output, _research_ctx)
        return self._strip_reasoning_field(result)

    async def _run_step_with_quality_retry(
        self,
        agent,
        step_task: str,
        base_context: dict,
        memory_slice: dict,
        session: Optional[dict],
        out_key: str,
        state: dict,
    ) -> tuple[Any, Optional[dict]]:
        attempt = 1
        context = dict(base_context or {})

        while True:
            result = await agent.execute_async(
                step_task,
                context,
                memory=memory_slice,
                session=session,
            )
            data = self._finalize_agent_output(agent.name, out_key, result, agent)

            qg_result = None
            try:
                qg_result = await self._run_quality_gate_async(out_key, data, state)
                if qg_result is not None:
                    logger.info(
                        "[pipeline] quality_gate step=%s score=%d passed=%s",
                        out_key,
                        qg_result["score"],
                        qg_result["passed"],
                    )
            except Exception as qg_err:
                logger.warning("[pipeline] quality_gate failed for %s: %s", out_key, qg_err)

            should_retry = (
                qg_result is not None
                and not qg_result.get("passed", False)
                and attempt == 1
                and getattr(agent, "max_retries", 0) > 0
            )
            if not should_retry:
                return data, qg_result

            feedback = agent.build_failure_feedback(
                source="quality_gate",
                attempt=attempt,
                score=qg_result.get("score"),
                critical_issues=qg_result.get("critical_issues", []),
                item_results=qg_result.get("items", []),
            )
            context = {**dict(base_context or {}), "previous_attempt_failure": feedback}
            attempt += 1
            logger.info(
                "[pipeline] retrying step=%s once with quality feedback score=%s",
                out_key,
                qg_result.get("score"),
            )

    async def _enrich_context_with_rag(
        self,
        step_name: str,
        context: dict,
        user_id: str = None,
        session_id: str = None,
    ) -> dict:
        """Enrich agent context with semantically relevant research_entries via pgvector.

        Returns context unchanged if no results are found or retrieval fails.
        """
        results = await self._retrieval_service.retrieve_for_step(
            step_name, context, user_id=user_id, session_id=session_id
        )
        logger.debug("[_enrich_context_with_rag] step=%s results=%d", step_name, len(results))
        if not results:
            return context
        rag_context = [
            {
                "title": r["title"],
                "content": r["content"],
                "source": r["type"],
                "relevance": round(r["similarity"], 3),
            }
            for r in results
        ]
        return {**context, "rag_context": rag_context}

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
            await store.set(entry.memory_key, self._unwrap_persisted_content(entry.content))

    async def _persist_step_memory(
        self,
        project_id: str,
        agent_name: str,
        memory_key: str,
        content,
        session_id: str = None,
        user_id: str = None,
    ) -> None:
        """Persist a single step's output to the database."""
        content = self._strip_reasoning_field(content)
        content, citation_metadata = self._extract_citation_metadata(content)
        if session_id:
            # Session-scoped memory: do NOT set project_id to avoid constraint conflicts
            entry = MemoryEntry(
                session_id=session_id,
                user_id=user_id,
                agent_name=agent_name,
                memory_key=memory_key,
                content=content if isinstance(content, dict) else {"data": content},
                metadata=citation_metadata,
            )
            await self.memory_repo.save_for_session(entry)
        else:
            # Project-scoped memory
            entry = MemoryEntry(
                project_id=project_id,
                agent_name=agent_name,
                memory_key=memory_key,
                content=content if isinstance(content, dict) else {"data": content},
                metadata=citation_metadata,
            )
            await self.memory_repo.save(entry)

    @staticmethod
    def _unwrap_persisted_content(content: Any) -> Any:
        """
        Reverse the wrapping applied by _persist_step_memory.
        {"data": value} → value  (only when "data" is the sole key)
        Everything else passes through unchanged.
        """
        if isinstance(content, dict) and list(content.keys()) == ["data"]:
            return content["data"]
        return content
