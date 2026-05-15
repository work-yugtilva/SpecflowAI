import pytest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_run_pipeline_success(client):
    mock_pipeline = AsyncMock()
    mock_pipeline.run.return_value = {"result": "ok"}
    mock_plan = AsyncMock()
    with patch("main.Pipeline", return_value=mock_pipeline), \
         patch("main.PlanService", return_value=mock_plan):
        response = await client.post("/run", json={"input_data": {"key": "val"}})
    assert response.status_code == 200
    assert response.json()["success"] is True
    mock_plan.check_limit.assert_not_awaited()
    mock_plan.record_usage.assert_not_awaited()


@pytest.mark.asyncio
async def test_run_pipeline_enforces_plan_when_limits_enabled(client, monkeypatch):
    monkeypatch.setenv("DISABLE_PIPELINE_LIMITS", "false")
    mock_pipeline = AsyncMock()
    mock_pipeline.run.return_value = {"result": "ok"}
    mock_plan = AsyncMock()
    with patch("main.Pipeline", return_value=mock_pipeline), \
         patch("main.PlanService", return_value=mock_plan):
        response = await client.post("/run", json={"input_data": {"key": "val"}})
    assert response.status_code == 200
    mock_plan.check_limit.assert_awaited_once_with("test-user-id", is_full_run=True)
    mock_plan.record_usage.assert_awaited_once_with("test-user-id", is_full_run=True)


@pytest.mark.asyncio
async def test_run_pipeline_with_project_id(client):
    mock_pipeline = AsyncMock()
    mock_pipeline.run.return_value = {}
    mock_plan = AsyncMock()
    with patch("main.Pipeline", return_value=mock_pipeline), \
         patch("main.PlanService", return_value=mock_plan):
        response = await client.post(
            "/run", json={"input_data": {}, "project_id": "proj-xyz"}
        )
    assert response.status_code == 200
    mock_pipeline.run.assert_called_once_with({}, "proj-xyz")


@pytest.mark.asyncio
async def test_run_pipeline_missing_input_data_returns_422(client):
    response = await client.post("/run", json={})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_run_pipeline_error_returns_500(client):
    mock_pipeline = AsyncMock()
    mock_pipeline.run.side_effect = RuntimeError("AI call failed")
    with patch("main.Pipeline", return_value=mock_pipeline):
        response = await client.post("/run", json={"input_data": {}})
    assert response.status_code == 500


@pytest.mark.asyncio
async def test_run_pipeline_incomplete_context_returns_422(client):
    mock_pipeline = AsyncMock()
    mock_pipeline.run.side_effect = ValueError(
        "INCOMPLETE_CONTEXT:companyName,productName,productDescription,ingest"
    )
    mock_plan = AsyncMock()
    with patch("main.Pipeline", return_value=mock_pipeline), \
         patch("main.PlanService", return_value=mock_plan):
        response = await client.post("/run", json={"input_data": {}})
    assert response.status_code == 422
    assert "INCOMPLETE_CONTEXT" in response.json()["detail"]


def test_validate_pipeline_input_all_missing():
    from services.pipeline import validate_pipeline_input

    with pytest.raises(ValueError) as exc:
        validate_pipeline_input({})
    error_str = str(exc.value)
    assert "INCOMPLETE_CONTEXT" in error_str
    assert "companyName" in error_str
    assert "productName" in error_str
    assert "productDescription" in error_str
    assert "ingest" in error_str


def test_validate_pipeline_input_context_only_no_ingest():
    from services.pipeline import validate_pipeline_input

    # Complete product context without ingest should pass
    validate_pipeline_input({
        "context": {
            "companyName": "Acme",
            "productName": "Widget",
            "productDescription": "A widget for users",
        }
    })


def test_validate_pipeline_input_happy_path():
    from services.pipeline import validate_pipeline_input

    # Both context and ingest — should not raise
    validate_pipeline_input({
        "context": {
            "companyName": "Acme",
            "productName": "Widget",
            "productDescription": "A widget for users",
        },
        "ingest": [{"content": "some interview"}],
    })


def test_validate_pipeline_input_research_only():
    from services.pipeline import validate_pipeline_input

    validate_pipeline_input({
        "context": {},
        "research": [
            {
                "title": "Server research",
                "content": "Users cannot find decision history.",
            }
        ],
        "ingest": [],
    })


def test_validate_pipeline_input_ingest_only_no_context():
    from services.pipeline import validate_pipeline_input

    # Ingest alone (no context) should pass
    validate_pipeline_input({
        "ingest": [{"content": "some interview notes"}],
    })


def test_validate_pipeline_input_ingest_only_none_context():
    from services.pipeline import validate_pipeline_input

    # None context + ingest should pass
    validate_pipeline_input({"context": None, "ingest": [{"content": "interview"}]})


