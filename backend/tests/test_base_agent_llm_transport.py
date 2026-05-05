import os
import sys
from unittest.mock import AsyncMock

import pytest

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../src"))


@pytest.mark.asyncio
async def test_call_llm_forwards_routing_config(monkeypatch):
    from services.agents import base_agent
    from services.agents.base_agent import BaseAgent

    call = AsyncMock(return_value="raw response")
    monkeypatch.setattr(base_agent, "call_llm", call)
    agent = BaseAgent(
        "features",
        {
            "provider": "google",
            "model": "gemini-2.5-flash",
            "use_cache": True,
        },
    )

    result = await agent._call_llm("system prompt", "user message")

    assert result == "raw response"
    call.assert_awaited_once_with(
        provider="google",
        model="gemini-2.5-flash",
        system_prompt="system prompt",
        user_message="user message",
        use_cache=True,
    )


@pytest.mark.asyncio
async def test_execute_async_unstructured_uses_call_llm_and_parses_json(monkeypatch):
    from services.agents import base_agent
    from services.agents.base_agent import BaseAgent

    call = AsyncMock(return_value='{"reasoning": "ok", "result": "done"}')
    monkeypatch.setattr(base_agent, "call_llm", call)
    agent = BaseAgent(
        "query",
        {
            "provider": "google",
            "model": "gemini-2.5-flash",
            "system_prompt": "system prompt",
            "token_control": {"retries": 0},
        },
    )

    result = await agent.execute_async("answer question", context={"topic": "billing"})

    assert result == {"result": "done"}
    assert call.await_count == 1
    kwargs = call.await_args.kwargs
    assert kwargs["provider"] == "google"
    assert kwargs["model"] == "gemini-2.5-flash"
    assert kwargs["system_prompt"] == "system prompt"
    assert "<task>\nanswer question\n</task>" in kwargs["user_message"]
    assert "<topic>\nbilling\n</topic>" in kwargs["user_message"]


@pytest.mark.asyncio
async def test_execute_async_retry_still_uses_parse_error_prompt(monkeypatch):
    from services.agents import base_agent
    from services.agents.base_agent import BaseAgent

    call = AsyncMock(side_effect=["not json", '{"result": "recovered"}'])
    monkeypatch.setattr(base_agent, "call_llm", call)
    agent = BaseAgent(
        "query",
        {
            "provider": "openai",
            "model": "gpt-test",
            "token_control": {"retries": 1},
        },
    )

    result = await agent.execute_async("make json", context={"topic": "retry"})

    assert result == {"result": "recovered"}
    assert call.await_count == 2
    retry_message = call.await_args_list[1].kwargs["user_message"]
    assert "Your previous response could not be parsed as JSON." in retry_message
    assert "Original task:" in retry_message
    assert "<task>\nmake json\n</task>" in retry_message


@pytest.mark.asyncio
async def test_execute_async_structured_google_uses_provider_transport(monkeypatch):
    from services.agents import base_agent
    from services.agents.base_agent import BaseAgent
    from services.ai import client as ai_client

    call = AsyncMock(return_value='{"reasoning": "ok", "items": [{"title": "Hosted checkout"}]}')
    structured = AsyncMock(side_effect=AssertionError("should not call Anthropic structured transport"))
    monkeypatch.setattr(base_agent, "call_llm", call)
    monkeypatch.setattr(ai_client, "run_ai_structured_async", structured)

    agent = BaseAgent(
        "features",
        {
            "provider": "google",
            "model": "gemini-2.5-flash",
            "system_prompt": "structured system",
            "token_control": {"retries": 0},
            "output_schema": {
                "type": "list",
                "sections": {"reasoning": "string"},
                "fields": {"title": "string"},
            },
        },
    )

    result = await agent.execute_async("generate features", context={"topic": "checkout"})

    assert result == [{"title": "Hosted checkout"}]
    structured.assert_not_awaited()
    call.assert_awaited_once()
    assert call.await_args.kwargs["provider"] == "google"
    assert call.await_args.kwargs["model"] == "gemini-2.5-flash"
    assert call.await_args.kwargs["system_prompt"] == "structured system"
    assert "<response_contract>" in call.await_args.kwargs["user_message"]


@pytest.mark.asyncio
async def test_async_critic_check_uses_call_llm(monkeypatch):
    from services.agents import base_agent
    from services.agents.base_agent import BaseAgent

    raw = '[{"index": 0, "binary_checks": {"evidence": false}, "quality_issues": ["Missing source"]}]'
    call = AsyncMock(return_value=raw)
    monkeypatch.setattr(base_agent, "call_llm", call)
    agent = BaseAgent(
        "features",
        {
            "provider": "google",
            "model": "gemini-2.5-flash",
            "use_cache": True,
            "system_prompt": "critic system",
        },
    )

    result = await agent._critic_check_async(
        [{"title": "Feature"}],
        [{"name": "evidence", "pass_condition": "Has source", "fail_condition": "Missing source"}],
    )

    assert result[0]["binary_checks"]["evidence"] is False
    call.assert_awaited_once()
    assert call.await_args.kwargs["system_prompt"] == "critic system"
    assert call.await_args.kwargs["use_cache"] is True
    assert "<items_to_check>" in call.await_args.kwargs["user_message"]


@pytest.mark.asyncio
async def test_async_critic_rewrite_uses_call_llm(monkeypatch):
    from services.agents import base_agent
    from services.agents.base_agent import BaseAgent

    raw = '[{"title": "Feature", "research_evidence": "[Source: Interview]"}]'
    call = AsyncMock(return_value=raw)
    monkeypatch.setattr(base_agent, "call_llm", call)
    agent = BaseAgent(
        "features",
        {
            "provider": "anthropic",
            "model": "claude-haiku-4-5-20251001",
            "system_prompt": "rewrite system",
        },
    )

    result = await agent._critic_rewrite_async(
        [{"title": "Feature"}],
        [{"index": 0, "binary_checks": {"evidence": False}, "quality_issues": ["Missing source"]}],
        [{"name": "evidence", "pass_condition": "Has source", "fail_condition": "Missing source"}],
    )

    assert result == [{"title": "Feature", "research_evidence": "[Source: Interview]"}]
    call.assert_awaited_once()
    assert call.await_args.kwargs["system_prompt"] == "rewrite system"
    assert "<failing_items>" in call.await_args.kwargs["user_message"]
