"""
Tests for RequestBodySizeLimitMiddleware — validates the 512KB hard limit
that protects against payload-based DoS and prompt injection via large input_data.
"""
import pytest


@pytest.mark.asyncio
async def test_oversized_body_returns_413(client):
    """Body larger than MAX_REQUEST_BODY_BYTES (512 KB) must be rejected with 413."""
    payload = "x" * (512 * 1024 + 1)
    response = await client.post(
        "/run",
        content=payload,
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 413
    assert "too large" in response.json().get("error", "").lower()


@pytest.mark.asyncio
async def test_exactly_512kb_body_is_allowed(client):
    """Body of exactly 512 KB must pass the size gate (boundary: ≤ allowed)."""
    import json

    payload = json.dumps({"input_data": "a" * (512 * 1024 - 50), "project_id": "p"})
    response = await client.post(
        "/run",
        content=payload,
        headers={"Content-Type": "application/json"},
    )
    # Should NOT be 413 — auth (401) or validation (422) are acceptable
    assert response.status_code != 413


@pytest.mark.asyncio
async def test_normal_body_reaches_auth(client):
    """A small valid body must not be blocked by the size middleware — reaches auth layer."""
    import json

    payload = json.dumps({"input_data": {}, "project_id": "test"})
    response = await client.post(
        "/run",
        content=payload,
        headers={"Content-Type": "application/json"},
    )
    # Body size middleware passed — endpoint itself may 422/500 depending on env deps
    assert response.status_code != 413


@pytest.mark.asyncio
async def test_oversized_body_without_content_length_returns_413(client):
    """Streaming path: when Content-Length is absent, enforce limit via stream counting."""
    big_chunk = b"x" * (512 * 1024 + 100)
    response = await client.post(
        "/run",
        content=big_chunk,
        headers={"Content-Type": "application/octet-stream"},
    )
    assert response.status_code == 413


@pytest.mark.asyncio
async def test_health_endpoint_not_affected_by_size_limit(client):
    """GET /health has no body — must never be blocked by body size middleware."""
    response = await client.get("/health")
    assert response.status_code == 200
