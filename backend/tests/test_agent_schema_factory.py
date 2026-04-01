import os
import sys

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../src"))


def test_build_response_model_supports_list_envelope_and_boolean():
    from services.agents.agent_schema_factory import (
        build_response_model,
        extract_payload_and_reasoning,
    )

    schema = {
        "type": "list",
        "sections": {"reasoning": "string"},
        "fields": {"title": "string", "passed": "boolean"},
    }

    model = build_response_model(schema, "quality_test")
    response = model(reasoning="Because the evidence is explicit.", items=[{"title": "Item 1", "passed": True}])

    payload, reasoning = extract_payload_and_reasoning(response, schema)

    assert reasoning == "Because the evidence is explicit."
    assert payload == [{"title": "Item 1", "passed": True}]


def test_extract_payload_and_reasoning_for_object_schema():
    from services.agents.agent_schema_factory import (
        build_response_model,
        extract_payload_and_reasoning,
    )

    schema = {
        "type": "object",
        "sections": {
            "reasoning": "string",
            "score": "number",
            "passed": "boolean",
        },
    }

    model = build_response_model(schema, "score_test")
    response = model(reasoning="Every check passed.", score=92, passed=True)

    payload, reasoning = extract_payload_and_reasoning(response, schema)

    assert reasoning == "Every check passed."
    assert payload == {"score": 92.0, "passed": True}
