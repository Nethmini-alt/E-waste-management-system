"""
Optional Gemini wiring for the Sales agent.

Same pattern as agentic-ai/Planner/config + nodes (`with_structured_output`, temperature
0, short timeout, fall back to a deterministic answer on any failure), with two
deliberate differences for this agent:

  * the import is guarded, so the service still starts — and still decides everything —
    when langchain-google-genai isn't installed. The Sales venv doesn't need the package
    until someone actually configures a key;
  * every call site has a deterministic fallback, because unlike Planner's prose this
    agent's output moves money. The model chooses *what to optimise* and how to explain
    it; the tools in tools/commercial_tools.py do the arithmetic and the ordering.
"""

import logging

from config import settings

log = logging.getLogger("agent.llm")

try:  # optional dependency — see the module docstring
    from langchain_google_genai import ChatGoogleGenerativeAI
except Exception:  # pragma: no cover - depends on the local environment
    ChatGoogleGenerativeAI = None


def get_llm():
    """The configured model, or None when this agent should decide deterministically."""
    if ChatGoogleGenerativeAI is None or not settings.google_api_key:
        return None
    return ChatGoogleGenerativeAI(
        model=settings.chat_model,
        google_api_key=settings.google_api_key,
        temperature=0,
        timeout=30,
        max_retries=2,
    )


def model_name() -> str | None:
    """Label for "who decided this?" — surfaced in the API response."""
    return settings.chat_model if get_llm() is not None else None


def as_text(content) -> str:
    """
    Some Gemini responses come back as a list of content-part dicts (e.g. a "thought
    signature" part next to the text) instead of a plain string. Planner's finalize node
    hits the same shape; flattening it here keeps both call sites honest.
    """
    if isinstance(content, list):
        return "".join(
            part.get("text", "") if isinstance(part, dict) else str(part)
            for part in content
        ).strip()
    return str(content or "").strip()
