# services/context/context_compressor.py

from typing import Any, Dict, List, Union


def compress(data: Any, strategy: str, params: Dict[str, Any] = None) -> Any:
    """
    Compress large inputs based on a configuration strategy.
    
    Strategies:
    - top_k: Keep only top K items of a list.
    - field_filtering: Keep only specific fields in dictionaries.
    - summarize: (Placeholder) Summarize text.
    - none: No compression.
    """
    if strategy == "none" or not data:
        return data

    params = params or {}

    if strategy == "top_k":
        # Check if params has keys specifically mapped to k values (for memory)
        keys_config = params.get("keys", {})
        k = params.get("k", 3) # default global k
        
        if isinstance(data, dict):
            compressed_dict = {}
            for key, value in data.items():
                if isinstance(value, list):
                    # Use specific k if provided for this key, else fallback to global k
                    specific_k = keys_config.get(key, k) if isinstance(keys_config, dict) else k
                    
                    # Ensure specific_k is an integer
                    if not isinstance(specific_k, int):
                        try:
                            specific_k = int(specific_k)
                        except (ValueError, TypeError):
                            specific_k = 3 # Safe default
                            
                    compressed_dict[key] = value[:specific_k]
                else:
                    compressed_dict[key] = value
            return compressed_dict
            
        elif isinstance(data, list):
            # If it's a list, fallback to k
            return data[:k]
            
        return data

    elif strategy == "field_filtering":
        allowed_fields = params.get("fields", [])
        if not allowed_fields:
            return data
            
        if isinstance(data, dict):
            return {k: v for k, v in data.items() if k in allowed_fields}
        elif isinstance(data, list):
            return [
                {k: v for k, v in item.items() if k in allowed_fields}
                if isinstance(item, dict) else item
                for item in data
            ]
        return data
        
    elif strategy == "summarize":
        # Placeholder for LLM-based summarization fallback
        if isinstance(data, str):
            return data[:500] + "... [SUMMARIZED]"
        return data

    return data
