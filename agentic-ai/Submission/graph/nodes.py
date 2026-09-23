"""
Analyzer node — Component A's distinct Agentic AI contribution.

This is the migrated version of the classification logic that used to live
in the old top-level agentic-ai/main.py (analyze_with_gemini). Same idea —
Gemini looks at the description + first photo and classifies the item — but
restructured to run synchronously inside the orchestrated chain instead of
as a fire-and-forget background task with a callback.
"""

import base64

import httpx
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from config import settings
from graph.state import AnalyzerState

DEFAULT_RESULT = {
    "waste_category": "Uncategorized",
    "hazard_level": "Medium",
    "estimated_volume_kg": 1.0,
    "estimated_value_usd": 0.0,
    "confidence_score": 0.0,
}


def _get_llm() -> ChatGoogleGenerativeAI | None:
    if not settings.google_api_key:
        return None
    return ChatGoogleGenerativeAI(
        model=settings.chat_model,
        google_api_key=settings.google_api_key,
        temperature=0,
        timeout=30,
        max_retries=2,
    )


async def _fetch_image_as_data_url(url: str) -> str | None:
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=10.0)
            if resp.status_code == 200:
                b64 = base64.b64encode(resp.content).decode("utf-8")
                return f"data:image/jpeg;base64,{b64}"
    except Exception:
        pass
    return None


async def classify_node(state: AnalyzerState) -> AnalyzerState:
    submission = state["submission"]
    llm = _get_llm()

    if llm is None:
        return {**state, **DEFAULT_RESULT, "errors": ["GOOGLE_API_KEY not configured — used default fallback."]}

    prompt_text = (
        "You are an expert E-Waste Management Inspector. Analyze this electronic "
        "waste item and return a structured classification.\n\n"
        f"User description: {submission.description or '(none provided)'}"
    )

    content: list = [{"type": "text", "text": prompt_text}]
    if submission.image_urls:
        image_data_url = await _fetch_image_as_data_url(submission.image_urls[0])
        if image_data_url:
            content.append({"type": "image_url", "image_url": image_data_url})

    from schemas import ClassificationOutput

    max_retries = 3
    last_error: str | None = None
    for attempt in range(max_retries):
        try:
            result: ClassificationOutput = await llm.with_structured_output(
                ClassificationOutput
            ).ainvoke([HumanMessage(content=content)])
            return {
                **state,
                "waste_category": result.waste_category,
                "hazard_level": result.hazard_level,
                "estimated_volume_kg": result.estimated_volume_kg,
                "estimated_value_usd": result.estimated_value_usd,
                "confidence_score": result.confidence_score,
            }
        except Exception as exc:
            last_error = str(exc)
            continue  # simple retry, mirrors the old code's 3-attempt loop

    # All retries exhausted — safe fallback, flagged for human review via low confidence
    return {
        **state,
        **DEFAULT_RESULT,
        "errors": [f"Classification failed after {max_retries} attempts: {last_error}"],
    }
