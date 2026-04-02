"""
Unit tests for context_compressor.compress() — pure function, no I/O.
Covers all strategies: none, top_k, field_filtering, summarize, unknown.
"""
from services.context.context_compressor import compress


# ---------------------------------------------------------------------------
# strategy="none"
# ---------------------------------------------------------------------------

def test_strategy_none_returns_data_unchanged():
    data = {"key": [1, 2, 3]}
    assert compress(data, "none") is data


def test_empty_data_returns_data():
    assert compress([], "top_k") == []
    assert compress({}, "top_k") == {}
    assert compress(None, "top_k") is None


# ---------------------------------------------------------------------------
# strategy="top_k" — dict input
# ---------------------------------------------------------------------------

def test_top_k_dict_truncates_lists():
    data = {"problems": ["p1", "p2", "p3", "p4"], "title": "my prd"}
    result = compress(data, "top_k", {"k": 2})
    assert result["problems"] == ["p1", "p2"]
    assert result["title"] == "my prd"  # non-list values pass through


def test_top_k_dict_per_key_config():
    data = {"problems": ["p1", "p2", "p3"], "features": ["f1", "f2", "f3", "f4"]}
    result = compress(data, "top_k", {"keys": {"problems": 1, "features": 2}})
    assert result["problems"] == ["p1"]
    assert result["features"] == ["f1", "f2"]


def test_top_k_dict_no_k_passes_through():
    data = {"items": [1, 2, 3]}
    result = compress(data, "top_k", {})
    assert result["items"] == [1, 2, 3]


def test_top_k_dict_invalid_k_passes_through():
    data = {"items": [1, 2, 3]}
    result = compress(data, "top_k", {"k": "notanumber"})
    assert result["items"] == [1, 2, 3]


# ---------------------------------------------------------------------------
# strategy="top_k" — list input
# ---------------------------------------------------------------------------

def test_top_k_list_truncates():
    data = [1, 2, 3, 4, 5]
    assert compress(data, "top_k", {"k": 3}) == [1, 2, 3]


def test_top_k_list_no_k_returns_full():
    data = [1, 2, 3]
    assert compress(data, "top_k", {}) == [1, 2, 3]


def test_top_k_list_invalid_k_returns_full():
    data = [1, 2, 3]
    assert compress(data, "top_k", {"k": "bad"}) == [1, 2, 3]


# ---------------------------------------------------------------------------
# strategy="field_filtering"
# ---------------------------------------------------------------------------

def test_field_filtering_dict_keeps_allowed():
    data = {"a": 1, "b": 2, "c": 3}
    result = compress(data, "field_filtering", {"fields": ["a", "c"]})
    assert result == {"a": 1, "c": 3}


def test_field_filtering_list_of_dicts():
    data = [{"name": "x", "hidden": "secret"}, {"name": "y", "hidden": "secret"}]
    result = compress(data, "field_filtering", {"fields": ["name"]})
    assert result == [{"name": "x"}, {"name": "y"}]


def test_field_filtering_list_passthrough_non_dict_items():
    data = ["string1", "string2"]
    result = compress(data, "field_filtering", {"fields": ["name"]})
    assert result == ["string1", "string2"]


def test_field_filtering_empty_fields_returns_unchanged():
    data = {"a": 1}
    assert compress(data, "field_filtering", {"fields": []}) is data


# ---------------------------------------------------------------------------
# strategy="summarize"
# ---------------------------------------------------------------------------

def test_summarize_truncates_long_string():
    data = "A" * 200
    result = compress(data, "summarize", {"length": 50})
    assert result.endswith("... [SUMMARIZED]")
    assert len(result) < 200


def test_summarize_short_string_unchanged():
    data = "Short text"
    result = compress(data, "summarize", {"length": 100})
    assert result == "Short text"


def test_summarize_no_length_returns_unchanged():
    data = "Some text"
    assert compress(data, "summarize", {}) == "Some text"


def test_summarize_invalid_length_returns_unchanged():
    data = "Some text"
    assert compress(data, "summarize", {"length": "bad"}) == "Some text"


# ---------------------------------------------------------------------------
# unknown strategy
# ---------------------------------------------------------------------------

def test_unknown_strategy_returns_data():
    data = {"key": "val"}
    assert compress(data, "unknown_strategy") is data
