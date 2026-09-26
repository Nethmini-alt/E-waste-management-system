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

    model_config = {"populate_by_name": True}