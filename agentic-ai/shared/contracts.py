"""Typed input/output contracts for the Matcher (B) and Validator (C) agents.

Every agent has: an identifiable responsibility, a defined input contract, a defined output
contract, controlled tool permissions, and a StepRecord that makes its participation visible.
Contracts are plain Pydantic models; workflow state carries them as JSON-safe dicts so they can
be stored in a PostgreSQL jsonb column later without conversion.
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------------------
# Shared enums
# --------------------------------------------------------------------------------------
class Severity(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"

    @property
    def rank(self) -> int:
        return ("Low", "Medium", "High", "Critical").index(self.value)


class HazardLevel(str, Enum):
    NONE = "None"
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"

    @property
    def rank(self) -> int:
        return ("None", "Low", "Medium", "High", "Critical").index(self.value)


# --------------------------------------------------------------------------------------
# Analyzer output = the contract every downstream agent relies on.
# --------------------------------------------------------------------------------------
WASTE_TAXONOMY: tuple[str, ...] = (
    "Household Electronics", "IT Equipment", "Mobile Devices", "Batteries",
    "Heavy Appliances", "Cables and Accessories", "Lighting", "Other",
)
HANDLING_PATHS: tuple[str, ...] = ("Local reuse", "Local recycle", "Export")

class AnalyzerOutput(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    waste_categories: list[str] = Field(alias="wasteCategories", min_length=1, max_length=20)
    hazard_level: HazardLevel = Field(alias="hazardLevel")
    estimated_volume_kg: float = Field(alias="estimatedVolumeKg", gt=0, allow_inf_nan=False)
    # Currency is LKR everywhere in this service (approved pricing in the backend is Rs./kg).
    estimated_value_lkr: float = Field(alias="estimatedValueLkr", ge=0, allow_inf_nan=False)
    confidence_score: float | None = Field(default=None, alias="confidenceScore", ge=0, le=1)
    is_ewaste: bool | None = Field(default=None, alias="isEwaste")
    recommended_handling: Literal["Local reuse", "Local recycle", "Export"] | None = Field(
        default=None, alias="recommendedHandling")
    # The Analyzer's own opinion. The Validator may ESCALATE on it but can never be relaxed by it.
    analyzer_requested_approval: bool = Field(default=False, alias="requiresHumanApproval")

    @model_validator(mode="before")
    @classmethod
    def _accept_single_category(cls, data: Any) -> Any:
        if isinstance(data, dict) and "wasteCategories" not in data and "waste_categories" not in data:
            single = data.get("wasteCategory") or data.get("waste_category")
            if isinstance(single, str):
                return {**data, "wasteCategories": [single]}
        return data

    @field_validator("hazard_level", mode="before")
    @classmethod
    def _normalise_hazard(cls, v: Any) -> Any:
        return v.strip().title() if isinstance(v, str) else v

    @field_validator("waste_categories")
    @classmethod
    def _clean_categories(cls, v: list[str]) -> list[str]:
        cleaned = [c.strip() for c in v if isinstance(c, str) and c.strip()]
        if not cleaned:
            raise ValueError("at least one non-empty category is required")
        if any(len(c) > 80 for c in cleaned):
            raise ValueError("category label longer than 80 characters")
        return cleaned


# --------------------------------------------------------------------------------------
# Validator (Component C)
# --------------------------------------------------------------------------------------
class Decision(str, Enum):
    APPROVED = "ApprovedForAutoAssignment"
    REQUIRES_HUMAN = "RequiresHumanApproval"
    REJECTED = "Rejected"


class RuleResult(BaseModel):
    code: str
    passed: bool
    # What happens if this rule fails: stop the workflow, or pause for a human. None when passed.
    outcome: Literal["reject", "human"] | None = None
    severity: Severity = Severity.LOW
    message: str = ""


class ValidatorDecision(BaseModel):
    decision: Decision
    severity: Severity
    reasons: list[str] = Field(default_factory=list)   # failing checks, most severe first
    checks: list[RuleResult] = Field(default_factory=list)  # full audit list (passed + failed)
    policy_version: str
    mode: Literal["intake", "classification"] = "intake"
    safe_failure: bool = False  # True when a tool failed and we escalated instead of approving


class IntakeValidationInput(BaseModel):
    workflow_id: str = Field(min_length=1, max_length=64)
    submission_id: str | None = None
    pickup_address: str = ""
    pickup_latitude: float | None = None
    pickup_longitude: float | None = None
    description: str = ""          # UNTRUSTED user text
    image_count: int = Field(default=0, ge=0)
    analysis: dict[str, Any] | None = None  # raw Analyzer output; parsed inside the gate


class ClassificationValidationInput(BaseModel):
    inventory_item_id: str
    proposed_category: int | str  # 0..3 or a name such as "LocalRecyclable"
    proposed_sub_category: str | None = None
    confidence_score: float | None = None
    workflow_id: str = "n/a"


# --------------------------------------------------------------------------------------
# Matcher (Component B)
# --------------------------------------------------------------------------------------
class MatcherStatus(str, Enum):
    # First three names intentionally mirror the backend's JobStatus values.
    MATCHED = "Matched"
    NO_COLLECTOR = "NoCollectorAvailable"
    LOCATION_UNRESOLVED = "PickupLocationUnresolved"
    TOOL_FAILURE = "ToolFailure"
    INVALID_INPUT = "InvalidInput"
    SKIPPED = "Skipped"


class SelectionMethod(str, Enum):
    DETERMINISTIC = "deterministic"
    LLM_VALIDATED = "llm_validated"
    FALLBACK_AFTER_LLM = "fallback_after_llm_failure"


class MatcherInput(BaseModel):
    workflow_id: str = Field(min_length=1, max_length=64)
    pickup_address: str = Field(default="", max_length=300)
    pickup_latitude: float | None = Field(default=None, ge=-90, le=90)
    pickup_longitude: float | None = Field(default=None, ge=-180, le=180)
    estimated_volume_kg: float = Field(gt=0, allow_inf_nan=False)
    preferred_window_start: datetime | None = None
    preferred_window_end: datetime | None = None
    exclude_collector_ids: list[UUID] = Field(default_factory=list)

    @model_validator(mode="after")
    def _coords_together(self) -> "MatcherInput":
        if (self.pickup_latitude is None) != (self.pickup_longitude is None):
            raise ValueError("pickup_latitude and pickup_longitude must be provided together")
        if self.pickup_latitude is None and len(self.pickup_address.strip()) < 5:
            raise ValueError("either coordinates or a pickup address of at least 5 characters is required")
        for name in ("preferred_window_start", "preferred_window_end"):
            v = getattr(self, name)
            if v is not None and v.tzinfo is None:  # naive -> treat as UTC (documented behaviour)
                setattr(self, name, v.replace(tzinfo=timezone.utc))
        return self


class CollectorCandidate(BaseModel):
    collector_id: UUID
    vehicle_type: str
    capacity_kg: float
    rating: float
    active_job_count: int
    distance_km: float | None = None
    eta_minutes: int | None = None
    score: float = 0.0
    score_breakdown: dict[str, float] = Field(default_factory=dict)


class MatcherOutput(BaseModel):
    status: MatcherStatus
    recommended_collector_id: UUID | None = None
    candidates: list[CollectorCandidate] = Field(default_factory=list)  # ranked, best first
    pickup_latitude: float | None = None
    pickup_longitude: float | None = None
    required_capacity_kg: float | None = None
    distance_km: float | None = None
    eta_minutes: int | None = None
    proposed_window_start: datetime | None = None
    proposed_window_end: datetime | None = None
    selection_method: SelectionMethod = SelectionMethod.DETERMINISTIC
    rationale: str = ""   # short, staff-facing justification. NOT hidden reasoning.
    warnings: list[str] = Field(default_factory=list)
    policy_version: str = ""


# --------------------------------------------------------------------------------------
# Observability records (one StepRecord per agent run; orchestrator persists them)
# --------------------------------------------------------------------------------------
class ToolCallRecord(BaseModel):
    tool: str
    agent: str
    ok: bool = False
    attempts: int = 0
    status_code: int | None = None
    duration_ms: int = 0
    input_summary: dict[str, Any] = Field(default_factory=dict)  # personal data is redacted
    error: str | None = None


class StepRecord(BaseModel):
    workflow_id: str
    agent: str
    step_name: str
    status: Literal["succeeded", "failed", "skipped"]
    started_at: datetime
    duration_ms: int
    input_summary: dict[str, Any] = Field(default_factory=dict)
    output: dict[str, Any] = Field(default_factory=dict)
    checks: list[dict[str, Any]] = Field(default_factory=list)  # deterministic validation results
    tool_calls: list[ToolCallRecord] = Field(default_factory=list)
    retries: int = 0   # total tool retries + LLM retries in this step
    error: str | None = None


class AgentResult(BaseModel):
    output: Any
    step: StepRecord


# --------------------------------------------------------------------------------------
# Workflow API (what ASP.NET Core sends to main.py) - accepts camelCase or snake_case
# --------------------------------------------------------------------------------------
class _ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


class SubmissionItemIn(_ApiModel):
    item_name: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=2000)
    image_url: str | None = Field(default=None, max_length=1000)


class CsvRow(_ApiModel):
    item_type: str = Field(min_length=1, max_length=80)
    quantity: int = Field(ge=1, le=100_000)
    weight_kg: float | None = Field(default=None, gt=0, le=100_000, allow_inf_nan=False)  # total for the row
    condition: str | None = Field(default=None, max_length=40)


class StartWorkflowRequest(_ApiModel):
    workflow_id: UUID
    submission_id: UUID
    submission_type: Literal["Household", "Corporate"] = "Household"
    objective: str | None = Field(default=None, max_length=500)
    pickup_address: str = Field(default="", max_length=300)
    pickup_latitude: float | None = Field(default=None, ge=-90, le=90)
    pickup_longitude: float | None = Field(default=None, ge=-180, le=180)
    items: list[SubmissionItemIn] = Field(default_factory=list, max_length=20)
    csv_items: list[CsvRow] = Field(default_factory=list, max_length=200)
    preferred_window_start: datetime | None = None
    preferred_window_end: datetime | None = None

    @model_validator(mode="after")
    def _has_content(self) -> "StartWorkflowRequest":
        if not self.items and not self.csv_items:
            raise ValueError("a submission needs at least one item or CSV row")
        return self


class RevisionFeedback(_ApiModel):
    exclude_collector_ids: list[UUID] = Field(default_factory=list, max_length=50)
    preferred_window_start: datetime | None = None
    preferred_window_end: datetime | None = None
    notes: str = Field(default="", max_length=500)   # staff note: audit only, never sent to an LLM


class ReviseRequest(_ApiModel):
    feedback: RevisionFeedback
    # Optional: the state .NET stored, for when this service no longer holds the workflow in memory.
    previous_state: dict[str, Any] | None = None


class WorkflowAccepted(BaseModel):
    workflow_id: str
    status: Literal["Running"] = "Running"


# --------------------------------------------------------------------------------------
# Planner (Component D)
# --------------------------------------------------------------------------------------
AgentName = Literal["analyzer", "validator", "matcher", "planner"]


class PlanFlag(str, Enum):
    DATA_BEARING_DEVICES = "data_bearing_devices"   # informational: Processing must certify data wiping
    BULK_LOAD = "bulk_load"                         # informational
    URGENT_PICKUP = "urgent_pickup"                 # informational
    HEAVY_OR_FRAGILE = "heavy_or_fragile"           # informational: needs a suitable vehicle
    SUSPICIOUS_REQUEST = "suspicious_request"       # ESCALATES: forces human approval


class PlanStep(BaseModel):
    id: str
    agent: AgentName
    action: str
    description: str
    depends_on: list[str] = Field(default_factory=list)


class Plan(BaseModel):
    steps: list[PlanStep]
    flags: list[PlanFlag] = Field(default_factory=list)
    strategy: str = ""
    created_by: Literal["template", "template+llm"] = "template"
    policy_version: str = ""


class HandlingPath(str, Enum):
    LOCAL_REUSE = "LocalReuse"
    LOCAL_RECYCLE = "LocalRecycle"
    EXPORT = "Export"
    MANUAL = "ManualDecision"


class Proposal(BaseModel):
    outcome: Literal["PendingApproval", "ReadyForAutoAssignment"]
    handling_path: HandlingPath
    gross_value_lkr: float
    estimated_costs_lkr: float
    estimated_net_value_lkr: float
    eligible_local_buyers: int | None = None     # None = could not be verified
    eligible_export_buyers: int | None = None
    recommended_collector_id: UUID | None = None
    eta_minutes: int | None = None
    pickup_window_start: datetime | None = None
    pickup_window_end: datetime | None = None
    approval_required: bool
    approval_reasons: list[str] = Field(default_factory=list)
    risk_flags: list[str] = Field(default_factory=list)
    summary: str = ""
    policy_version: str = ""
