# services/token/token_manager.py

import json
from typing import Any, Dict, Union


def estimate_tokens(text: Any) -> int:
    """
    Estimate tokens based on string length.
    Roughly 4 characters = 1 token.
    """
    if not isinstance(text, str):
        try:
            text = json.dumps(text)
        except Exception:
            text = str(text)
    return max(1, len(text) // 4)


def allocate_budget(agent_name: str, config: Dict[str, Any]) -> int:
    """
    Get token budget from agent config.
    Returns default of 8000 if not specified.
    """
    token_control = config.get("token_control", {})
    budget = token_control.get("max_tokens", 8000)
    
    # Handle "dynamic" or other string placeholders by falling back to default
    if not isinstance(budget, int):
        return 8000
        
    return budget


def trim_to_budget(data: Union[Dict, list, str], max_tokens: int) -> Union[Dict, list, str]:
    """
    Trim data structure to fit within the max_tokens budget.
    This is a simplistic trim that truncates lists or strings.
    """
    current_tokens = estimate_tokens(data)
    if current_tokens <= max_tokens:
        return data

    if isinstance(data, str):
        # Trim string directly
        max_chars = max_tokens * 4
        return data[:max_chars] + "... [TRIMMED]"

    elif isinstance(data, list):
        # Trim list by keeping fewer items
        if not data:
            return data
        # Iteratively reduce list until it fits
        trimmed_list = list(data)
        while estimate_tokens(trimmed_list) > max_tokens and len(trimmed_list) > 1:
            trimmed_list.pop()
        
        # If even 1 item is too big, trim it as a string
        if estimate_tokens(trimmed_list) > max_tokens:
            return trim_to_budget(json.dumps(trimmed_list), max_tokens)
            
        return trimmed_list

    elif isinstance(data, dict):
        # Trim dict by removing keys until it fits
        if not data:
            return data
        trimmed_dict = dict(data)
        # Try removing items one by one (remove largest keys first by name order)
        keys_to_try = sorted(trimmed_dict.keys(), reverse=True)
        while estimate_tokens(trimmed_dict) > max_tokens and len(trimmed_dict) > 1 and keys_to_try:
            key_to_remove = keys_to_try.pop(0)
            if key_to_remove in trimmed_dict:
                trimmed_dict.pop(key_to_remove)
        return trimmed_dict

    else:
        # Fallback for other types
        return trim_to_budget(str(data), max_tokens)
