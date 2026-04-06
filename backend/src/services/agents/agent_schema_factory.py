# services/agents/agent_schema_factory.py

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, create_model


def _yaml_type_to_annotation(ftype: str) -> Any:
    """Map a YAML field type string to a Python type annotation."""
    # Only treat "a | b | c" as Literal when it is a short enum string from YAML.
    # Do not split strings that contain "{" — e.g. str(dict) from a mistaken path
    # includes nested values like 'high | medium | insufficient' and would build
    # a bogus Literal from the whole repr.
    if isinstance(ftype, str) and " | " in ftype and "{" not in ftype:
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


def _field_name_suffix(fname: str) -> str:
    return "".join(part.capitalize() for part in fname.split("_"))


def _field_annotation(ftype: Any, *, name_base: str) -> Any:
    """
    Map a YAML field value to a typing annotation.

    Values are usually strings (string, list, object, …) but may be nested dicts
    with type: list + items: {...} (PRD features) or type: object + properties.
    """
    if isinstance(ftype, dict):
        kind = ftype.get("type")
        if kind == "list":
            item_fields = ftype.get("items") or ftype.get("fields") or {}
            if isinstance(item_fields, dict) and item_fields:
                item_model_name = f"{name_base}Row"
                nested = _field_defs(item_fields, name_base=item_model_name)
                RowModel = create_model(item_model_name, **nested)
                return List[RowModel]
            return List[Any]
        if kind == "object":
            props = {k: v for k, v in ftype.items() if k != "type"}
            if isinstance(props, dict) and props:
                obj_name = f"{name_base}Obj"
                return create_model(obj_name, **_field_defs(props, name_base=obj_name))
            return Dict[str, Any]
        return Dict[str, Any]
    if isinstance(ftype, str):
        return _yaml_type_to_annotation(ftype)
    return str


def _field_defs(raw_fields: Dict[str, Any], *, name_base: str = "Agent") -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    for fname, ftype in raw_fields.items():
        child_base = f"{name_base}{_field_name_suffix(fname)}"
        ann = _field_annotation(ftype, name_base=child_base)
        result[fname] = _field_entry(ann)
    return result


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

        ItemModel = create_model(
            f"{safe_name}Item",
            **_field_defs(item_fields, name_base=f"{safe_name}Item"),
        )
        output_fields = _field_defs(envelope_fields, name_base=f"{safe_name}Envelope")
        output_fields["items"] = (List[ItemModel], ...)  # type: ignore[valid-type]
        return create_model(f"{safe_name}Output", **output_fields)

    raw_fields: Dict[str, Any] = {}
    for key in ("fields", "sections", "groups"):
        value = output_schema.get(key)
        if isinstance(value, dict):
            raw_fields.update(value)
    return create_model(f"{safe_name}Output", **_field_defs(raw_fields, name_base=safe_name))


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
