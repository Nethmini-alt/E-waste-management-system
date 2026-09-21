"""Minimal LLM abstraction so agents never import a vendor SDK directly.

Agents only need 'give me a JSON object' (optionally about some images). Swap Gemini for Ollama
(the local model in the assignment's reference architecture) by implementing one method.
"""
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Any, Protocol

from .config import Settings


@dataclass(frozen=True)
class ImagePart:
    mime_type: str
    data: bytes


class LLMClient(Protocol):
    async def generate_json(self, *, system: str, user: str, images: list[ImagePart] | None = None) -> dict[str, Any]: ...


class GeminiLLMClient:
    """Same call pattern as the original main.py (google-genai, JSON response mime type)."""

    def __init__(self, api_key: str, model: str, timeout_seconds: float = 20.0) -> None:
        from google import genai  # lazy import: only needed when an LLM is actually configured
        self._client = genai.Client(api_key=api_key)
        self._model = model
        self._timeout = timeout_seconds

    async def generate_json(self, *, system: str, user: str, images: list[ImagePart] | None = None) -> dict[str, Any]:
        from google.genai import types

        def _call() -> str:
            contents: list[Any] = [user] + [types.Part.from_bytes(data=i.data, mime_type=i.mime_type)
                                            for i in (images or [])]
            response = self._client.models.generate_content(
                model=self._model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system, response_mime_type="application/json", temperature=0),
            )
            return response.text

        text = await asyncio.wait_for(asyncio.to_thread(_call), timeout=self._timeout)
        data = json.loads(text)
        if not isinstance(data, dict):
            raise ValueError("LLM did not return a JSON object")
        return data


def build_llm(settings: Settings) -> LLMClient | None:
    """None -> no model configured (callers must handle that explicitly, never invent output)."""
    if not settings.gemini_api_key:
        return None
    return GeminiLLMClient(settings.gemini_api_key, settings.gemini_model, settings.llm_timeout_seconds)
