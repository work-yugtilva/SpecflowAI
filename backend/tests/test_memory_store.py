"""
Unit tests for MemoryStore — in-memory KV store used per pipeline run.
All tests are self-contained; no external dependencies.
"""
import pytest
from services.memory.memory_store import MemoryStore


@pytest.mark.asyncio
async def test_set_and_get():
    store = MemoryStore()
    await store.set("problems", [1, 2, 3])
    result = await store.get("problems")
    assert result == [1, 2, 3]


@pytest.mark.asyncio
async def test_get_default_when_missing():
    store = MemoryStore()
    result = await store.get("nonexistent", default="fallback")
    assert result == "fallback"


@pytest.mark.asyncio
async def test_get_returns_none_default():
    store = MemoryStore()
    result = await store.get("missing")
    assert result is None


@pytest.mark.asyncio
async def test_get_returns_deep_copy():
    """Mutations to the returned value must not affect the store."""
    store = MemoryStore()
    await store.set("key", [1, 2])
    result = await store.get("key")
    result.append(99)
    stored = await store.get("key")
    assert stored == [1, 2]


@pytest.mark.asyncio
async def test_add_creates_new_key():
    store = MemoryStore()
    await store.add("k", "v1")
    assert await store.get("k") == "v1"


@pytest.mark.asyncio
async def test_add_appends_to_list():
    store = MemoryStore()
    await store.set("items", [1, 2])
    await store.add("items", 3)
    assert await store.get("items") == [1, 2, 3]


@pytest.mark.asyncio
async def test_add_converts_scalar_to_list():
    store = MemoryStore()
    await store.set("key", "first")
    await store.add("key", "second")
    assert await store.get("key") == ["first", "second"]


@pytest.mark.asyncio
async def test_has_returns_true_for_existing():
    store = MemoryStore()
    await store.set("x", 42)
    assert await store.has("x") is True


@pytest.mark.asyncio
async def test_has_returns_false_for_missing():
    store = MemoryStore()
    assert await store.has("missing") is False


@pytest.mark.asyncio
async def test_keys_returns_all_keys():
    store = MemoryStore()
    await store.set("a", 1)
    await store.set("b", 2)
    result = await store.keys()
    assert set(result) == {"a", "b"}


@pytest.mark.asyncio
async def test_get_many_returns_subset():
    store = MemoryStore()
    await store.set("a", 1)
    await store.set("b", 2)
    await store.set("c", 3)
    result = await store.get_many(["a", "c"])
    assert result == {"a": 1, "c": 3}


@pytest.mark.asyncio
async def test_get_many_skips_missing_keys():
    store = MemoryStore()
    await store.set("a", 1)
    result = await store.get_many(["a", "missing"])
    assert result == {"a": 1}


@pytest.mark.asyncio
async def test_export_returns_full_copy():
    store = MemoryStore()
    await store.set("x", {"nested": True})
    exported = await store.export()
    assert exported == {"x": {"nested": True}}
    # Mutate the export — store must not change
    exported["x"]["nested"] = False
    re_exported = await store.export()
    assert re_exported["x"]["nested"] is True


@pytest.mark.asyncio
async def test_clear_empties_store():
    store = MemoryStore()
    await store.set("a", 1)
    await store.clear()
    assert await store.keys() == []
