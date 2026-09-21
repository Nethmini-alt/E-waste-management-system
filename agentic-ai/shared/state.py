"""The shared workflow state that flows through the graph. Everything in it is plain JSON
(dicts/lists/strings/numbers), so it can be stored in a PostgreSQL jsonb column unchanged."""
import operator
from typing import Annotated, Any, TypedDict


class WorkflowState(TypedDict, total=False):
    # ---- inputs (from ASP.NET Core) ----
    workflow_id: str
    submission_id: str
    submission_type: str
    objective: str
    pickup_address: str
    pickup_latitude: float
    pickup_longitude: float
    description: str               # all untrusted item text joined (also what injection screening reads)
    items: list[dict[str, Any]]
    csv_items: list[dict[str, Any]]
    preferred_window_start: str
    preferred_window_end: str
    exclude_collector_ids: list[str]
    revision_count: int

    # ---- produced by agents ----
    plan: dict[str, Any]           # Planner
    analysis: dict[str, Any]       # Analyzer   (None/absent on failure - never fabricated)
    validation: dict[str, Any]     # Validator
    match: dict[str, Any]          # Matcher
    proposal: dict[str, Any]       # Planner (final)
    outcome: str                   # PendingApproval | ReadyForAutoAssignment | SafeFailure
    failure_reason: str

    # ---- append-only channels (reducers) ----
    completed_steps: Annotated[list[str], operator.add]
    steps: Annotated[list[dict[str, Any]], operator.add]   # StepRecords (the audit trail)
    errors: Annotated[list[str], operator.add]
