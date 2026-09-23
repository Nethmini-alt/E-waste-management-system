from uuid import UUID
from pydantic import BaseModel, Field


# ---- Structured LLM output ----

class ClassificationOutput(BaseModel):
    waste_category: str = Field(description="e.g. Household Electronics, Batteries, IT Equipment, Heavy Appliances")
    hazard_level: str = Field(description="Low, Medium, High, or Critical")
    estimated_volume_kg: float
    estimated_value_usd: float
    confidence_score: float = Field(description="0.0 to 1.0 — how confident the classification is")


# ---- HTTP contract: /run ----

class AnalyzerRunRequest(BaseModel):
    workflow_id: UUID = Field(alias="workflowId")
    submission_id: UUID = Field(alias="submissionId")

    model_config = {"populate_by_name": True}


class AnalyzerRunResponse(BaseModel):
    workflow_id: UUID = Field(alias="workflowId")
    waste_category: str = Field(alias="wasteCategory")
    hazard_level: str = Field(alias="hazardLevel")
    estimated_volume_kg: float = Field(alias="estimatedVolumeKg")
    estimated_value_usd: float = Field(alias="estimatedValueUsd")
    confidence_score: float = Field(alias="confidenceScore")

    model_config = {"populate_by_name": True}


# ---- Internal: the raw submission fetched from the backend ----

class SubmissionSnapshot(BaseModel):
    submission_id: UUID = Field(alias="submissionId")
    description: str = ""
    image_urls: list[str] = Field(alias="imageUrls", default_factory=list)

    model_config = {"populate_by_name": True}
