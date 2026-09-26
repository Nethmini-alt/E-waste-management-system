from uuid import UUID
from pydantic import BaseModel, Field


# ---- Input: the raw submission, fetched from ASP.NET Core ----

class SubmissionSnapshot(BaseModel):
    submission_id: UUID = Field(alias="submissionId")
    submission_type: str = Field(alias="submissionType")   # "Household" | "Corporate"
    description: str = ""
    image_urls: list[str] = Field(alias="imageUrls", default_factory=list)
    pickup_address: str = Field(alias="pickupAddress", default="")

    model_config = {"populate_by_name": True}


# ---- Structured LLM output for the first-pass plan ----

class PlanStep(BaseModel):
    step_number: int
    agent_name: str        # "Analyzer" | "Validator" | "Matcher"
    reason: str             # one line: why this step is needed for this submission


class PlanOutput(BaseModel):
    """What the LLM is asked to produce, via structured output."""
    steps: list[PlanStep]
    skip_matcher: bool = Field(
        default=False,
        description="True only if this is a pre-scheduled corporate pickup that "
                    "doesn't need collector matching.",
    )
    reasoning: str


# ---- HTTP contract: /plan ----

class PlanRequest(BaseModel):
    workflow_id: UUID = Field(alias="workflowId")
    submission_id: UUID = Field(alias="submissionId")

    model_config = {"populate_by_name": True}


class PlanResponse(BaseModel):
    workflow_id: UUID = Field(alias="workflowId")
    steps: list[PlanStep]
    skip_matcher: bool = Field(alias="skipMatcher")
    reasoning: str

    model_config = {"populate_by_name": True}


# ---- HTTP contract: /finalize ----

class FinalizeRequest(BaseModel):
    workflow_id: UUID = Field(alias="workflowId")
    analyzer_result: dict = Field(alias="analyzerResult")
    validator_result: dict = Field(alias="validatorResult")
    matcher_result: dict | None = Field(alias="matcherResult", default=None)

    model_config = {"populate_by_name": True}


class FinalizeResponse(BaseModel):
    workflow_id: UUID = Field(alias="workflowId")
    final_reasoning_summary: str = Field(alias="finalReasoningSummary")
    ready_for_job_creation: bool = Field(alias="readyForJobCreation")

    model_config = {"populate_by_name": True}
