import logging
import os
import sys
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../src"))


def _product_context_config() -> dict:
    return {
        "role": "Product strategist",
        "instructions": "Extract product context.",
        "provider": "anthropic",
        "model": "claude-haiku-4-5-20251001",
        "system_prompt": "",
        "token_control": {"retries": 0},
    }


class FakeProductProfilesTable:
    def __init__(self, error: Exception | None = None):
        self.error = error
        self.payload = None
        self.on_conflict = None
        self.executed = False

    def upsert(self, payload, on_conflict=None):
        self.payload = payload
        self.on_conflict = on_conflict
        return self

    def execute(self):
        self.executed = True
        if self.error is not None:
            raise self.error
        return SimpleNamespace(data=[self.payload])


class FakeSupabaseClient:
    def __init__(self, table):
        self.product_profiles_table = table
        self.table_names = []

    def table(self, name):
        self.table_names.append(name)
        assert name == "product_profiles"
        return self.product_profiles_table


@pytest.mark.asyncio
async def test_product_context_execute_async_persists_profile(monkeypatch, caplog):
    from services.agents import base_agent
    from services.agents import product_context_agent
    from services.agents.product_context_agent import ProductContextAgent

    raw_profile = {
        "reasoning": "Context was explicit.",
        "product_name": "SpecFlow",
        "product_description": "AI-assisted product workflow.",
        "target_user": "B2B product managers",
        "core_workflow": "Research to PRD",
        "constraints": "Small team",
        "competitors": "Spreadsheets",
        "goals": "Faster planning",
        "raw_summary": "SpecFlow helps PMs turn research into plans.",
    }
    call = AsyncMock(return_value=str(raw_profile).replace("'", '"'))
    table = FakeProductProfilesTable()

    monkeypatch.setattr(base_agent, "call_llm", call)
    monkeypatch.setattr(
        product_context_agent,
        "get_supabase_client",
        lambda: FakeSupabaseClient(table),
    )

    agent = ProductContextAgent("product_context", _product_context_config())
    with caplog.at_level(logging.INFO, logger="services.agents.product_context_agent"):
        result = await agent.execute_async(
            "Extract context",
            context={"product_context": {}, "ingest": []},
            session={"id": "session-1", "user_id": "user-1"},
        )

    assert result["product_name"] == "SpecFlow"
    assert table.on_conflict == "user_id,product_name"
    assert table.payload == {
        "user_id": "user-1",
        "product_name": "SpecFlow",
        "product_description": "AI-assisted product workflow.",
        "target_user": "B2B product managers",
        "core_workflow": "Research to PRD",
        "constraints": "Small team",
        "competitors": "Spreadsheets",
        "goals": "Faster planning",
        "raw_summary": "SpecFlow helps PMs turn research into plans.",
        "updated_at": "now()",
    }
    assert table.executed is True
    assert "[ProductContextAgent] persisted product_profile for session session-1" in caplog.text


@pytest.mark.asyncio
async def test_product_context_persistence_failure_is_logged_not_raised(monkeypatch, caplog):
    from services.agents import base_agent
    from services.agents import product_context_agent
    from services.agents.product_context_agent import ProductContextAgent

    call = AsyncMock(return_value='{"product_name": "SpecFlow", "product_description": "Desc"}')
    table = FakeProductProfilesTable(error=RuntimeError("database offline"))

    monkeypatch.setattr(base_agent, "call_llm", call)
    monkeypatch.setattr(
        product_context_agent,
        "get_supabase_client",
        lambda: FakeSupabaseClient(table),
    )

    agent = ProductContextAgent("product_context", _product_context_config())
    with caplog.at_level(logging.ERROR, logger="services.agents.product_context_agent"):
        result = await agent.execute_async(
            "Extract context",
            context={"product_context": {}, "ingest": []},
            session={"id": "session-1", "user_id": "user-1"},
        )

    assert result["product_name"] == "SpecFlow"
    assert "Failed to persist product profile" in caplog.text


@pytest.mark.asyncio
async def test_product_context_persistence_skips_without_user_id(monkeypatch, caplog):
    from services.agents import base_agent
    from services.agents import product_context_agent
    from services.agents.product_context_agent import ProductContextAgent

    call = AsyncMock(return_value='{"product_name": "SpecFlow", "product_description": "Desc"}')
    get_client = AsyncMock()

    monkeypatch.setattr(base_agent, "call_llm", call)
    monkeypatch.setattr(product_context_agent, "get_supabase_client", get_client)

    agent = ProductContextAgent("product_context", _product_context_config())
    with caplog.at_level(logging.DEBUG, logger="services.agents.product_context_agent"):
        result = await agent.execute_async(
            "Extract context",
            context={"product_context": {}, "ingest": []},
            session={"id": "session-1"},
        )

    assert result["product_name"] == "SpecFlow"
    assert get_client.await_count == 0
    assert "Skipping product profile persistence" in caplog.text


@pytest.mark.asyncio
async def test_product_context_persistence_skips_without_product_name(monkeypatch, caplog):
    from services.agents import base_agent
    from services.agents import product_context_agent
    from services.agents.product_context_agent import ProductContextAgent

    call = AsyncMock(return_value='{"product_description": "Desc"}')
    get_client = AsyncMock()

    monkeypatch.setattr(base_agent, "call_llm", call)
    monkeypatch.setattr(product_context_agent, "get_supabase_client", get_client)

    agent = ProductContextAgent("product_context", _product_context_config())
    with caplog.at_level(logging.DEBUG, logger="services.agents.product_context_agent"):
        result = await agent.execute_async(
            "Extract context",
            context={"product_context": {}, "ingest": []},
            session={"id": "session-1", "user_id": "user-1"},
        )

    assert result == {"product_description": "Desc"}
    assert get_client.await_count == 0
    assert "Skipping product profile persistence" in caplog.text
