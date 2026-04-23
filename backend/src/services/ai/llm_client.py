import asyncio
import logging
import os
from typing import Any

from anthropic import AsyncAnthropic
from openai import AsyncOpenAI

logger = logging.getLogger("specflow.llm_client")


def _approx_input_tokens(system_prompt: str, user_message: str) -> int:
    return len(f"{system_prompt}\n\n{user_message}".split())


def _anthropic_system_prompt(system_prompt: str, use_cache: bool) -> str | list[dict[str, Any]]:
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
        message = await client.messages.create(
            model=model,
            max_tokens=int(os.environ.get("AI_MAX_TOKENS", 2048)),
            temperature=temperature,
            system=_anthropic_system_prompt(system_prompt, use_cache),
            messages=[{"role": "user", "content": user_message}],
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
