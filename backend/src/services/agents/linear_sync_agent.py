# services/agents/linear_sync_agent.py
#
# Deterministic formatter — no AI call.
# Reads tasks from pipeline state and produces Linear API GraphQL mutation payloads.
# Output key: linear_payload

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from services.agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

_PRIORITY_MAP = {
    "urgent": 1,
    "high": 1,
    "medium": 2,
    "low": 3,
}

_LABEL_COLORS = {
    "frontend": "#00A4EF",
    "backend": "#7B68EE",
    "api": "#F4A261",
    "infrastructure": "#2EC4B6",
}

_ISSUE_CREATE_MUTATION = (
    "mutation IssueCreate($input: IssueCreateInput!) "
    "{ issueCreate(input: $input) { success issue { id title } } }"
)
_LABEL_CREATE_MUTATION = (
    "mutation IssueLabelCreate($input: IssueLabelCreateInput!) "
    "{ issueLabelCreate(input: $input) { success issueLabel { id name } } }"
)
_PROJECT_CREATE_MUTATION = (
    "mutation ProjectCreate($input: ProjectCreateInput!) "
    "{ projectCreate(input: $input) { success project { id name } } }"
)


class LinearSyncAgent(BaseAgent):
    """
    Formats SpecFlow task output into Linear API GraphQL mutation payloads.

    Handles two task shapes from the tasks step:
      - list: flat array of task dicts
      - dict: grouped by layer {"frontend": [...], "backend": [...], ...}

    Produces a linear_payload dict with:
      - project:  one ProjectCreate mutation
      - labels:   one IssueLabelCreate mutation per unique layer
      - issues:   one IssueCreate mutation per task
      - metadata: summary info + placeholder warning
    """

    def _unwrap(self, val: Any) -> Any:
        if isinstance(val, dict) and list(val.keys()) == ["data"]:
            return val["data"]
        return val

    def _flatten_tasks(self, raw: Any) -> list[dict]:
        """Return a flat list of task dicts regardless of input shape."""
        raw = self._unwrap(raw)

        if isinstance(raw, list):
            return [t for t in raw if isinstance(t, dict)]

        if isinstance(raw, dict):
            # Grouped format: {layer: [task, ...]}
            flat: list[dict] = []
            for layer, items in raw.items():
                if isinstance(items, list):
                    for t in items:
                        if isinstance(t, dict):
                            # Inject layer if missing
                            flat.append({**t, "layer": t.get("layer", layer)})
            return flat

        return []

    def _priority(self, task: dict) -> int:
        raw = str(task.get("priority", "")).strip().lower()
        return _PRIORITY_MAP.get(raw, 4)

    def _build_issue_payload(self, task: dict) -> dict:
        layer = str(task.get("layer", "")).strip().lower() or "backend"
        description_parts = [task.get("description", "")]
        if task.get("acceptance_criteria"):
            description_parts.append(
                f"\n\n**Acceptance Criteria**\n{task['acceptance_criteria']}"
            )
        if task.get("user_problem_it_solves"):
            description_parts.append(
                f"\n\n**Solves:** {task['user_problem_it_solves']}"
            )

        return {
            "operation": "IssueCreate",
            "mutation": _ISSUE_CREATE_MUTATION,
            "variables": {
                "input": {
                    "title": task.get("title", "Untitled Task"),
                    "description": "".join(description_parts).strip(),
                    "teamId": "PLACEHOLDER_TEAM_ID",
                    "priority": self._priority(task),
                    "labelIds": [f"PLACEHOLDER_LABEL_{layer.upper()}"],
                }
            },
        }

    def _build_label_payloads(self, layers: list[str]) -> list[dict]:
        seen: set[str] = set()
        payloads: list[dict] = []
        for layer in layers:
            key = layer.lower()
            if key in seen:
                continue
            seen.add(key)
            payloads.append({
                "operation": "IssueLabelCreate",
                "mutation": _LABEL_CREATE_MUTATION,
                "variables": {
                    "input": {
                        "name": layer.capitalize(),
                        "color": _LABEL_COLORS.get(key, "#888888"),
                        "teamId": "PLACEHOLDER_TEAM_ID",
                    }
                },
            })
        return payloads

    def execute(
        self,
        task: str,
        context: dict = None,
        memory: dict = None,
        session: dict = None,
    ) -> dict:
        ctx = context or {}
        mem = memory or {}

        # Prefer context (full pipeline mode); fall back to memory (single-step mode)
        raw_tasks = ctx.get("tasks") or mem.get("tasks")
        tasks = self._flatten_tasks(raw_tasks)

        layers = [
            str(t.get("layer", "")).strip().lower() or "backend" for t in tasks
        ]
        unique_layers = list(dict.fromkeys(layers))  # preserve insertion order

        issues = [self._build_issue_payload(t) for t in tasks]
        labels = self._build_label_payloads(unique_layers)

        payload = {
            "project": {
                "operation": "ProjectCreate",
                "mutation": _PROJECT_CREATE_MUTATION,
                "variables": {
                    "input": {
                        "name": "PLACEHOLDER_PROJECT_NAME",
                        "teamId": "PLACEHOLDER_TEAM_ID",
                    }
                },
            },
            "labels": labels,
            "issues": issues,
            "metadata": {
                "total_issues": len(issues),
                "total_labels": len(labels),
                "layers": unique_layers,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "warning": (
                    "All PLACEHOLDER_ values must be replaced with real Linear IDs "
                    "before executing these mutations against the Linear API."
                ),
            },
        }

        logger.info(
            "[linear_sync] formatted payload — issues=%d labels=%d layers=%s",
            len(issues),
            len(labels),
            unique_layers,
        )
        return payload

    async def execute_async(
        self,
        task: str,
        context: dict = None,
        memory: dict = None,
        session: dict = None,
    ) -> dict:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, lambda: self.execute(task, context, memory=memory, session=session)
        )
