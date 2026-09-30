from pydantic import BaseModel, Field
from uuid import UUID


# ---- Inputs (from Component C / D via HTTP) ----

class MaterialBatch(BaseModel):
    recovered_material_id: UUID = Field(alias="recoveredMaterialId")
    material_type: str = Field(alias="materialType")
    quantity_kg: float = Field(alias="quantityKg")
    quality_grade: str = Field(alias="qualityGrade")
    processing_status: str = Field(alias="processingStatus")
    safety_validated: bool = Field(alias="safetyValidated")

    model_config = {"populate_by_name": True}


class ApprovedPrice(BaseModel):
    material_type: str = Field(alias="materialType")
    price_per_kg: float = Field(alias="pricePerKg")
    effective_date: str = Field(alias="effectiveDate")

    model_config = {"populate_by_name": True}


class EligibleBuyer(BaseModel):
    buyer_id: UUID = Field(alias="buyerId")
    company_name: str = Field(alias="companyName")
    contact_person: str = Field(alias="contactPerson")
    email: str
    buyer_type: str = Field(alias="buyerType")

    model_config = {"populate_by_name": True}


# ---- Internal working model ----

class MaterialToPlan(BaseModel):
    recovered_material_id: UUID
    material_type: str
    quantity_kg: float
    quality_grade: str
    unit_price: float
    line_value: float


# ---- Output (submitted back to ASP.NET Core) ----

class CommercialPlanSubmission(BaseModel):
    workflowId: UUID = Field(alias="workflowId")
    recommendedRoute: str  # "LocalSale" | "Export"
    selectedBuyerId: UUID | None = Field(alias="selectedBuyerId", default=None)
    destinationCountry: str | None = Field(alias="destinationCountry", default=None)
    materialsJson: str = Field(alias="materialsJson")
    expectedRevenue: float = Field(alias="expectedRevenue")
    estimatedCosts: float = Field(alias="estimatedCosts")
    estimatedNetValue: float = Field(alias="estimatedNetValue")
    reasoningSummary: str = Field(alias="reasoningSummary")
    approvalRequired: bool = Field(alias="approvalRequired", default=True)
    riskFlags: str | None = Field(alias="riskFlags", default=None)

    model_config = {"populate_by_name": True}


# ---- Agent HTTP responses ----

class AgentRunRequest(BaseModel):
    workflow_id: UUID | None = Field(alias="workflowId", default=None)

    # Optional goal filters — when omitted, the agent plans for everything
    target_buyer_id: UUID | None = Field(alias="targetBuyerId", default=None)
    target_material_types: list[str] | None = Field(alias="targetMaterialTypes", default=None)
    max_quantity_kg: float | None = Field(alias="maxQuantityKg", default=None)
    preferred_route: str | None = Field(alias="preferredRoute", default=None)

    # Which objective the route tool should optimise: net_value (default) | margin_per_kg
    priority_objective: str | None = Field(alias="priorityObjective", default=None)

    model_config = {"populate_by_name": True}


class RouteOption(BaseModel):
    """One feasible route (LocalSale | Export) as scored by rank_route_options."""

    route: str
    score: float
    expected_revenue: float = Field(alias="expectedRevenue")
    estimated_costs: float = Field(alias="estimatedCosts")
    estimated_net_value: float = Field(alias="estimatedNetValue")
    net_per_kg: float = Field(alias="netPerKg")
    reason: str

    model_config = {"populate_by_name": True}


class AgentRunResponse(BaseModel):
    workflow_id: UUID = Field(alias="workflowId")
    commercial_plan_id: UUID = Field(alias="commercialPlanId")
    recommended_route: str = Field(alias="recommendedRoute")
    expected_revenue: float = Field(alias="expectedRevenue")
    estimated_net_value: float = Field(alias="estimatedNetValue")
    approval_required: bool = Field(alias="approvalRequired")
    reasoning_summary: str = Field(alias="reasoningSummary")
    risk_flags: list[str] = Field(alias="riskFlags", default_factory=list)

    # Which objective the route tool optimised, and how old the pricing behind the
    # numbers is. Extra fields: the .NET AgentClient ignores what it doesn't map.
    priority_objective: str = Field(alias="priorityObjective", default="net_value")
    pricing_age_days: float | None = Field(alias="pricingAgeDays", default=None)
    route_scores: list[RouteOption] = Field(alias="routeScores", default_factory=list)

    model_config = {"populate_by_name": True}


