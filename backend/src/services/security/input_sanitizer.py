import re
from typing import Any

# Patterns that signal prompt injection attempts
INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|above|prior)\s+instructions?",
    r"disregard\s+(all\s+)?(previous|above|prior)",
    r"forget\s+(all\s+)?(previous|above|prior)",
    r"new\s+instruction[s]?\s*:",
    r"system\s*:\s*you\s+are",
    r"<\s*system\s*>",
    r"\[system\]",
    r"act\s+as\s+(a\s+)?(different|new|another)",
    r"you\s+are\s+now\s+(a\s+)?",
    r"override\s+(all\s+)?(previous\s+)?instructions?",
    r"jailbreak",
    r"DAN\s*mode",
    r"developer\s+mode",
]

_COMPILED = [re.compile(p, re.IGNORECASE | re.MULTILINE) for p in INJECTION_PATTERNS]

MAX_FIELD_LENGTH = 8000  # chars — generous for real PM inputs


def sanitize_user_input(value: Any, field_name: str = "input") -> str:
    """
    Sanitize a single user-controlled string before injecting into a prompt.
    - Truncates to MAX_FIELD_LENGTH
    - Flags (but doesn't silently drop) injection attempts
    Raises ValueError if injection attempt detected.
    """
    if value is None:
        return ""

    text = str(value).strip()

    # Truncate — a real PM context won't need more than 8k chars
    if len(text) > MAX_FIELD_LENGTH:
        text = text[:MAX_FIELD_LENGTH] + "\n[truncated]"

    # Check for injection patterns
    for pattern in _COMPILED:
        if pattern.search(text):
            raise ValueError(
                f"Potentially unsafe input detected in field '{field_name}'. "
                "Please revise your input."
            )

    return text


def sanitize_pipeline_input(data: dict) -> dict:
    """
    Sanitize all user-controlled fields in a pipeline input dict.
    Call this at the pipeline entry point before any agent runs.
    """
    SANITIZE_FIELDS = [
        "product_context",
        "ingest",
        "research_context",
        "context",
        "user_context",
    ]

    sanitized = dict(data)
    for field in SANITIZE_FIELDS:
        if field in sanitized and sanitized[field]:
            sanitized[field] = sanitize_user_input(sanitized[field], field_name=field)

    return sanitized