def test_validate_pipeline_input_context_only_empty_ingest():
    from services.pipeline import validate_pipeline_input

    # Complete context + empty ingest list should pass (context is enough)
    validate_pipeline_input({
        "context": {
            "companyName": "Acme",
            "productName": "Widget",
            "productDescription": "A widget for users",
        },
        "ingest": [],
    })


def test_validate_pipeline_input_whitespace_context_with_ingest():
    from services.pipeline import validate_pipeline_input

    # Whitespace context but valid ingest — ingest is enough, should pass
    validate_pipeline_input({
        "context": {
            "companyName": "   ",
            "productName": "Widget",
            "productDescription": "A widget for users",
        },
        "ingest": [{"content": "interview"}],
    })


def test_validate_pipeline_input_neither_source():
    from services.pipeline import validate_pipeline_input
    import pytest

    # No context and no ingest — should raise
    with pytest.raises(ValueError) as exc:
        validate_pipeline_input({
            "context": {
                "companyName": "   ",  # whitespace only
                "productName": "",
                "productDescription": "",
            },
            "ingest": [],
        })
    assert "INCOMPLETE_CONTEXT" in str(exc.value)


def test_normalize_title_strips_uuid():
    from services.pipeline import normalize_title
    result = normalize_title("bebc4a35-1234-5678-abcd-ef0123456789 Interview Notes")
    assert "bebc4a35" not in result
    assert "Interview Notes" in result


def test_normalize_title_strips_iso_timestamp():
    from services.pipeline import normalize_title
    result = normalize_title("2024-03-15T10:30:00Z Session Data")
    assert "2024-03-15" not in result
    assert "Session Data" in result


def test_normalize_title_trims_to_10_words():
    from services.pipeline import normalize_title
    long = "one two three four five six seven eight nine ten eleven"
    result = normalize_title(long)
    assert len(result.split()) == 10


def test_normalize_title_returns_empty_for_uuid_only():
    from services.pipeline import normalize_title
    result = normalize_title("bebc4a35-1234-5678-abcd-ef0123456789")
    assert result == ""


def test_validate_output_excludes_uuid_only_title():
    from services.pipeline import validate_output
    items = [
        {"id": "1", "title": "bebc4a35-1234-5678-abcd-ef0123456789", "description": "test"},
        {"id": "2", "title": "Real User Problem", "description": "test"},
    ]
    result = validate_output("test_agent", items, {"fields": {"title": "str", "description": "str"}})
    # Item with UUID-only title should be excluded
    titles = [item.get("title") for item in result["flagged"]]
    assert "Real User Problem" in titles
    # The UUID-only item should not appear in output
    for item in result["flagged"]:
        assert "bebc4a35" not in (item.get("title") or "")


def test_strip_reasoning_field_removes_top_level_reasoning():
    from services.pipeline import Pipeline

    result = Pipeline._strip_reasoning_field({
        "reasoning": "Internal trace",
        "executive_summary": "Ship it",
    })

    assert result == {"executive_summary": "Ship it"}


@pytest.mark.asyncio
async def test_persist_step_memory_strips_reasoning_before_save():
    from services.pipeline import Pipeline

    pipeline = Pipeline.__new__(Pipeline)
    pipeline.memory_repo = AsyncMock()

    await pipeline._persist_step_memory(
        project_id="proj-1",
        agent_name="prd",
        memory_key="prd",
        content={"reasoning": "Internal only", "executive_summary": "Draft"},
        session_id="sess-1",
        user_id="user-1",
    )

    saved_entry = pipeline.memory_repo.save_for_session.await_args.args[0]
    assert saved_entry.content == {"executive_summary": "Draft"}


@pytest.mark.asyncio
async def test_run_step_with_quality_retry_passes_feedback_once():
    from services.agents.base_agent import BaseAgent
    from services.pipeline import Pipeline

    pipeline = Pipeline.__new__(Pipeline)
    pipeline._finalize_agent_output = MagicMock(side_effect=lambda *_args: _args[2])
    pipeline._run_quality_gate_async = AsyncMock(side_effect=[
        {
            "score": 40,
            "passed": False,
            "critical_issues": ["Missing evidence"],
            "items": [
                {
                    "index": 0,
                    "binary_checks": {"evidence_cited": False},
                    "quality_issues": ["Task must cite tagged evidence."],
                }
            ],
        },
        {
            "score": 90,
            "passed": True,
            "critical_issues": [],
            "items": [],
        },
    ])

    agent = BaseAgent("tasks", {"max_retries": 2})
    agent.execute_async = AsyncMock(side_effect=[
        [{"id": "t1", "title": "Implement feature", "acceptance_criteria": "Feature works"}],
        [{"id": "t1", "title": "Implement feature", "acceptance_criteria": "Feature works"}],
    ])

    output, qg_result = await pipeline._run_step_with_quality_retry(
        agent=agent,
        step_task="Generate tasks",
        base_context={"problems": [{"title": "Problem 1"}]},
        memory_slice={},
        session=None,
        out_key="tasks",
        state={},
    )

    assert output == [{"id": "t1", "title": "Implement feature", "acceptance_criteria": "Feature works"}]
    assert qg_result["passed"] is True
    assert agent.execute_async.await_count == 2

    retry_context = agent.execute_async.await_args_list[1].args[1]
    assert retry_context["previous_attempt_failure"]["source"] == "quality_gate"
    assert retry_context["previous_attempt_failure"]["score"] == 40
    assert retry_context["previous_attempt_failure"]["critical_issues"] == ["Missing evidence"]
    assert retry_context["previous_attempt_failure"]["item_failures"] == [
        {
            "index": 0,
            "failed_checks": ["evidence_cited"],
            "quality_issues": ["Task must cite tagged evidence."],
        }
    ]


