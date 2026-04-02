"""
Unit tests for ResearchRepository — 0% coverage before this file.
All Supabase I/O is mocked via a fake client.
"""
import pytest
from unittest.mock import MagicMock, patch
from services.research.research_repository import ResearchRepository


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_repo(insert_result_data=None, select_result_data=None):
    """Build a ResearchRepository with a fully mocked Supabase client."""
    client = MagicMock()

    insert_result = MagicMock()
    insert_result.data = insert_result_data or []
    insert_chain = MagicMock()
    insert_chain.execute.return_value = insert_result
    client.table.return_value.insert.return_value = insert_chain

    select_result = MagicMock()
    select_result.data = select_result_data or []
    select_chain = MagicMock()
    select_chain.execute.return_value = select_result
    (client.table.return_value
        .select.return_value
        .eq.return_value
        .eq.return_value
        .order.return_value) = select_chain

    with patch("services.research.research_repository.get_supabase_client", return_value=client):
        repo = ResearchRepository()
    repo.client = client
    return repo


# ---------------------------------------------------------------------------
# save_global_ingest
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_save_global_ingest_inserts_all_items():
    repo = _make_repo()
    items = [
        {"title": "Item 1", "type": "feedback", "content": "content1", "tags": ["a"]},
        {"title": "Item 2", "type": "review", "content": "content2", "tags": []},
    ]
    await repo.save_global_ingest("proj-1", items)
    assert repo.client.table.return_value.insert.call_count == 2


@pytest.mark.asyncio
async def test_save_global_ingest_skips_empty_items():
    repo = _make_repo()
    await repo.save_global_ingest("proj-1", [])
    repo.client.table.assert_not_called()


@pytest.mark.asyncio
async def test_save_global_ingest_skips_empty_project_id():
    repo = _make_repo()
    await repo.save_global_ingest("", [{"title": "x"}])
    repo.client.table.assert_not_called()


@pytest.mark.asyncio
async def test_save_global_ingest_falls_back_title_from_content():
    """When title is absent, the first 80 chars of content are used as title."""
    repo = _make_repo()
    items = [{"content": "A" * 100}]  # no title key
    await repo.save_global_ingest("proj-1", items)
    call_kwargs = repo.client.table.return_value.insert.call_args[0][0]
    assert call_kwargs["title"] == "A" * 80


@pytest.mark.asyncio
async def test_save_global_ingest_raises_on_db_error():
    repo = _make_repo()
    repo.client.table.return_value.insert.return_value.execute.side_effect = Exception("DB down")
    with pytest.raises(Exception, match="DB down"):
        await repo.save_global_ingest("proj-1", [{"title": "x", "content": "y"}])


# ---------------------------------------------------------------------------
# get_global_ingest
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_global_ingest_returns_items():
    rows = [
        {"type": "feedback", "title": "T1", "content": "c1", "context_text": "", "tags": [], "created_at": None},
        {"type": "review",   "title": "T2", "content": "c2", "context_text": "", "tags": [], "created_at": None},
    ]
    repo = _make_repo(select_result_data=rows)
    result = await repo.get_global_ingest("proj-1")
    assert len(result) == 2
    assert result[0]["title"] == "T1"


@pytest.mark.asyncio
async def test_get_global_ingest_returns_empty_on_error():
    """get_global_ingest must swallow errors and return []."""
    repo = _make_repo()
    (repo.client.table.return_value
        .select.return_value
        .eq.return_value
        .eq.return_value
        .order.return_value
        .execute.side_effect) = Exception("table not found")

    result = await repo.get_global_ingest("proj-1")
    assert result == []


@pytest.mark.asyncio
async def test_get_global_ingest_returns_empty_list_when_no_rows():
    repo = _make_repo(select_result_data=[])
    result = await repo.get_global_ingest("proj-1")
    assert result == []
