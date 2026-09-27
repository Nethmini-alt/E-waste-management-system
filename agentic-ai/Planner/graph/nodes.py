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


def _field(source: dict | None, camel: str, snake: str, default=None):
    """Read a key the .NET orchestrator sends in camelCase, falling back to snake_case."""
    if not source:
        return default
    if camel in source:
        return source[camel]
    return source.get(snake, default)


async def finalize_node(state: PlannerState) -> PlannerState:
    analyzer = state.get("analyzer_result") or {}
    validator = state.get("validator_result") or {}
    matcher = state.get("matcher_result")

    # WorkflowOrchestrationService posts these with HttpClient's JSON
    # defaults, so keys arrive camelCase: analyzer {wasteCategory,
    # hazardLevel}, validator {approvedForAutoAssignment,
    # requiresHumanApproval, reasons}, matcher {recommendedCollectorId,
    # autoAssign, ambiguous, reasoning}.
    waste_category = _field(analyzer, "wasteCategory", "waste_category") or "an unclassified item"
    hazard_level = _field(analyzer, "hazardLevel", "hazard_level") or "unknown"
    validator_flagged = bool(_field(validator, "requiresHumanApproval", "requires_human_approval"))
    reasons = _field(validator, "reasons", "reasons") or []
    auto_assigned = bool(_field(matcher, "autoAssign", "auto_assign"))
    collector_id = _field(matcher, "recommendedCollectorId", "recommended_collector_id")

    # Readiness does NOT depend on the fields above:
    #  - Validator's flag: Finalize only runs once every PendingApproval pause
    #    (Validator's escalation, and the Matcher's suggest-only confirmation)
    #    has been approved by an admin, so the flag was already resolved by a
    #    human and must not block job creation here.
    #  - No collector found: still ready. JobService creates the job with
    #    status NoCollectorAvailable, and staff assign it from Collection.
    ready = True

    llm = _get_llm()
    parts = [
        f"Analyzer classified this as {waste_category} with hazard level {hazard_level}.",
        f"Validator {'flagged this for human review' if validator_flagged else 'cleared this automatically'}"
        + (f": {'; '.join(r.rstrip('.') for r in reasons)}." if reasons else "."),
    ]
    if matcher:
        parts.append(
            f"Matcher {'auto-assigned' if auto_assigned else 'proposed'} "
            f"collector {collector_id or '(none found)'}."
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