@pytest.mark.asyncio
async def test_run_step_with_quality_retry_accepts_empty_problems_without_retry():
    from services.pipeline import Pipeline

    pipeline = Pipeline.__new__(Pipeline)
    pipeline._finalize_agent_output = MagicMock(return_value=[])
    pipeline._run_quality_gate_async = AsyncMock()

    agent = MagicMock()
    agent.name = "problems"
    agent.max_retries = 2
    agent.execute_async = AsyncMock(return_value=[])

    output, qg_result = await pipeline._run_step_with_quality_retry(
        agent=agent,
        step_task="Find problems",
        base_context={"ingest": []},
        memory_slice={},
        session=None,
        out_key="problems",
        state={},
    )

    assert output == []
    assert qg_result is None
    agent.execute_async.assert_awaited_once()
    pipeline._run_quality_gate_async.assert_not_awaited()


@pytest.mark.asyncio
async def test_full_pipeline_passes_normalized_research_to_orchestrator():
    from services.pipeline import Pipeline

    pipeline = Pipeline.__new__(Pipeline)
    pipeline.pipeline_config = {
        "steps": [
            {
                "agent": "problems",
                "task": "Find problems",
                "output_key": "problems",
            }
        ],
        "session": {},
        "execution": {},
    }
    pipeline.orchestrator = AsyncMock()
    pipeline.orchestrator.run.return_value = {"problems": None}

    input_data = {
        "context": {},
        "research": [
            {
                "title": "Server research",
                "content": "Users cannot find decision history.",
            }
        ],
        "ingest": [],
    }

    await pipeline.run(input_data)

    normalized_input = pipeline.orchestrator.run.await_args.args[0]
    assert normalized_input["ingest"] == input_data["research"]
    assert normalized_input["research"] == input_data["research"]


@pytest.mark.asyncio
async def test_full_pipeline_stops_cleanly_when_problems_empty():
    from services.pipeline import Pipeline

    stopped = {
        "status": "STOPPED",
        "reason": "NO_PROBLEMS_DETECTED",
        "message": "No problems were detected from your sources. Add more detailed source documents and re-run.",
    }
    pipeline = Pipeline.__new__(Pipeline)
    pipeline.pipeline_config = {
        "steps": [
            {"agent": "problems", "task": "Find problems", "output_key": "problems"},
            {"agent": "features", "task": "Find features", "output_key": "features"},
        ],
        "session": {"persistence": True, "event_tracking": True},
        "execution": {"resumable": True},
    }
    pipeline.orchestrator = AsyncMock()
    pipeline.orchestrator.run.return_value = {
        "problems": [],
        "features": None,
        "pipeline_status": stopped,
    }
    pipeline.memory_repo = AsyncMock()
    pipeline.memory_repo.get_by_session.return_value = []
    pipeline.research_repo = AsyncMock()
    pipeline._persist_step_memory = AsyncMock()
    pipeline._run_quality_gate_async = AsyncMock(return_value=None)

    session_manager = AsyncMock()
    session_manager.get_current_state.return_value = {}

    with patch(
        "services.pipeline.AgentFactory.create",
        return_value=SimpleNamespace(
            name="problems",
            config={"output_schema": {}, "max_retries": 0},
            max_retries=0,
        ),
    ):
        result = await pipeline.run(
            {
                "context": {
                    "companyName": "Acme",
                    "productName": "Widget",
                    "productDescription": "A widget for users",
                },
                "ingest": [],
                "research": [],
            },
            session_id="session-1",
            session_manager=session_manager,
            user_id="user-1",
        )

    assert result["problems"] == []
    assert result["pipeline_status"] == stopped
    assert "features" not in result
    session_manager.update_status.assert_awaited_once_with("session-1", "STOPPED")
    snapshot = session_manager.update_state.await_args.args[1]
    assert snapshot["last_completed_step"] == "problems"
    assert snapshot["pipeline_status"] == stopped
    assert snapshot["outputs"] == {"problems": []}
