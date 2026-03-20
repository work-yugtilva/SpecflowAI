# helpers for running sync supabase-py calls from async FastAPI handlers

import asyncio
import logging
import sys
from typing import Any, Callable, List, Optional, TypeVar

logger = logging.getLogger("specflow.supabase_async")

T = TypeVar("T")


async def run_sync(fn: Callable[[], T]) -> T:
    """Run a blocking Supabase call in a thread pool (avoids deprecated get_event_loop())."""
    if sys.version_info >= (3, 9):
        return await asyncio.to_thread(fn)
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, fn)


def rows_from_result(result: Any) -> List[dict]:
    """
    Normalize postgrest execute() return value to a list of row dicts.
    Handles None results, missing .data, list vs single dict (maybe_single).
    """
    if result is None:
        logger.debug("Supabase execute() returned None")
        return []
    data = getattr(result, "data", None)
    if data is None:
        return []
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return [data]
    return []


def first_row_from_result(result: Any) -> Optional[dict]:
    rows = rows_from_result(result)
    return rows[0] if rows else None
