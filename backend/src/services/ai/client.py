# services/ai/client.py

import os
import time
import random
from anthropic import Anthropic, APIStatusError, RateLimitError

_client = None


def get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


def run_ai(prompt: str, max_tokens: int = 2048, retries: int = 3) -> str:
    """
    Run AI inference with built-in retry logic for rate limits (429).
    """
    client = get_client()
    
    for attempt in range(retries + 1):
        try:
            message = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )
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
