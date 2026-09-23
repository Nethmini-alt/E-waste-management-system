from typing import TypedDict

from schemas import SubmissionSnapshot, PlanStep


class PlannerState(TypedDict, total=False):
    # --- Input (first pass) ---
    workflow_id: str
    submission: SubmissionSnapshot

    # --- Output (first pass) ---
    steps: list[PlanStep]
    skip_matcher: bool
    plan_reasoning: str

    # --- Input (second pass / finalize) ---
    analyzer_result: dict
    validator_result: dict
    matcher_result: dict | None

    # --- Output (second pass) ---
    final_reasoning_summary: str
    ready_for_job_creation: bool

    errors: list[str]