# ---- Priority queue: ranking competing buyer demand ----

class DemandCandidate(BaseModel):
    """One open material request, as returned by GET /api/agent/material-requests/open."""

    material_request_id: UUID = Field(alias="materialRequestId")
    buyer_id: UUID = Field(alias="buyerId")
    buyer_company_name: str = Field(alias="buyerCompanyName", default="")
    buyer_type: str = Field(alias="buyerType", default="Local")
    material_type: str = Field(alias="materialType", default="")
    quantity_kg: float = Field(alias="quantityKg")
    price_per_kg: float | None = Field(alias="pricePerKg", default=None)
    status: str = Field(default="Waiting")
    waiting_hours: float = Field(alias="waitingHours", default=0.0)
    created_at: str | None = Field(alias="createdAt", default=None)

    model_config = {"populate_by_name": True}


class PrioritizedDemand(BaseModel):
    """A candidate plus the deterministic scoring the objective produced."""

    material_request_id: UUID = Field(alias="materialRequestId")
    buyer_id: UUID = Field(alias="buyerId")
    buyer_company_name: str = Field(alias="buyerCompanyName", default="")
    buyer_type: str = Field(alias="buyerType")
    material_type: str = Field(alias="materialType", default="")
    quantity_kg: float = Field(alias="quantityKg")
    priority_rank: int = Field(alias="priorityRank")
    priority_score: float = Field(alias="priorityScore")
    objective: str
    expected_revenue: float = Field(alias="expectedRevenue")
    expected_net_value: float = Field(alias="expectedNetValue")
    net_per_kg: float = Field(alias="netPerKg")
    cost_rate_applied: float = Field(alias="costRateApplied")
    waiting_hours: float = Field(alias="waitingHours")
    feasible: bool
    factors: dict[str, float] = Field(default_factory=dict)
    rationale: str

    model_config = {"populate_by_name": True}


class PrioritizeDemandRequest(BaseModel):
    material_type: str | None = Field(alias="materialType", default=None)
    capacity_kg: float | None = Field(alias="capacityKg", default=None)
    objective: str | None = Field(alias="objective", default=None)

    # When omitted the agent fetches open demand itself with its own tool, so the
    # endpoint is also usable as a "what should we sell next?" backlog review.
    candidates: list[DemandCandidate] | None = Field(alias="candidates", default=None)

    model_config = {"populate_by_name": True}


class PrioritizeDemandResponse(BaseModel):
    strategy: str
    strategy_reason: str = Field(alias="strategyReason")
    reasoning_summary: str = Field(alias="reasoningSummary")
    ranked: list[PrioritizedDemand]
    candidates_considered: int = Field(alias="candidatesConsidered", default=0)
    capacity_kg: float | None = Field(alias="capacityKg", default=None)
    served_kg: float = Field(alias="servedKg", default=0.0)
    agent_model: str | None = Field(alias="agentModel", default=None)

    model_config = {"populate_by_name": True}


# ---- Structured LLM output (optional; a deterministic fallback exists) ----

class ObjectiveChoice(BaseModel):
    """What the model is asked to pick, via structured output."""

    objective: str = Field(
        description="One of: net_value, throughput, margin_per_kg, fifo, export_first"
    )
    reason: str = Field(
        description="One sentence explaining why this objective fits the backlog described."
    )


class ReasoningNarrative(BaseModel):
    summary: str = Field(
        description="Two sentences for the sales dashboard that keep every number "
                    "from the facts provided and add no new numbers."
    )
