# services/ai/client.py

import os
import time
import random
from anthropic import Anthropic, APIStatusError, RateLimitError

from services.config.load_env import load_root_env

load_root_env()

_client = None


def get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


def run_ai(prompt: str, max_tokens: int = None, retries: int = None, model: str = None, temperature: float = None) -> str:
    """
    Run AI inference with built-in retry logic for rate limits (429).
    """
    client = get_client()

    # Dynamic defaults from env or fallbacks
    model = model or os.environ.get("AI_MODEL", "claude-sonnet-4-6")
    max_tokens = max_tokens or int(os.environ.get("AI_MAX_TOKENS", 2048))
    retries = retries if retries is not None else int(os.environ.get("AI_RETRIES", 3))

    for attempt in range(retries + 1):
        try:
            kwargs = {
                "model": model,
                "max_tokens": max_tokens,
                "messages": [{"role": "user", "content": prompt}],
            }
            if temperature is not None:
                kwargs["temperature"] = temperature
            message = client.messages.create(**kwargs)
            return message.content[0].text
            
        except RateLimitError as e:
            if attempt == retries:
                raise e
            
            # Exponential backoff with jitter
            wait_time = (2 ** attempt) + random.random()
            print(f"Rate limit hit (429). Retrying in {wait_time:.2f}s... (Attempt {attempt+1}/{retries})")
            time.sleep(wait_time)
            
        except APIStatusError as e:
            if e.status_code == 429:
                if attempt == retries:
                    raise e
                wait_time = (2 ** attempt) + random.random()
                print(f"Status 429 hit. Retrying in {wait_time:.2f}s...")
                time.sleep(wait_time)
            else:
                raise e
                
        except Exception as e:
            # For other errors, we might still want a small retry or just raise
            if attempt == retries:
                raise e
            time.sleep(1)
            
    return ""
