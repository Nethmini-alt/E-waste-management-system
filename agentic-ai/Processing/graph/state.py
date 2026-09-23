from typing import TypedDict

from schemas import AnalyzerResult, BusinessRules


class ValidatorState(TypedDict, total=False):
    workflow_id: str
    submission_id: str
    analyzer_result: AnalyzerResult
    rules: BusinessRules

    approved_for_auto_assignment: bool
    requires_human_approval: bool
    reasons: list[str]
