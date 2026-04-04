# services/rag/retrieval_service.py

import logging
from typing import Optional

from services.db.supabase_async import rows_from_result, run_sync
from services.db.supabase_client import get_supabase_client
from services.rag.embedding_service import get_embedding_service

logger = logging.getLogger("specflow.rag")


def _unwrap(val):
    """Unwrap {"data": [...]} persistence envelope."""
    if isinstance(val, dict) and list(val.keys()) == ["data"]:
        return val["data"]
    return val


def _titles(items: list) -> str:
    """Join title fields from a list of dicts into a single query string."""
    return " ".join(
        item.get("title", "") for item in items if item.get("title")
    )


class RetrievalService:
    def __init__(self, client=None):
        self._client = client or get_supabase_client()

    async def retrieve(
        self,
        query: str,
        user_id: str = None,
        session_id: str = None,
        top_k: int = 8,
        threshold: float = 0.3,
    ) -> list[dict]:
        """Find the top-k research entries most similar to query.

        Returns list of dicts with keys: id, title, content, type,
        context_text, tags, similarity. Never raises — returns [] on error.
        """
        try:
            embedding = await get_embedding_service().embed_text(query)

            def _rpc():
                return self._client.rpc(
                    "match_research_entries",
                    {
                        "query_embedding": embedding,
                        "match_threshold": threshold,
                        "match_count": top_k,
                        "filter_user_id": user_id,
                        "filter_session_id": session_id,
                    },
                ).execute()

            result = await run_sync(_rpc)
            rows = rows_from_result(result)
            return [
                {
                    "id": r.get("id"),
                    "title": r.get("title"),
                    "content": r.get("content"),
                    "type": r.get("type"),
                    "context_text": r.get("context_text"),
                    "tags": r.get("tags"),
                    "similarity": r.get("similarity"),
                }
                for r in rows
            ]
        except Exception as e:
            logger.warning(
                "retrieve failed for query %r (user=%s session=%s): %s",
                query[:80],
                user_id,
                session_id,
                e,
            )
            return []

    async def retrieve_for_step(
        self,
        step_name: str,
        context: dict,
        user_id: str = None,
        session_id: str = None,
    ) -> list[dict]:
        """Build a step-specific query and return relevant research entries.

        step_name must be one of: problems, features, decompose, tasks.
        Falls back to a generic context stringify for unknown steps.
        """
        ctx = context or {}

        if step_name == "problems":
            pc = _unwrap(ctx.get("product_context") or {})
            parts = [
                pc.get("product_description", ""),
                pc.get("goals", ""),
            ]
            query = " ".join(p for p in parts if p)

        elif step_name == "features":
            problems = _unwrap(ctx.get("problems") or [])
            query = _titles(problems)

        elif step_name == "decompose":
            features = _unwrap(ctx.get("features") or [])
            query = _titles(features)

        elif step_name == "tasks":
            decompositions = _unwrap(ctx.get("decompositions") or [])
            query = _titles(decompositions)

        else:
            query = str(ctx)[:500]

        return await self.retrieve(query, user_id=user_id, session_id=session_id)
