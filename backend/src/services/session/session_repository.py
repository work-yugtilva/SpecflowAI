from datetime import datetime, timezone
from typing import List, Optional

from services.db.supabase_async import first_row_from_result, rows_from_result, run_sync
from services.db.supabase_client import get_supabase_client
from services.db.models.session import Session, SessionEvent, SessionState

SESSIONS_TABLE = "sessions"
SESSION_STATE_TABLE = "session_state"
SESSION_EVENTS_TABLE = "session_events"


class SessionRepository:
    """
    Persistence layer for session, session_state, and session_events tables.
    Follows the same pattern as MemoryRepository: sync Supabase calls
    wrapped in run_sync (thread pool).
    """

    def __init__(self, client=None):
        self.client = client or get_supabase_client()

    # -------------------------------------------------------------------------
    # sessions table
    # -------------------------------------------------------------------------

    async def create_session(self, session: Session) -> Session:
        """
        INSERT a new session row. Does NOT pass id — lets the DB generate a UUID.
        Returns the created Session with the DB-assigned id.
        """
        data = session.model_dump(
            exclude_none=True,
            exclude={"id", "created_at", "updated_at"},
        )

        def _insert():
            return self.client.table(SESSIONS_TABLE).insert(data).execute()

        result = await run_sync(_insert)
        rows = rows_from_result(result)
        if rows:
            return Session(**rows[0])
        return session

    async def list_sessions(self) -> List[Session]:
        """SELECT all sessions ordered by created_at DESC."""

        def _select():
            return (
                self.client.table(SESSIONS_TABLE)
                .select("*")
                .order("created_at", desc=True)
                .execute()
            )

        result = await run_sync(_select)
        return [Session(**row) for row in rows_from_result(result)]

    async def get_session(self, session_id: str) -> Optional[Session]:
        """SELECT a session by id. Returns None if not found."""

        def _select():
            return (
                self.client.table(SESSIONS_TABLE)
                .select("*")
                .eq("id", session_id)
                .maybe_single()
                .execute()
            )

        result = await run_sync(_select)
        row = first_row_from_result(result)
        if row is None:
            return None
        return Session(**row)

    async def update_session_status(self, session_id: str, status: str) -> None:
        """UPDATE sessions SET status = ?, updated_at = NOW() WHERE id = ?."""
        now = datetime.now(timezone.utc).isoformat()

        def _update():
            return (
                self.client.table(SESSIONS_TABLE)
                .update({"status": status, "updated_at": now})
                .eq("id", session_id)
                .execute()
            )

        await run_sync(_update)

    # -------------------------------------------------------------------------
    # session_state table (one row per session, upserted)
    # -------------------------------------------------------------------------

    async def get_state(self, session_id: str) -> Optional[SessionState]:
        """SELECT session state row for the given session. Returns None if first run."""

        def _select():
            return (
                self.client.table(SESSION_STATE_TABLE)
                .select("*")
                .eq("session_id", session_id)
                .maybe_single()
                .execute()
            )

        result = await run_sync(_select)
        row = first_row_from_result(result)
        if row is None:
            return None
        return SessionState(**row)

    async def upsert_state(self, session_state: SessionState) -> SessionState:
        """
        INSERT or UPDATE the session state row for this session.
        The unique index on session_id means this is always one row per session.
        Always passes updated_at explicitly (Supabase NOW() only fires on INSERT).
        """
        now = datetime.now(timezone.utc).isoformat()
        data = session_state.model_dump(
            exclude_none=True,
            exclude={"id", "created_at"},
        )
        data["updated_at"] = now

        def _upsert():
            return (
                self.client.table(SESSION_STATE_TABLE)
                .upsert(data, on_conflict="session_id")
                .execute()
            )

        result = await run_sync(_upsert)
        rows = rows_from_result(result)
        if rows:
            return SessionState(**rows[0])
        return session_state

    # -------------------------------------------------------------------------
    # session_events table (append-only)
    # -------------------------------------------------------------------------

    async def append_event(self, event: SessionEvent) -> SessionEvent:
        """INSERT a new event row. Does NOT pass id — DB generates UUID."""
        data = event.model_dump(
            exclude_none=True,
            exclude={"id"},
        )

        def _insert():
            return self.client.table(SESSION_EVENTS_TABLE).insert(data).execute()

        result = await run_sync(_insert)
        rows = rows_from_result(result)
        if rows:
            return SessionEvent(**rows[0])
        return event

    async def get_events(self, session_id: str) -> List[SessionEvent]:
        """SELECT all events for a session ordered by timestamp ASC."""

        def _select():
            return (
                self.client.table(SESSION_EVENTS_TABLE)
                .select("*")
                .eq("session_id", session_id)
                .order("timestamp", desc=False)
                .execute()
            )

        result = await run_sync(_select)
        return [SessionEvent(**row) for row in rows_from_result(result)]
