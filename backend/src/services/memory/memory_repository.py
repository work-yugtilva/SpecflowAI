# services/memory/memory_repository.py

import asyncio
from typing import Any, List, Optional
from services.db.supabase_client import get_supabase_client
from services.memory.memory_schemas import MemoryEntry

TABLE = "memory_entries"


class MemoryRepository:
    """
    Persistence layer for memory entries.
    Uses Supabase Python client for CRUD operations.
    All queries are dynamic — no hardcoded keys or agent names.
    """

    def __init__(self):
        self.client = get_supabase_client()

    def _run_sync(self, fn):
        """Wrap synchronous supabase-py calls for async interface."""
        loop = asyncio.get_event_loop()
        return loop.run_in_executor(None, fn)

    async def save(self, entry: MemoryEntry) -> MemoryEntry:
        """
        Upsert a memory entry. Uses (project_id, memory_key) as
        the conflict target — no duplicate rows per project+key.
        """
        data = entry.model_dump(
            exclude_none=True,
            exclude={"created_at", "updated_at"},
        )

        def _upsert():
            return self.client.table(TABLE).upsert(
                data, on_conflict="project_id,memory_key"
            ).execute()

        result = await self._run_sync(_upsert)

        if result.data:
            return MemoryEntry(**result.data[0])
        return entry

    async def get_by_project(self, project_id: str) -> List[MemoryEntry]:
        """Get all memory entries for a project."""

        def _select():
            return (
                self.client.table(TABLE)
                .select("*")
                .eq("project_id", project_id)
                .order("created_at", desc=False)
                .execute()
            )

        result = await self._run_sync(_select)
        return [MemoryEntry(**row) for row in (result.data or [])]

    async def get_by_key(
        self, project_id: str, key: str
    ) -> Optional[MemoryEntry]:
        """Get a single memory entry by project and key."""

        def _select():
            return (
                self.client.table(TABLE)
                .select("*")
                .eq("project_id", project_id)
                .eq("memory_key", key)
                .maybe_single()
                .execute()
            )

        result = await self._run_sync(_select)

        if result.data:
            return MemoryEntry(**result.data)
        return None

    async def append_to_key(
        self,
        project_id: str,
        key: str,
        value: Any,
        agent_name: str,
    ) -> MemoryEntry:
        """
        Append a value to an existing memory entry's content.
        If the entry doesn't exist, create it.
        """
        existing = await self.get_by_key(project_id, key)

        if existing is None:
            entry = MemoryEntry(
                project_id=project_id,
                agent_name=agent_name,
                memory_key=key,
                content={"data": value} if not isinstance(value, dict) else value,
            )
            return await self.save(entry)

        content = existing.content
        if isinstance(content, dict) and "items" in content and isinstance(content["items"], list):
            content["items"].append(value)
        elif isinstance(content, dict) and isinstance(value, dict):
            content.update(value)
        else:
            content = {"items": [content, value]} if content else {"items": [value]}

        existing.content = content
        existing.agent_name = agent_name
        return await self.save(existing)

    async def delete_by_project(self, project_id: str) -> None:
        """Delete all memory entries for a project."""

        def _delete():
            return (
                self.client.table(TABLE)
                .delete()
                .eq("project_id", project_id)
                .execute()
            )

        await self._run_sync(_delete)

    async def delete_by_key(self, project_id: str, key: str) -> None:
        """Delete a specific memory entry."""

        def _delete():
            return (
                self.client.table(TABLE)
                .delete()
                .eq("project_id", project_id)
                .eq("memory_key", key)
                .execute()
            )

        await self._run_sync(_delete)
