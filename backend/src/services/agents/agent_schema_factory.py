# services/agents/agent_schema_factory.py

from pydantic import BaseModel, create_model
from typing import Any, Dict, List, Literal, Optional, get_args


def _yaml_type_to_annotation(ftype: str) -> Any:
    """Map a YAML field type string to a Python type annotation."""
    if isinstance(ftype, str) and " | " in ftype:
        options = tuple(v.strip() for v in ftype.split("|"))
        return Literal[options]  # type: ignore[return-value]
    mapping: Dict[str, Any] = {
        "string": str,
        "number": float,
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
    return (Optional[annotation], None)


def build_response_model(output_schema: dict, agent_name: str) -> type:
    """
    Build a Pydantic BaseModel from an agent YAML output_schema dict.

    For type: list  → creates {Name}Item then wraps in {Name}Output(items: List[{Name}Item])
    For type: object → creates a flat {Name}Output from all merged fields/sections/groups
    """
    schema_type = output_schema.get("type", "object")

    # Merge all structure-defining keys (mirrors _build_schema_hint in base_agent)
    raw_fields: Dict[str, Any] = {}
    for key in ("fields", "sections", "groups"):
        value = output_schema.get(key)
        if isinstance(value, dict):
            raw_fields.update(value)

    field_defs: Dict[str, Any] = {
        fname: _field_entry(_yaml_type_to_annotation(str(ftype)))
        for fname, ftype in raw_fields.items()
    }

    safe_name = agent_name.replace("-", "_").title().replace("_", "")

    if schema_type == "list":
        ItemModel = create_model(f"{safe_name}Item", **field_defs)
        return create_model(f"{safe_name}Output", items=(List[ItemModel], ...))  # type: ignore[valid-type]
    else:
        return create_model(f"{safe_name}Output", **field_defs)


def extract_output(response: BaseModel, output_schema: dict) -> Any:
    """
    Convert a structured output Pydantic instance to the expected list or dict.

    For type: list  → returns response.items (list of dicts)
    For type: object → returns response.model_dump()
    """
    schema_type = output_schema.get("type", "object")
    data = response.model_dump()
    if schema_type == "list":
        return data.get("items", [])
    return data
