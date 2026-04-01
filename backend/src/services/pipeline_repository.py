from datetime import datetime, timezone
from typing import List, Optional

from services.db.supabase_async import first_row_from_result, rows_from_result, run_sync
from services.db.supabase_client import get_supabase_client
from services.db.models.pipeline import PipelineRun

PIPELINES_TABLE = "pipelines"


def _is_missing_user_id_column_error(error: Exception) -> bool:
    message = str(error)
    return (
        "PGRST204" in message
        and "'user_id' column" in message
        and f"'{PIPELINES_TABLE}'" in message
    )


class PipelineRepository:
    """Persistence layer for the pipelines table."""

    def __init__(self, client=None):
        self.client = client or get_supabase_client()

    @staticmethod
    def _without_user_id(data: dict) -> dict:
        if "user_id" not in data:
            return data
        sanitized = dict(data)
        sanitized.pop("user_id", None)
        return sanitized

    async def create(self, run: PipelineRun) -> PipelineRun:
        data = run.model_dump(
            exclude_none=True,
            exclude={"id", "created_at", "updated_at"},
        )

        def _insert():
            return self.client.table(PIPELINES_TABLE).insert(data).execute()
        try:
            result = await run_sync(_insert)
        except Exception as exc:
            if not _is_missing_user_id_column_error(exc):
                raise

            fallback_data = self._without_user_id(data)

            def _fallback_insert():
                return self.client.table(PIPELINES_TABLE).insert(fallback_data).execute()

            result = await run_sync(_fallback_insert)
        rows = rows_from_result(result)
        if rows:
            return PipelineRun(**rows[0])
        return run

    async def get(self, pipeline_id: str) -> Optional[PipelineRun]:
        def _select():
            return (
                self.client.table(PIPELINES_TABLE)
                .select("*")
                .eq("id", pipeline_id)
                .maybe_single()
                .execute()
            )

        result = await run_sync(_select)
        row = first_row_from_result(result)
        return PipelineRun(**row) if row else None

    async def update(self, pipeline_id: str, **fields) -> None:
        now = datetime.now(timezone.utc).isoformat()
        fields["updated_at"] = now

        def _update():
            return (
                self.client.table(PIPELINES_TABLE)
                .update(fields)
                .eq("id", pipeline_id)
                .execute()
            )
        try:
            await run_sync(_update)
        except Exception as exc:
            if not _is_missing_user_id_column_error(exc):
                raise

            fallback_fields = self._without_user_id(fields)

            def _fallback_update():
                return (
                    self.client.table(PIPELINES_TABLE)
                    .update(fallback_fields)
                    .eq("id", pipeline_id)
                    .execute()
                )

            await run_sync(_fallback_update)

    async def attach_to_session(self, pipeline_id: str, session_id: str) -> None:
        """Attach an orphaned pipeline run to a session."""
        await self.update(pipeline_id, session_id=session_id, status="completed")

    async def list_orphaned(self) -> List[PipelineRun]:
        def _select():
            return (
                self.client.table(PIPELINES_TABLE)
                .select("*")
                .is_("session_id", "null")
                .order("created_at", desc=True)
                .execute()
            )

        result = await run_sync(_select)
        return [PipelineRun(**row) for row in rows_from_result(result)]

    async def list_by_session(self, session_id: str) -> List[PipelineRun]:
        def _select():
            return (
                self.client.table(PIPELINES_TABLE)
                .select("*")
                .eq("session_id", session_id)
                .order("created_at", desc=True)
                .execute()
            )

        result = await run_sync(_select)
        return [PipelineRun(**row) for row in rows_from_result(result)]
