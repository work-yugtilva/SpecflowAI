import asyncio
import json
import logging
import os
from typing import Any

from anthropic import AsyncAnthropic
from fastapi import HTTPException
from openai import AsyncOpenAI

logger = logging.getLogger("specflow.llm_client")

# Model context limit (safe for claude-3 models; 200k limit minus buffer)
MODEL_CONTEXT_LIMIT = 180_000


def _estimate_tokens(text: str) -> int:
    """Estimate token count. Simple approximation: 1 token ≈ 4 characters."""
    return len(text) // 4


def _approx_input_tokens(system_prompt: str, user_message: str) -> int:
    return len(f"{system_prompt}\n\n{user_message}".split())


def _anthropic_system_prompt(system_prompt: str, use_cache: bool) -> str | list[dict[str, Any]] | None:
    if not system_prompt or not system_prompt.strip():
        return None

    if not use_cache:
        return system_prompt

    return [
        {
            "type": "text",
            "text": system_prompt,
            "cache_control": {"type": "ephemeral"},
        }
    ]


async def call_llm(
    provider: str,
    model: str,
    system_prompt: str,
    user_message: str,
    use_cache: bool = False,
    temperature: float = 0.3,
) -> str:
    logger.debug(
        "[llm_client] provider=%s model=%s approx_input_tokens=%d",
        provider,
        model,
        _approx_input_tokens(system_prompt, user_message),
    )

    if provider == "anthropic":
        client = AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        
        # Pre-flight token safety check
        max_tokens = int(os.environ.get("AI_MAX_TOKENS", 2048))
        estimated_input_tokens = _estimate_tokens(system_prompt) + _estimate_tokens(user_message)
        total_tokens = estimated_input_tokens + max_tokens
        token_limit = int(MODEL_CONTEXT_LIMIT * 0.90)
        
        if total_tokens > token_limit:
            raise HTTPException(
                status_code=422,
                detail=f"Input too large: estimated {estimated_input_tokens} tokens exceeds limit. Reduce your research documents or context."
            )
        
        kwargs: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": user_message}],
        }
        anthropic_system = _anthropic_system_prompt(system_prompt, use_cache)
        if anthropic_system is not None:
            kwargs["system"] = anthropic_system

        message = await client.messages.create(**kwargs)
        if hasattr(message, "usage") and message.usage:
            logger.debug(
                json.dumps({
                    "event": "llm_usage",
                    "provider": provider,
                    "model": model,
                    "input_tokens": getattr(message.usage, "input_tokens", None),
                    "output_tokens": getattr(message.usage, "output_tokens", None),
                })
            )
        return message.content[0].text

    if provider == "google":
        import google.generativeai as genai

        prompt = f"{system_prompt}\n\n{user_message}"
        genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
        google_model = genai.GenerativeModel(model_name=model)
        response = await asyncio.to_thread(
            google_model.generate_content,
            prompt,
            generation_config={"temperature": temperature},
        )
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            logger.debug(
                json.dumps({
                    "event": "llm_usage",
                    "provider": provider,
                    "model": model,
                    "input_tokens": getattr(response.usage_metadata, "prompt_token_count", None),
                    "output_tokens": getattr(response.usage_metadata, "candidates_token_count", None),
                })
            )
        return response.text

    if provider == "openai":
        client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
        response = await client.chat.completions.create(
            model=model,
            temperature=temperature,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        )
        return response.choices[0].message.content

    raise ValueError(f"Unknown LLM provider: {provider}")
