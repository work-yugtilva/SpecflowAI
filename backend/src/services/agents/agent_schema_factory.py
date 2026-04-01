# services/agents/agent_schema_factory.py

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, create_model


def _yaml_type_to_annotation(ftype: str) -> Any:
    """Map a YAML field type string to a Python type annotation."""
    if isinstance(ftype, str) and " | " in ftype:
        options = tuple(v.strip() for v in ftype.split("|"))
        return Literal.__getitem__(options)  # type: ignore[return-value]

    mapping: Dict[str, Any] = {
        "string": str,
        "number": float,
        "boolean": bool,
        "list": List[Any],
        "object": Dict[str, Any],
    }
    return mapping.get(str(ftype), str)


def _field_entry(annotation: Any) -> tuple:
    """Return a (annotation, default) tuple for create_model field definitions."""
    origin = getattr(annotation, "__origin__", None)
    if origin is list:
        return (annotation, [])
    if annotation is float:
        return (annotation, 0.0)
    if annotation is bool:
        return (annotation, False)
    return (Optional[annotation], None)


def _field_defs(raw_fields: Dict[str, Any]) -> Dict[str, Any]:
    return {
        fname: _field_entry(_yaml_type_to_annotation(str(ftype)))
        for fname, ftype in raw_fields.items()
    }


def build_response_model(output_schema: dict, agent_name: str) -> type:
    """
    Build a Pydantic BaseModel from an agent YAML output_schema dict.

    For type: list  -> creates an envelope model with top-level sections/groups
    plus items: List[{Name}Item].
    For type: object -> creates a flat {Name}Output from all merged fields/sections/groups.
    """
    schema_type = output_schema.get("type", "object")
    safe_name = agent_name.replace("-", "_").title().replace("_", "")

    if schema_type == "list":
        item_fields = output_schema.get("fields") or {}
        envelope_fields: Dict[str, Any] = {}
        for key in ("sections", "groups"):
            value = output_schema.get(key)
            if isinstance(value, dict):
                envelope_fields.update(value)

        ItemModel = create_model(f"{safe_name}Item", **_field_defs(item_fields))
        output_fields = _field_defs(envelope_fields)
        output_fields["items"] = (List[ItemModel], ...)  # type: ignore[valid-type]
        return create_model(f"{safe_name}Output", **output_fields)

    raw_fields: Dict[str, Any] = {}
    for key in ("fields", "sections", "groups"):
        value = output_schema.get(key)
        if isinstance(value, dict):
            raw_fields.update(value)
    return create_model(f"{safe_name}Output", **_field_defs(raw_fields))


def extract_payload_and_reasoning(response: BaseModel, output_schema: dict) -> tuple[Any, Optional[str]]:
    """
    Convert a structured output Pydantic instance to the expected payload shape
    while separating the top-level reasoning field from the persisted payload.
    """
    schema_type = output_schema.get("type", "object")
    data = response.model_dump()
    reasoning = data.pop("reasoning", None)

    if schema_type == "list":
        return data.get("items", []), reasoning

    return data, reasoning
