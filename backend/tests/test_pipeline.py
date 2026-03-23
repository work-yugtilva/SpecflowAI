import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_run_pipeline_success(client):
    mock_pipeline = AsyncMock()
    mock_pipeline.run.return_value = {"result": "ok"}
    with patch("main.Pipeline", return_value=mock_pipeline):
        response = await client.post("/run", json={"input_data": {"key": "val"}})
    assert response.status_code == 200
    assert response.json()["success"] is True


@pytest.mark.asyncio
async def test_run_pipeline_with_project_id(client):
    mock_pipeline = AsyncMock()
    mock_pipeline.run.return_value = {}
    with patch("main.Pipeline", return_value=mock_pipeline):
        response = await client.post(
            "/run", json={"input_data": {}, "project_id": "proj-xyz"}
        )
    assert response.status_code == 200
    mock_pipeline.run.assert_called_once_with({}, "proj-xyz")


@pytest.mark.asyncio
async def test_run_pipeline_missing_input_data_returns_422(client):
    response = await client.post("/run", json={})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_run_pipeline_error_returns_500(client):
    mock_pipeline = AsyncMock()
    mock_pipeline.run.side_effect = RuntimeError("AI call failed")
    with patch("main.Pipeline", return_value=mock_pipeline):
        response = await client.post("/run", json={"input_data": {}})
    assert response.status_code == 500
