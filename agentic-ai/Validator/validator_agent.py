"""
Validator / Safety Agent - Component C's distinct Agentic AI contribution.

RESPONSIBILITY
    Decide whether a proposed outcome may proceed automatically, must pause for a human, or must
    be rejected. It never classifies, prices, plans or writes to the database.

TWO GATES, ONE CONTRACT (`ValidatorDecision`)
    1. Intake gate  (used by the assessed workflow, after the Analyzer)
         Input : IntakeValidationInput   (Analyzer output + submission facts)
         Logic : Validator/validator_rules.py - pure, deterministic, no LLM, no network
         Tools : none needed (least privilege: nothing is granted that is not used)
    2. Classification gate (used at the facility, for an existing inventory item)
         Input : ClassificationValidationInput
         Tool  : validate_classification -> POST /api/v1/inventory/{id}/validate-classification
                 (Component C's own read-only endpoint; the ONLY tool this agent is allow-listed for)

WHY NO LLM HERE
    The validator is the safety net for every other agent. If a model could talk it out of
    escalating, prompt injection would defeat the whole workflow. So it is deliberately
    rule-based; it is an "agent" because it has a role, an input/output contract, controlled tool
    permissions and visible participation (a StepRecord) in the workflow.

SAFE FAILURE
    If the backend tool fails, times out, or returns garbage, the result is RequiresHumanApproval
    with safe_failure=True. The agent NEVER approves because something broke.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import time
from typing import Awaitable, Callable
from uuid import UUID

from shared.config import get_settings
from shared.contracts import (
    AgentResult, ClassificationValidationInput, Decision, IntakeValidationInput, RuleResult, Severity,
    StepRecord, ValidatorDecision, utcnow,
)
from shared.policies import ValidationPolicy
from shared.tool_catalog import ValidateClassificationResponse
from shared.tool_gateway import ToolCallError, ToolGateway
from Validator.validator_rules import decide, run_intake_rules

VALIDATOR_TOOLS = ("validate_classification",)  # allow-list (enforced by ToolGateway)

# Backend enum: Reusable=0, LocalRecyclable=1, Hazardous=2, ExportOnly=3
_CATEGORY_CODES = {"reusable": 0, "localrecyclable": 1, "hazardous": 2, "exportonly": 3}


def _category_code(value: int | str) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if 0 <= value <= 3 else None
    key = str(value).strip().lower().replace(" ", "").replace("_", "").replace("-", "")
    if key.isdigit():
        return _category_code(int(key))
    return _CATEGORY_CODES.get(key)


class ValidatorAgent:
    name = "validator"

    def __init__(self, gateway: ToolGateway | None = None, policy: ValidationPolicy | None = None) -> None:
        self._gateway = gateway
        self.policy = policy or ValidationPolicy()

    # ------------------------------------------------------------------ intake gate
    def validate_intake(self, data: IntakeValidationInput) -> AgentResult:
        started_at, t0 = utcnow(), time.perf_counter()
        checks = run_intake_rules(data, self.policy)
        decision = decide(checks, self.policy.version, mode="intake")

        step = StepRecord(
            workflow_id=data.workflow_id, agent=self.name, step_name="intake_gate",
            status="succeeded", started_at=started_at,
            duration_ms=int((time.perf_counter() - t0) * 1000),
            input_summary={  # summaries only: raw user text is not copied into the audit trail
                "submission_id": data.submission_id,
                "description_chars": len(data.description or ""),
                "image_count": data.image_count,
                "has_coordinates": data.pickup_latitude is not None,
                "analysis_present": bool(data.analysis),
            },
            output={"decision": decision.decision.value, "severity": decision.severity.value,
                    "reasons": decision.reasons, "policy_version": decision.policy_version},
            checks=[c.model_dump(mode="json") for c in checks],
        )
        return AgentResult(output=decision, step=step)

    # ------------------------------------------------------------ classification gate
    async def validate_classification(self, data: ClassificationValidationInput) -> AgentResult:
        started_at, t0 = utcnow(), time.perf_counter()
        gateway = self._require_gateway()
        version = self.policy.version
        error: str | None = None
        retries = 0

        code = _category_code(data.proposed_category)
        local_problem = self._local_classification_problem(data, code)
        if local_problem:
            decision = decide([RuleResult(code="input_valid", passed=False, outcome="reject",
                                          severity=Severity.MEDIUM, message=local_problem)],
                              version, mode="classification")
        else:
            try:
                response: ValidateClassificationResponse = await gateway.call(
                    "validate_classification",
                    path_params={"item_id": data.inventory_item_id},
                    payload={"proposed_category": code,
                             "proposed_sub_category": data.proposed_sub_category,
                             "confidence_score": data.confidence_score},
                )
                decision = self._map_backend_response(response, version)
            except ToolCallError as exc:
                error = str(exc)
                decision = decide(
                    [RuleResult(code="validation_tool_available", passed=False, outcome="human",
                                severity=Severity.HIGH,
                                message="Classification could not be verified (validation tool failed); "
                                        "escalated to a person instead of approving.")],
                    version, mode="classification", safe_failure=True)

        calls = gateway.drain()
        retries = sum(max(0, c.attempts - 1) for c in calls)
        step = StepRecord(
            workflow_id=data.workflow_id, agent=self.name, step_name="classification_gate",
            status="failed" if error else "succeeded", started_at=started_at,
            duration_ms=int((time.perf_counter() - t0) * 1000),
            input_summary={"inventory_item_id": data.inventory_item_id, "proposed_category_code": code,
                           "confidence_score": data.confidence_score},
            output={"decision": decision.decision.value, "severity": decision.severity.value,
                    "reasons": decision.reasons, "safe_failure": decision.safe_failure},
            checks=[c.model_dump(mode="json") for c in decision.checks],
            tool_calls=calls, retries=retries, error=error,
        )
        return AgentResult(output=decision, step=step)

    # ------------------------------------------------------------------- helpers
    def _require_gateway(self) -> ToolGateway:
        if self._gateway is None:
            self._gateway = ToolGateway(self.name, VALIDATOR_TOOLS, get_settings())
        return self._gateway

    @staticmethod
    def _local_classification_problem(data: ClassificationValidationInput, code: int | None) -> str | None:
        try:
            UUID(str(data.inventory_item_id))
        except ValueError:
            return "inventory_item_id is not a valid UUID."
        if code is None:
            return "proposed_category must be 0-3 or one of Reusable, LocalRecyclable, Hazardous, ExportOnly."
        if data.confidence_score is not None and not (0 <= data.confidence_score <= 1):
            return "confidence_score must be between 0 and 1."
        if data.proposed_sub_category and len(data.proposed_sub_category) > 100:
            return "proposed_sub_category exceeds 100 characters."
        return None

    @staticmethod
    def _map_backend_response(resp: ValidateClassificationResponse, version: str) -> ValidatorDecision:
        reasons = "; ".join(resp.reasons) or "No reasons returned."
        if not resp.approved:
            check = RuleResult(code="backend_classification_rules", passed=False, outcome="reject",
                               severity=Severity.MEDIUM, message=reasons)
        elif resp.requires_human_review:
            check = RuleResult(code="backend_classification_rules", passed=False, outcome="human",
                               severity=Severity.MEDIUM, message=reasons)
        else:
            check = RuleResult(code="backend_classification_rules", passed=True, message=reasons)
        return decide([check], version, mode="classification")


# ======================================================================================
# LangGraph-compatible node (plain async function: no framework import needed here)
# ======================================================================================
def make_validator_node(agent_factory: Callable[[str], ValidatorAgent] | None = None) -> Callable[[dict], Awaitable[dict]]:
    factory = agent_factory or (lambda workflow_id: ValidatorAgent())

    async def validator_node(state: dict) -> dict:
        agent = factory(str(state.get("workflow_id") or "unknown"))
        analysis = state.get("analysis")
        data = IntakeValidationInput(
            workflow_id=str(state.get("workflow_id") or "unknown"),
            submission_id=state.get("submission_id"),
            pickup_address=state.get("pickup_address") or "",
            pickup_latitude=state.get("pickup_latitude"),
            pickup_longitude=state.get("pickup_longitude"),
            description=state.get("description") or "",
            image_count=len(state.get("image_urls") or []),
            analysis=analysis if isinstance(analysis, dict) else None,
        )
        result = agent.validate_intake(data)
        return {"validation": result.output.model_dump(mode="json"),
                "steps": [result.step.model_dump(mode="json")]}

    return validator_node


validator_node = make_validator_node()


# ======================================================================================
# CLI (keeps the old usage working):  python -m Validator.validator_agent <item_id> <category> [confidence]
# ======================================================================================
async def _cli(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run the Validator agent's classification gate.")
    parser.add_argument("inventory_item_id")
    parser.add_argument("proposed_category", help="0-3 or Reusable|LocalRecyclable|Hazardous|ExportOnly")
    parser.add_argument("confidence", nargs="?", type=float)
    parser.add_argument("--sub-category")
    args = parser.parse_args(argv)
    result = await ValidatorAgent().validate_classification(ClassificationValidationInput(
        inventory_item_id=args.inventory_item_id, proposed_category=args.proposed_category,
        proposed_sub_category=args.sub_category, confidence_score=args.confidence))
    print(json.dumps(result.step.model_dump(mode="json"), indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_cli())
