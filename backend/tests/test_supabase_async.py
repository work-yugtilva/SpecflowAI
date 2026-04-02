"""
Unit tests for supabase_async helpers — rows_from_result and first_row_from_result.
No mocking needed; these are pure functions.
"""
from unittest.mock import MagicMock
from services.db.supabase_async import rows_from_result, first_row_from_result


# ---------------------------------------------------------------------------
# rows_from_result
# ---------------------------------------------------------------------------

def test_rows_from_result_none_input():
    assert rows_from_result(None) == []


def test_rows_from_result_no_data_attr():
    result = MagicMock(spec=[])  # no .data attribute
    assert rows_from_result(result) == []


def test_rows_from_result_data_is_none():
    result = MagicMock()
    result.data = None
    assert rows_from_result(result) == []


def test_rows_from_result_data_is_list():
    result = MagicMock()
    result.data = [{"id": 1}, {"id": 2}]
    assert rows_from_result(result) == [{"id": 1}, {"id": 2}]


def test_rows_from_result_data_is_empty_list():
    result = MagicMock()
    result.data = []
    assert rows_from_result(result) == []


def test_rows_from_result_data_is_dict():
    """maybe_single() returns a single dict — should be wrapped in a list."""
    result = MagicMock()
    result.data = {"id": 42, "key": "prd"}
    rows = rows_from_result(result)
    assert rows == [{"id": 42, "key": "prd"}]


def test_rows_from_result_data_is_unexpected_type():
    result = MagicMock()
    result.data = "unexpected_string"
    assert rows_from_result(result) == []


# ---------------------------------------------------------------------------
# first_row_from_result
# ---------------------------------------------------------------------------

def test_first_row_from_result_returns_first():
    result = MagicMock()
    result.data = [{"id": 1}, {"id": 2}]
    assert first_row_from_result(result) == {"id": 1}


def test_first_row_from_result_empty():
    result = MagicMock()
    result.data = []
    assert first_row_from_result(result) is None


def test_first_row_from_result_none_input():
    assert first_row_from_result(None) is None


def test_first_row_from_result_single_dict():
    """maybe_single() returns dict — first_row_from_result should return it."""
    result = MagicMock()
    result.data = {"id": 99}
    assert first_row_from_result(result) == {"id": 99}
