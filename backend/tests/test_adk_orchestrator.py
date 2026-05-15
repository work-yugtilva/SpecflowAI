import os
import sys
import types
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../src"))


@pytest.mark.asyncio
async def test_features_step_halts_without_calling_agent_when_problems_empty():
    class FakeGoogleBaseAgent:
        def __init__(self, name: str, description: str = ""):
            self.name = name
            self.description = description

    class FakeSequentialAgent:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    class FakeEvent:
        def __init__(self, author=None, content=None, actions=None):
            self.author = author
            self.content = content
            self.actions = actions

    class FakeEventActions:
        def __init__(self, state_delta=None):
            self.state_delta = state_delta

    class FakeInMemoryRunner:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    class FakeContent:
        def __init__(self, parts=None):
            self.parts = parts or []

    class FakePart:
        def __init__(self, text=""):
            self.text = text

    sys.modules.setdefault("google", types.ModuleType("google"))
    sys.modules["google.adk"] = types.ModuleType("google.adk")
    sys.modules["google.adk.agents"] = types.SimpleNamespace(
        BaseAgent=FakeGoogleBaseAgent,
        SequentialAgent=FakeSequentialAgent,
    )
    sys.modules["google.adk.events"] = types.SimpleNamespace(
        Event=FakeEvent,
        EventActions=FakeEventActions,
    )
    sys.modules["google.adk.runners"] = types.SimpleNamespace(
        InMemoryRunner=FakeInMemoryRunner,
    )
    sys.modules["google.genai"] = types.ModuleType("google.genai")
    sys.modules["google.genai.types"] = types.SimpleNamespace(
        Content=FakeContent,
        Part=FakePart,
    )

    from services.orchestrator.adk_orchestrator import _SpecFlowStep

    step = _SpecFlowStep(
        agent_name="features",
        task="Generate features",
        output_key="features",
    )
    ctx = SimpleNamespace(
        session=SimpleNamespace(
            state={
                "_completed": {},
                "_session_id": "session-1",
                "_user_id": "user-1",
                "problems": [],
            }
        )
    )

    with patch("services.agent_factory.AgentFactory.create", MagicMock()) as create_agent:
        events = [event async for event in step._run_async_impl(ctx)]

    create_agent.assert_not_called()
    assert len(events) == 1
    assert events[0].actions.state_delta == {
        "_pipeline_stop": {
            "status": "STOPPED",
            "reason": "NO_PROBLEMS_DETECTED",
            "message": "No problems were detected from your sources. Add more detailed source documents and re-run.",
        },
        "pipeline_status": {
            "status": "STOPPED",
            "reason": "NO_PROBLEMS_DETECTED",
            "message": "No problems were detected from your sources. Add more detailed source documents and re-run.",
        },
    }
