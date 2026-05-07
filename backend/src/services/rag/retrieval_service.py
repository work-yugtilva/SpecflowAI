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
        threshold: float = 0.5,
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
        ctx = context or {}

        def _item_text(item: dict, fields: list[str]) -> str:
            parts = []
            for f in fields:
                val = item.get(f)
                if isinstance(val, str) and val.strip():
                    parts.append(val.strip())
                elif isinstance(val, list):
                    parts.extend(str(v) for v in val if v)
            return " ".join(parts)

        if step_name == "problems":
            pc = _unwrap(ctx.get("product_context") or {})
            parts = [
                pc.get("product_description", ""),
                pc.get("goals", ""),
                pc.get("target_users", ""),
            ]
            query = " ".join(p for p in parts if p)

        elif step_name == "features":
            problems = _unwrap(ctx.get("problems") or [])
            query = " ".join(
                _item_text(p, ["title", "description", "research_evidence"])
                for p in problems[:5]
                if isinstance(p, dict)
            )

        elif step_name == "decompose":
            features = _unwrap(ctx.get("features") or [])
            query = " ".join(
                _item_text(f, ["title", "description", "acceptance_criteria"])
                for f in features[:5]
                if isinstance(f, dict)
            )

        elif step_name == "tasks":
            decomps = _unwrap(ctx.get("decompose") or ctx.get("decompositions") or [])
            query = " ".join(
                _item_text(d, ["title", "description", "user_problem_it_solves"])
                for d in decomps[:5]
                if isinstance(d, dict)
            )

        else:
            query = str(ctx)[:500]

        query = query.strip()[:1000]  # cap at 1000 chars before embedding
        if not query:
            return []

        return await self.retrieve(
            query,
            user_id=user_id,
            session_id=session_id,
            threshold=0.5,  # raised from 0.3 — reduces noise
        )
