# services/memory/memory_store.py

import asyncio
import copy
from typing import Any, Dict, List, Optional


class MemoryStore:
    """
    In-memory key-value store for a single pipeline run.
    Thread-safe via asyncio.Lock for parallel agent steps.
    NO hardcoded keys — purely generic KV store.
    """

    def __init__(self):
        self._store: Dict[str, Any] = {}
        self._lock = asyncio.Lock()

    async def add(self, key: str, value: Any) -> None:
        """Add value to a key. If key exists and holds a list, append.
        If key exists and is not a list, convert to list and append.
        If key does not exist, set it."""
        async with self._lock:
            if key in self._store:
                existing = self._store[key]
                if isinstance(existing, list):
                    existing.append(value)
                else:
                    self._store[key] = [existing, value]
            else:
                self._store[key] = value

    async def set(self, key: str, value: Any) -> None:
        """Set (overwrite) value for a key."""
        async with self._lock:
            self._store[key] = value

    async def get(self, key: str, default: Any = None) -> Any:
        """Get value by key. Returns deep copy to prevent mutation."""
        async with self._lock:
            value = self._store.get(key, default)
            return copy.deepcopy(value)

    async def get_many(self, keys: List[str]) -> Dict[str, Any]:
        """Get multiple keys at once. Returns deep copies."""
        async with self._lock:
            return {
                k: copy.deepcopy(self._store[k])
                for k in keys
                if k in self._store
            }

    async def has(self, key: str) -> bool:
        """Check if a key exists in the store."""
        async with self._lock:
            return key in self._store

    async def keys(self) -> List[str]:
        """Return all keys currently in the store."""
        async with self._lock:
            return list(self._store.keys())

    async def export(self) -> Dict[str, Any]:
        """Export full store contents. Returns deep copy."""
        async with self._lock:
            return copy.deepcopy(self._store)

    async def clear(self) -> None:
        """Clear the entire store."""
        async with self._lock:
            self._store.clear()
