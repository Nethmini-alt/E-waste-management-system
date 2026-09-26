"""
Planner nodes — Component D's coordinator role in the intake chain.

Two passes, matching main.py's two endpoints:
  - create_plan_node   -> POST /plan      (first call, before Analyzer runs)
  - finalize_node       -> POST /finalize  (second call, after Matcher runs
                                             or after Validator blocks it)

Both use an LLM with structured output, the same `with_structured_output`
pattern as the Week 6/7 labs. If GOOGLE_API_KEY isn't configured, both nodes
fall back to a safe, deterministic default rather than failing the run —
mirroring how the original Submission analyzer degraded gracefully when its
key was missing.
"""

from langchain_google_genai import ChatGoogleGenerativeAI

from config import settings
from graph.state import PlannerState
from schemas import PlanOutput, PlanStep


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


DEFAULT_STEPS = [
    PlanStep(step_number=1, agent_name="Analyzer", reason="Classify the submission."),
    PlanStep(step_number=2, agent_name="Validator", reason="Apply safety and business-rule checks."),
    PlanStep(step_number=3, agent_name="Matcher", reason="Find and rank an available collector."),
]


async def create_plan_node(state: PlannerState) -> PlannerState:
    submission = state["submission"]
    llm = _get_llm()

    if llm is None:
        return {
            **state,
            "steps": DEFAULT_STEPS,
            "skip_matcher": False,
            "plan_reasoning": "GOOGLE_API_KEY not configured — using the default "
                               "three-step plan (Analyzer, Validator, Matcher).",
        }

    prompt = (
        "You are the planning agent for an e-waste intake workflow. Given this "
        "submission, decide the ordered steps needed (from Analyzer, Validator, "
        "Matcher) and whether collector matching can be skipped — only skip it "
        "for a Corporate submission whose description clearly states a pickup "
        "has already been scheduled.\n\n"
        f"Submission type: {submission.submission_type}\n"
        f"Description: {submission.description or '(none provided)'}\n"
        f"Pickup address: {submission.pickup_address or '(none provided)'}\n"
        f"Number of photos attached: {len(submission.image_urls)}"
    )

    try:
        result: PlanOutput = await llm.with_structured_output(PlanOutput).ainvoke(prompt)
    except Exception as exc:  # never let a flaky LLM call break the chain
        return {
            **state,
            "steps": DEFAULT_STEPS,
            "skip_matcher": False,
            "plan_reasoning": f"Planning call failed ({exc}); fell back to the default plan.",
        }

    steps = result.steps or DEFAULT_STEPS
    return {
        **state,
        "steps": steps,
        "skip_matcher": result.skip_matcher,
        "plan_reasoning": result.reasoning,
    }


async def finalize_node(state: PlannerState) -> PlannerState:
    analyzer = state.get("analyzer_result", {})
    validator = state.get("validator_result", {})
    matcher = state.get("matcher_result")

    # Deterministic readiness check — Planner doesn't re-judge risk, it just
    # respects whatever Validator (and Matcher's own ambiguous-match check)
    # already decided.
    validator_blocked = bool(validator.get("requires_human_approval"))
    matcher_blocked = bool(matcher and not matcher.get("auto_assign", True) and not matcher.get("recommended_collector_id"))
    ready = not validator_blocked and not matcher_blocked

    llm = _get_llm()
    parts = [
        f"Analyzer classified this as {analyzer.get('categories', 'an unclassified item')} "
        f"with hazard level {analyzer.get('hazard_level', 'unknown')}.",
        f"Validator {'flagged this for human review' if validator_blocked else 'cleared this automatically'}"
        + (f": {', '.join(validator.get('reasons', []))}." if validator.get("reasons") else "."),
    ]
    if matcher:
        parts.append(
            f"Matcher {'auto-assigned' if matcher.get('auto_assign') else 'proposed'} "
            f"collector {matcher.get('recommended_collector_id', '(none found)')}."
        )

    summary = " ".join(parts)

    if llm is not None:
        try:
            prose = await llm.ainvoke(
                "Rewrite this workflow summary in two clear sentences for a staff "
                f"dashboard, keeping every fact: {summary}"
            )
            content = prose.content if hasattr(prose, "content") else summary
            # Some Gemini responses come back as a list of content-part dicts
            # (e.g. a "thought signature" part alongside the text) rather than
            # a plain string. FinalizeResponse.final_reasoning_summary is a
            # str, so passing the list through as-is fails FastAPI's
            # response-model validation with an unhandled 500 on every
            # finalize call that hits this shape.
            if isinstance(content, list):
                content = "".join(
                    part.get("text", "") if isinstance(part, dict) else str(part)
                    for part in content
                ).strip()
            summary = content or summary
        except Exception:
            pass  # fall back to the deterministic summary already built above

    return {
        **state,
        "final_reasoning_summary": summary,
        "ready_for_job_creation": ready,
    }
