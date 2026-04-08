# services/job_repository.py
#
# Durable job state for pipeline background runs.
# The asyncio.Queue stays in-process for live SSE streaming; this repository
# persists status, result, and error to Supabase so they survive restarts.

from datetime import datetime, timezone, timedelta
from typing import Optional

from services.db.supabase_client import get_supabase_client
from services.db.supabase_async import run_sync, first_row_from_result

TABLE = "jobs"


class JobRepository:
    """
    Persistence layer for background pipeline jobs.
    Always uses the service-role client — jobs are system records, not
    user-owned data requiring RLS enforcement.
    """

    def __init__(self) -> None:
        self.client = get_supabase_client()

    async def create(
        self,
        job_id: str,
        session_id: str,
        user_id: str,
        job_type: str = "pipeline",
    ) -> None:
        """Insert a new job row with status=pending."""
        def _insert():
            return self.client.table(TABLE).insert({
                "id": job_id,
                "session_id": session_id,
                "user_id": user_id,
                "status": "pending",
                "job_type": job_type,
            }).execute()
        await run_sync(_insert)

    async def update_status(
        self,
        job_id: str,
        status: str,
        result: Optional[dict] = None,
        error: Optional[str] = None,
    ) -> None:
        """Update job status (and optionally result/error) by job_id."""
        data: dict = {"status": status, "updated_at": "now()"}
        if result is not None:
            data["result"] = result
        if error is not None:
            data["error"] = error

        def _update():
            return self.client.table(TABLE).update(data).eq("id", job_id).execute()
        await run_sync(_update)

    async def get_by_id(self, job_id: str) -> Optional[dict]:
        """Return the job row dict, or None if not found."""
        def _select():
            return (
                self.client.table(TABLE)
                .select("*")
                .eq("id", job_id)
                .limit(1)
                .execute()
            )
        result = await run_sync(_select)
        return first_row_from_result(result)

    async def mark_stale_as_failed(self, older_than_minutes: int = 10) -> None:
        """
        Mark all 'running' jobs whose updated_at is older than the cutoff as failed.
        Called at startup to clean up jobs interrupted by a prior backend crash.
        """
        cutoff = (
            datetime.now(timezone.utc) - timedelta(minutes=older_than_minutes)
        ).isoformat()

        def _update():
            return (
                self.client.table(TABLE)
                .update({
                    "status": "failed",
                    "error": "Job stale: backend restarted while running",
                    "updated_at": "now()",
                })
                .eq("status", "running")
                .lt("updated_at", cutoff)
                .execute()
            )
        await run_sync(_update)
