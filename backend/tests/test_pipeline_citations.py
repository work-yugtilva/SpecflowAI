"""Tests for citation metadata wiring in pipeline RAG enrichment."""
import pytest
from unittest.mock import AsyncMock, MagicMock


def _make_pipeline():
    """Return a minimal Pipeline instance with mocked retrieval service."""
    from services.pipeline import Pipeline
    runner = Pipeline.__new__(Pipeline)
    runner._retrieval_service = MagicMock()
    return runner


@pytest.mark.asyncio
async def test_enrich_context_includes_id_in_rag_context():
    """rag_context entries must expose the research_entry id so the LLM
    can populate source_ids."""
    runner = _make_pipeline()

    fake_results = [
        {
            "id": "aaaaaaaa-0000-0000-0000-000000000001",
            "title": "User interview 1",
            "content": "Users struggle with X.",
            "type": "ingest",
            "context_text": "",
            "tags": [],
            "similarity": 0.87,
        }
    ]
    runner._retrieval_service.retrieve_for_step = AsyncMock(return_value=fake_results)

    result = await runner._enrich_context_with_rag(
        step_name="problems",
        context={"product_context": {"product_description": "test"}},
        user_id="user-1",
        session_id="session-1",
    )

    rag_context = result.get("rag_context", [])
    assert len(rag_context) == 1, "Should have one rag_context entry"
    entry = rag_context[0]
    assert "id" in entry, (
        "rag_context entry must include 'id' so LLM can reference it in source_ids"
    )
    assert entry["id"] == "aaaaaaaa-0000-0000-0000-000000000001"


@pytest.mark.asyncio
async def test_enrich_context_rag_entry_has_expected_fields():
    """Each rag_context entry must contain id, title, content, source, relevance."""
    runner = _make_pipeline()

    fake_results = [
        {
            "id": "bbbbbbbb-0000-0000-0000-000000000002",
            "title": "Survey result",
            "content": "50% of respondents said Y.",
            "type": "survey",
            "context_text": "",
            "tags": [],
            "similarity": 0.72,
        }
    ]
    runner._retrieval_service.retrieve_for_step = AsyncMock(return_value=fake_results)

    result = await runner._enrich_context_with_rag(
        step_name="features",
        context={},
        user_id="user-1",
        session_id="session-1",
    )

    entry = result["rag_context"][0]
    assert entry["id"] == "bbbbbbbb-0000-0000-0000-000000000002"
    assert entry["title"] == "Survey result"
    assert entry["content"] == "50% of respondents said Y."
    assert entry["source"] == "survey"
    assert entry["relevance"] == 0.72
