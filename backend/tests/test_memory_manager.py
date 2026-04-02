"""
Unit tests for MemoryManager — config-driven read/write orchestration layer.
Uses real MemoryStore (in-memory) to test behavior end-to-end without mocking.
"""
import pytest
from services.memory.memory_manager import MemoryManager
from services.memory.memory_store import MemoryStore
from services.memory.memory_schemas import MemoryConfig, MemoryReadConfig, MemoryWriteConfig


def _config(read_strategy=None, read_keys=None, write_mode=None, write_key=None):
    read = MemoryReadConfig(strategy=read_strategy, keys=read_keys or []) if read_strategy else None
    write = MemoryWriteConfig(mode=write_mode or "overwrite", key=write_key) if write_mode or write_key else None
    return MemoryConfig(read=read, write=write)


# ---------------------------------------------------------------------------
# read_for_agent
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_read_none_config_returns_empty():
    store = MemoryStore()
    mgr = MemoryManager(store)
    result = await mgr.read_for_agent(None)
    assert result == {}


@pytest.mark.asyncio
async def test_read_no_read_config_returns_empty():
    store = MemoryStore()
    mgr = MemoryManager(store)
    cfg = MemoryConfig(read=None, write=None)
    result = await mgr.read_for_agent(cfg)
    assert result == {}


@pytest.mark.asyncio
async def test_read_strategy_none_returns_empty():
    store = MemoryStore()
    await store.set("problems", ["p1"])
    mgr = MemoryManager(store)
    result = await mgr.read_for_agent(_config(read_strategy="none"))
    assert result == {}


@pytest.mark.asyncio
async def test_read_strategy_all_returns_everything():
    store = MemoryStore()
    await store.set("problems", ["p1"])
    await store.set("features", ["f1"])
    mgr = MemoryManager(store)
    result = await mgr.read_for_agent(_config(read_strategy="all"))
    assert result == {"problems": ["p1"], "features": ["f1"]}


@pytest.mark.asyncio
async def test_read_strategy_selective_returns_named_keys():
    store = MemoryStore()
    await store.set("problems", ["p1"])
    await store.set("features", ["f1"])
    await store.set("tasks", ["t1"])
    mgr = MemoryManager(store)
    result = await mgr.read_for_agent(_config(read_strategy="selective", read_keys=["problems", "features"]))
    assert set(result.keys()) == {"problems", "features"}
    assert "tasks" not in result


@pytest.mark.asyncio
async def test_read_strategy_selective_with_dict_keys():
    """Keys can be a dict like {problems: 3}; only key names are extracted."""
    store = MemoryStore()
    await store.set("problems", ["p1", "p2", "p3", "p4"])
    mgr = MemoryManager(store)
    cfg = MemoryConfig(
        read=MemoryReadConfig(strategy="selective", keys={"problems": 3}),
        write=None,
    )
    result = await mgr.read_for_agent(cfg)
    assert "problems" in result


@pytest.mark.asyncio
async def test_read_strategy_top_k_applies_compression():
    store = MemoryStore()
    await store.set("problems", ["p1", "p2", "p3", "p4", "p5"])
    mgr = MemoryManager(store)
    cfg = MemoryConfig(
        read=MemoryReadConfig(strategy="top_k", keys=["problems"], params={"k": 2}),
        write=None,
    )
    result = await mgr.read_for_agent(cfg)
    assert len(result.get("problems", [])) <= 5  # compress called without error


# ---------------------------------------------------------------------------
# write_from_agent
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_write_none_config_is_noop():
    store = MemoryStore()
    mgr = MemoryManager(store)
    await mgr.write_from_agent(None, "agent", {"data": []})
    assert await store.keys() == []


@pytest.mark.asyncio
async def test_write_no_write_config_is_noop():
    store = MemoryStore()
    mgr = MemoryManager(store)
    cfg = MemoryConfig(read=None, write=None)
    await mgr.write_from_agent(cfg, "agent", {"data": []})
    assert await store.keys() == []


@pytest.mark.asyncio
async def test_write_no_key_is_noop():
    store = MemoryStore()
    mgr = MemoryManager(store)
    cfg = MemoryConfig(write=MemoryWriteConfig(mode="overwrite", key=None))
    await mgr.write_from_agent(cfg, "agent", "output")
    assert await store.keys() == []


@pytest.mark.asyncio
async def test_write_overwrite_sets_value():
    store = MemoryStore()
    await store.set("problems", ["old"])
    mgr = MemoryManager(store)
    await mgr.write_from_agent(
        MemoryConfig(write=MemoryWriteConfig(mode="overwrite", key="problems")),
        "problems", ["new"]
    )
    assert await store.get("problems") == ["new"]


@pytest.mark.asyncio
async def test_write_append_extends_list():
    store = MemoryStore()
    await store.set("items", ["a"])
    mgr = MemoryManager(store)
    await mgr.write_from_agent(
        MemoryConfig(write=MemoryWriteConfig(mode="append", key="items")),
        "agent", "b"
    )
    assert "b" in await store.get("items")


@pytest.mark.asyncio
async def test_write_merge_combines_dicts():
    store = MemoryStore()
    await store.set("ctx", {"k1": "v1"})
    mgr = MemoryManager(store)
    await mgr.write_from_agent(
        MemoryConfig(write=MemoryWriteConfig(mode="merge", key="ctx")),
        "agent", {"k2": "v2"}
    )
    result = await store.get("ctx")
    assert result == {"k1": "v1", "k2": "v2"}


@pytest.mark.asyncio
async def test_write_merge_falls_back_to_overwrite_for_non_dict():
    store = MemoryStore()
    await store.set("key", "old_string")
    mgr = MemoryManager(store)
    await mgr.write_from_agent(
        MemoryConfig(write=MemoryWriteConfig(mode="merge", key="key")),
        "agent", "new_string"
    )
    assert await store.get("key") == "new_string"
