import logging
import sys
import types
from types import SimpleNamespace

import pytest


@pytest.mark.asyncio
async def test_anthropic_without_cache_sends_string_system(monkeypatch):
    from services.ai import llm_client

    calls = {}

    class FakeMessages:
        async def create(self, **kwargs):
            calls["kwargs"] = kwargs
            return SimpleNamespace(content=[SimpleNamespace(text="anthropic text")])

    class FakeAsyncAnthropic:
        def __init__(self, api_key):
            calls["api_key"] = api_key
            self.messages = FakeMessages()

    monkeypatch.setenv("ANTHROPIC_API_KEY", "anthropic-test-key")
    monkeypatch.setattr(llm_client, "AsyncAnthropic", FakeAsyncAnthropic)

    result = await llm_client.call_llm(
        provider="anthropic",
        model="claude-haiku-4-5-20251001",
        system_prompt="system prompt",
        user_message="user message",
    )

    assert result == "anthropic text"
    assert calls["api_key"] == "anthropic-test-key"
    assert calls["kwargs"]["system"] == "system prompt"
    assert calls["kwargs"]["messages"] == [{"role": "user", "content": "user message"}]
    assert calls["kwargs"]["temperature"] == 0.3


@pytest.mark.asyncio
async def test_anthropic_with_cache_sends_cache_control_block(monkeypatch):
    from services.ai import llm_client

    calls = {}

    class FakeMessages:
        async def create(self, **kwargs):
            calls["kwargs"] = kwargs
            return SimpleNamespace(content=[SimpleNamespace(text="cached anthropic text")])

    class FakeAsyncAnthropic:
        def __init__(self, api_key):
            self.messages = FakeMessages()

    monkeypatch.setenv("ANTHROPIC_API_KEY", "anthropic-test-key")
    monkeypatch.setattr(llm_client, "AsyncAnthropic", FakeAsyncAnthropic)

    result = await llm_client.call_llm(
        provider="anthropic",
        model="claude-haiku-4-5-20251001",
        system_prompt="cached system prompt",
        user_message="user message",
        use_cache=True,
    )

    assert result == "cached anthropic text"
    assert calls["kwargs"]["system"] == [
        {
            "type": "text",
            "text": "cached system prompt",
            "cache_control": {"type": "ephemeral"},
        }
    ]


@pytest.mark.asyncio
async def test_google_combines_prompt_and_returns_text(monkeypatch):
    from services.ai import llm_client

    calls = {}
    fake_google = types.ModuleType("google")
    fake_genai = types.ModuleType("google.generativeai")

    def configure(api_key):
        calls["api_key"] = api_key

    class FakeGenerativeModel:
        def __init__(self, model_name):
            calls["model_name"] = model_name

        def generate_content(self, prompt, generation_config=None):
            calls["prompt"] = prompt
            calls["generation_config"] = generation_config
            return SimpleNamespace(text="google text")

    fake_genai.configure = configure
    fake_genai.GenerativeModel = FakeGenerativeModel
    fake_google.generativeai = fake_genai

    monkeypatch.setenv("GOOGLE_API_KEY", "google-test-key")
    monkeypatch.setitem(sys.modules, "google", fake_google)
    monkeypatch.setitem(sys.modules, "google.generativeai", fake_genai)

    result = await llm_client.call_llm(
        provider="google",
        model="gemini-2.5-flash",
        system_prompt="system prompt",
        user_message="user message",
        temperature=0.7,
    )

    assert result == "google text"
    assert calls["api_key"] == "google-test-key"
    assert calls["model_name"] == "gemini-2.5-flash"
    assert calls["prompt"] == "system prompt\n\nuser message"
    assert calls["generation_config"] == {"temperature": 0.7}


@pytest.mark.asyncio
async def test_openai_sends_chat_completion_messages(monkeypatch):
    from services.ai import llm_client

    calls = {}

    class FakeCompletions:
        async def create(self, **kwargs):
            calls["kwargs"] = kwargs
            message = SimpleNamespace(content="openai text")
            return SimpleNamespace(choices=[SimpleNamespace(message=message)])

    class FakeAsyncOpenAI:
        def __init__(self, api_key):
            calls["api_key"] = api_key
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setenv("OPENAI_API_KEY", "openai-test-key")
    monkeypatch.setattr(llm_client, "AsyncOpenAI", FakeAsyncOpenAI)

    result = await llm_client.call_llm(
        provider="openai",
        model="gpt-test",
        system_prompt="system prompt",
        user_message="user message",
        temperature=0.1,
    )

    assert result == "openai text"
    assert calls["api_key"] == "openai-test-key"
    assert calls["kwargs"] == {
        "model": "gpt-test",
        "temperature": 0.1,
        "messages": [
            {"role": "system", "content": "system prompt"},
            {"role": "user", "content": "user message"},
        ],
    }


@pytest.mark.asyncio
async def test_unknown_provider_raises_value_error():
    from services.ai.llm_client import call_llm

    with pytest.raises(ValueError, match="Unknown LLM provider: mystery"):
        await call_llm(
            provider="mystery",
            model="test-model",
            system_prompt="system prompt",
            user_message="user message",
        )


@pytest.mark.asyncio
async def test_debug_log_includes_provider_model_and_token_count(monkeypatch, caplog):
    from services.ai import llm_client

    class FakeMessages:
        async def create(self, **kwargs):
            return SimpleNamespace(content=[SimpleNamespace(text="anthropic text")])

    class FakeAsyncAnthropic:
        def __init__(self, api_key):
            self.messages = FakeMessages()

    monkeypatch.setenv("ANTHROPIC_API_KEY", "anthropic-test-key")
    monkeypatch.setattr(llm_client, "AsyncAnthropic", FakeAsyncAnthropic)

    with caplog.at_level(logging.DEBUG, logger="specflow.llm_client"):
        await llm_client.call_llm(
            provider="anthropic",
            model="claude-haiku-4-5-20251001",
            system_prompt="one two",
            user_message="three four five",
        )

    assert "provider=anthropic" in caplog.text
    assert "model=claude-haiku-4-5-20251001" in caplog.text
    assert "approx_input_tokens=5" in caplog.text
