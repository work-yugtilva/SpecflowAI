# services/rag/embedding_service.py

import asyncio
import logging
import os
from typing import Optional

from openai import AsyncOpenAI

from services.db.supabase_async import run_sync
from services.db.supabase_client import get_supabase_client

logger = logging.getLogger("specflow.rag")

_EMBED_MODEL = "text-embedding-3-small"
_MAX_CHARS = 8000
_BATCH_CONCURRENCY = 10


class EmbeddingService:
    def __init__(self):
        self._openai = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])

    async def embed_text(self, text: str) -> list[float]:
        """Embed text, truncating to _MAX_CHARS. Returns the embedding vector."""
        response = await self._openai.embeddings.create(
            model=_EMBED_MODEL,
            input=text[:_MAX_CHARS],
        )
        return response.data[0].embedding

    async def embed_and_store(
        self, entry_id: str, title: str, content: str, client=None
    ) -> bool:
        """Generate embedding for title+content and upsert into research_entries.

        Never raises — logs errors and returns False on failure.
        """
        try:
            embedding = await self.embed_text(title + " " + content)
            db = client or get_supabase_client()

            def _update():
                return (
                    db.table("research_entries")
                    .update({"embedding": embedding})
                    .eq("id", entry_id)
                    .execute()
                )

            await run_sync(_update)
            return True
        except Exception as e:
            logger.error(
                "embed_and_store failed for entry %s: %s", entry_id, e, exc_info=True
            )
            return False

    async def embed_batch(self, entries: list[dict], client=None) -> int:
        """Embed and store a batch of entries concurrently (max 10 at a time).

        Each entry must have keys: id, title, content.
        Returns count of successfully embedded entries.
        """
        sem = asyncio.Semaphore(_BATCH_CONCURRENCY)

        async def _one(entry: dict) -> bool:
            async with sem:
                return await self.embed_and_store(
                    entry["id"], entry["title"], entry["content"], client=client
                )

        results = await asyncio.gather(*[_one(e) for e in entries])
        return sum(1 for r in results if r)


_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """Return the module-level singleton EmbeddingService, creating it on first call."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
