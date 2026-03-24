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


def test_validate_pipeline_input_all_missing():
    from services.pipeline import validate_pipeline_input

    with pytest.raises(ValueError) as exc:
        validate_pipeline_input({})
    error_str = str(exc.value)
    assert "INCOMPLETE_CONTEXT" in error_str
    assert "companyName" in error_str
    assert "productName" in error_str
    assert "productDescription" in error_str
    assert "ingest" in error_str


def test_validate_pipeline_input_ingest_only_missing():
    from services.pipeline import validate_pipeline_input

    with pytest.raises(ValueError) as exc:
        validate_pipeline_input({
            "context": {
                "companyName": "Acme",
                "productName": "Widget",
                "productDescription": "A widget for users",
            }
        })
    assert "ingest" in str(exc.value)


def test_validate_pipeline_input_happy_path():
    from services.pipeline import validate_pipeline_input

    # Should not raise
    validate_pipeline_input({
        "context": {
            "companyName": "Acme",
            "productName": "Widget",
            "productDescription": "A widget for users",
        },
        "ingest": [{"content": "some interview"}],
    })


def test_validate_pipeline_input_whitespace_context():
    from services.pipeline import validate_pipeline_input
    import pytest

    with pytest.raises(ValueError) as exc:
        validate_pipeline_input({
            "context": {
                "companyName": "   ",  # whitespace only
                "productName": "Widget",
                "productDescription": "A widget for users",
            },
            "ingest": [{"content": "interview"}],
        })
    assert "companyName" in str(exc.value)


def test_validate_pipeline_input_empty_ingest_list():
    from services.pipeline import validate_pipeline_input
    import pytest

    with pytest.raises(ValueError) as exc:
        validate_pipeline_input({
            "context": {
                "companyName": "Acme",
                "productName": "Widget",
                "productDescription": "A widget for users",
            },
            "ingest": [],  # empty list
        })
    assert "ingest" in str(exc.value)


def test_validate_pipeline_input_none_context():
    from services.pipeline import validate_pipeline_input
    import pytest

    with pytest.raises(ValueError) as exc:
        validate_pipeline_input({"context": None, "ingest": [{"content": "interview"}]})
    assert "INCOMPLETE_CONTEXT" in str(exc.value)
