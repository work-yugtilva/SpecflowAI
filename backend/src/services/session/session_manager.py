import logging
from typing import List, Optional

from services.db.models.session import (
    Session,
    SessionEvent,
    SessionState,
    SESSION_STATUS_ACTIVE,
)
from services.memory.memory_repository import MemoryRepository
from services.session.session_repository import SessionRepository

logger = logging.getLogger("specflow.session")


class SessionManager:
    """
    Orchestrates session lifecycle. Thin coordination layer over SessionRepository.
    All Supabase calls are delegated to the repository; this class contains
    only lifecycle logic.
    """

    def __init__(self, client=None):
        self._client = client
        self.repo = SessionRepository(client=client)

    async def create_session(
        self,
        session_name: str,
        project_id: Optional[str] = None,
        metadata: Optional[dict] = None,
        user_id: Optional[str] = None,
    ) -> Session:
        """Create and persist a new session. Returns the Session with DB-assigned id."""
        session = Session(
            project_id=project_id,
            user_id=user_id,
            session_name=session_name,
            status=SESSION_STATUS_ACTIVE,
            metadata=metadata or {},
        )
        return await self.repo.create_session(session)

    async def list_sessions(self) -> List[Session]:
        """Return all sessions ordered by created_at DESC."""
        return await self.repo.list_sessions()

    async def load_session(self, session_id: str) -> Session:
        """
        Load a session by id. Raises ValueError if not found so callers
        can map it to a 404 without checking for None.
        """
        session = await self.repo.get_session(session_id)
        if session is None:
            raise ValueError(f"Session not found: {session_id}")
        return session

    async def update_status(self, session_id: str, status: str) -> None:
        """Update the session status field."""
        await self.repo.update_session_status(session_id, status)

    async def get_current_state(self, session_id: str) -> dict:
        """
        Returns the full state dict from session_state table.
        Returns {} if no state row exists yet (session has not completed any step).
        """
        state_row = await self.repo.get_state(session_id)
        if state_row is None:
            return {}
        return state_row.state

    async def update_state(self, session_id: str, state: dict, step: str) -> None:
        """
        Upsert into session_state: persists the full pipeline output dict and
        the name of the last completed agent step.
        Called after every successful pipeline step.
        """
        session_state = SessionState(
            session_id=session_id,
            state=state,
            step=step,
        )
        await self.repo.upsert_state(session_state)

    async def append_event(
        self,
        session_id: str,
        event_type: str,
        payload: Optional[dict] = None,
    ) -> None:
        """
        Append a structured event to session_events.
        Fire-and-forget: exceptions are logged but not propagated so that
        observability failures never break the pipeline execution.
        """
        try:
            event = SessionEvent(
                session_id=session_id,
                type=event_type,
                payload=payload or {},
            )
            await self.repo.append_event(event)
        except Exception as e:
            logger.warning("Failed to append event for session %s: %s", session_id, e)

    async def get_full_session(self, session_id: str) -> dict:
        """
        Composite read for GET /session/{id}.
        Raises ValueError if session not found.
        Returns:
            {
                "session": {...},
                "state": {...} or None,
                "events": [...]
            }

        Merges memory_entries into state.outputs so that user edits persisted
        via the autosave route are reflected on page refresh. memory_entries is
        always at least as fresh as session_state.state.outputs and is the only
        store updated by manual edits.
        """
        session = await self.load_session(session_id)
        state_row = await self.repo.get_state(session_id)
        events = await self.repo.get_events(session_id)

        result = {
            "session": session.model_dump(),
            "state": state_row.model_dump() if state_row else None,
            "events": [e.model_dump() for e in events],
        }

        # Merge session-scoped memory_entries into outputs so autosave edits
        # and any entries written after a crash are visible on page refresh.
        if result["state"]:
            memory_repo = MemoryRepository(client=self._client)
            entries = await memory_repo.get_by_session(session_id)
            if entries:
                state_dict = dict(result["state"]["state"] or {})
                outputs = dict(state_dict.get("outputs", {}))
                for entry in entries:
                    # entry.content is {"data": [...]} wrapped — frontend adapters
                    # already handle this format via the unwrap pattern.
                    outputs[entry.memory_key] = entry.content
                state_dict["outputs"] = outputs
                result["state"] = {**result["state"], "state": state_dict}

        return result
