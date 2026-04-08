# services/research/research_repository.py

import logging
from typing import Any, List
from services.db.supabase_async import rows_from_result, run_sync
from services.db.supabase_client import get_supabase_client

logger = logging.getLogger("specflow.research")

TABLE = "research_entries"
PIPELINE_USER_ID = "pipeline"  # sentinel for system-generated entries


class ResearchRepository:
    """
    Persistence layer for research entries (global project-scoped ingest).
    Stores ingest items with scope='global' and scope_key=project_id.
    """

    def __init__(self):
        self.client = get_supabase_client()

    async def save_global_ingest(self, project_id: str, items: List[Any]) -> None:
        """
        Insert ingest items as global research entries.
        Called once per session (only on first run when last_completed is None).
        """
        if not items or not project_id:
            return

        for idx, item in enumerate(items):
            try:
                # Extract fields from ingest item; provide sensible defaults
                title = item.get("title", "")
                if not title:
                    # Fallback: truncate content or stringified item
                    content_str = str(item.get("content", str(item)))
                    title = content_str[:80]

                # Capture all variables for closure
                item_type = item.get("type", "ingest")
                item_content = item.get("content", str(item))
                item_user_label = item.get("user_label", "")
                item_pain_point = item.get("pain_point", "")
                item_context_text = item.get("context_text", "")
                item_tags = item.get("tags", [])

                def _upsert():
                    return self.client.table(TABLE).upsert({
                        "user_id": PIPELINE_USER_ID,
                        "scope": "global",
                        "scope_key": project_id,
                        "type": item_type,
                        "title": title,
                        "content": item_content,
                        "user_label": item_user_label,
                        "pain_point": item_pain_point,
                        "context_text": item_context_text,
                        "tags": item_tags,
                        "updated_at": "now()",
                    }, on_conflict="scope_key,title,type").execute()

                await run_sync(_upsert)
                logger.debug(f"Saved ingest item {idx+1}/{len(items)} for project {project_id}")
            except Exception as e:
                logger.error(f"Failed to save ingest item {idx+1} for project {project_id}: {e}", exc_info=True)
                raise

    async def get_global_ingest(self, project_id: str) -> List[dict]:
        """
        Fetch all global ingest entries for a project, oldest-first.
        Returns list of {type, title, content, context_text, tags, created_at}.
        Returns empty list if table doesn't exist or query fails.
        """
        try:
            def _select():
                return (
                    self.client.table(TABLE)
                    .select("type,title,content,context_text,tags,created_at")
                    .eq("scope", "global")
                    .eq("scope_key", project_id)
                    .order("created_at", desc=False)
                    .execute()
                )

            result = await run_sync(_select)
            items = rows_from_result(result)
            logger.debug(f"Loaded {len(items)} global ingest items for project {project_id}")
            return items
        except Exception as e:
            logger.warning(f"Failed to fetch global ingest for project {project_id}: {e}")
            # Return empty list on error to avoid breaking the pipeline
            return []
