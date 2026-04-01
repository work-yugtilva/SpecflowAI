# services/ai/client.py

import os
import time
import random
import asyncio
from typing import Any
from anthropic import Anthropic, AsyncAnthropic, APIStatusError, RateLimitError

from services.config.load_env import load_root_env

load_root_env()

_client = None
_instructor_client = None
_async_client = None
_async_instructor_client = None


def get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


def get_instructor_client():
    global _instructor_client
    if _instructor_client is None:
        import instructor
        # SDK-level max_retries handles rate-limit 429s automatically
        _instructor_client = instructor.from_anthropic(
            Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"], max_retries=3)
        )
    return _instructor_client


def _get_async_client() -> AsyncAnthropic:
    global _async_client
    if _async_client is None:
        _async_client = AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _async_client


def _get_async_instructor_client():
    global _async_instructor_client
    if _async_instructor_client is None:
        import instructor
        _async_instructor_client = instructor.from_anthropic(
            AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        )
    return _async_instructor_client


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


def run_ai_structured(
    prompt: str,
    response_model: type,
    max_tokens: int = None,
    model: str = None,
    temperature: float = None,
    max_retries: int = 2,
) -> Any:
    """
    Run AI inference with strict structured output enforcement via Instructor.
    The response is guaranteed to match response_model's schema (Pydantic BaseModel).
    max_retries controls instructor's retry-on-validation-failure behaviour.
    Rate-limit retries are handled by the underlying SDK client (max_retries=3).
    """
    client = get_instructor_client()
    model = model or os.environ.get("AI_MODEL", "claude-sonnet-4-6")
    max_tokens = max_tokens or int(os.environ.get("AI_MAX_TOKENS", 2048))
    kwargs: dict = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
        "response_model": response_model,
        "max_retries": max_retries,
    }
    if temperature is not None:
        kwargs["temperature"] = temperature
    return client.messages.create(**kwargs)


async def run_ai_async(prompt: str, max_tokens: int = None, retries: int = None, model: str = None, temperature: float = None) -> str:
    """
    Async version of run_ai — uses AsyncAnthropic, no thread blocking.
    """
    client = _get_async_client()

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
            message = await client.messages.create(**kwargs)
            return message.content[0].text

        except RateLimitError as e:
            if attempt == retries:
                raise e

            wait_time = (2 ** attempt) + random.random()
            print(f"Rate limit hit (429). Retrying in {wait_time:.2f}s... (Attempt {attempt+1}/{retries})")
            await asyncio.sleep(wait_time)

        except APIStatusError as e:
            if e.status_code == 429:
                if attempt == retries:
                    raise e
                wait_time = (2 ** attempt) + random.random()
                print(f"Status 429 hit. Retrying in {wait_time:.2f}s...")
                await asyncio.sleep(wait_time)
            else:
                raise e

        except Exception as e:
            if attempt == retries:
                raise e
            await asyncio.sleep(1)

    return ""


async def run_ai_structured_async(
    prompt: str,
    response_model: type,
    max_tokens: int = None,
    model: str = None,
    temperature: float = None,
    max_retries: int = 2,
) -> Any:
    """
    Async version of run_ai_structured — uses AsyncAnthropic via instructor.
    """
    client = _get_async_instructor_client()
    model = model or os.environ.get("AI_MODEL", "claude-sonnet-4-6")
    max_tokens = max_tokens or int(os.environ.get("AI_MAX_TOKENS", 2048))
    kwargs: dict = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
        "response_model": response_model,
        "max_retries": max_retries,
    }
    if temperature is not None:
        kwargs["temperature"] = temperature
    return await client.messages.create(**kwargs)
