from typing import TypedDict

from schemas import SubmissionSnapshot


class AnalyzerState(TypedDict, total=False):
    workflow_id: str
    submission: SubmissionSnapshot

    waste_category: str
    hazard_level: str
    estimated_volume_kg: float
    estimated_value_usd: float
    confidence_score: float

    errors: list[str]
