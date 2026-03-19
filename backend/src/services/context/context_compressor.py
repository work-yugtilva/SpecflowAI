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
        keys_config = params.get("keys", {})
        k = params.get("k")
        
        if isinstance(data, dict):
            compressed_dict = {}
            for key, value in data.items():
                if isinstance(value, list):
                    specific_k = keys_config.get(key, k) if isinstance(keys_config, dict) else k
                    
                    if specific_k is not None:
                        try:
                            specific_k = int(specific_k)
                            compressed_dict[key] = value[:specific_k]
                        except (ValueError, TypeError):
                            compressed_dict[key] = value
                    else:
                        compressed_dict[key] = value
                else:
                    compressed_dict[key] = value
            return compressed_dict
            
        elif isinstance(data, list):
            if k is not None:
                try:
                    return data[:int(k)]
                except (ValueError, TypeError):
                    return data
            return data
            
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
        summary_length = params.get("length")
        if isinstance(data, str) and summary_length is not None:
            try:
                length = int(summary_length)
                if len(data) > length:
                    return data[:length] + "... [SUMMARIZED]"
            except (ValueError, TypeError):
                pass
        return data

    return data
