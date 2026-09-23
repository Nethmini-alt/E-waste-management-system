"""Validator's allow-listed tools — only two: read the current rules, write the decision."""

from uuid import UUID

import httpx

from config import settings
from schemas import BusinessRules


def _headers() -> dict:
    return {"X-Agent-Key": settings.agent_api_key}


async def _get(path: str):
    async with httpx.AsyncClient(base_url=settings.api_base_url, timeout=30.0) as client:
        r = await client.get(path, headers=_headers())
        r.raise_for_status()
        return r.json()


async def _post(path: str, payload: dict):
    async with httpx.AsyncClient(base_url=settings.api_base_url, timeout=30.0) as client:
        r = await client.post(path, json=payload, headers=_headers())
        r.raise_for_status()
        return r.json()


# ---------- Tool 1: getBusinessRules ----------

async def get_business_rules() -> BusinessRules:
    try:
        data = await _get("/api/agent/business-rules")
        return BusinessRules(**data)
    except Exception:
        # Safe failure: if the backend can't tell us the current thresholds,
        # fall back to the strictest built-in defaults rather than guessing —
        # never silently approve on missing information.
        return BusinessRules()


# ---------- Tool 2: submitValidation ----------

async def submit_validation(workflow_id: UUID, result: dict) -> dict:
    payload = {
        "approvedForAutoAssignment": result["approved_for_auto_assignment"],
        "requiresHumanApproval": result["requires_human_approval"],
        "reasons": result["reasons"],
    }
    return await _post(f"/api/agent/workflows/{workflow_id}/validator-result", payload)


# ---------- Tool 3: logExecution ----------

async def log_execution(workflow_id: UUID, step_number: int, input_json: dict,
                         output_json: dict | None, succeeded: bool, error_message: str | None) -> None:
    payload = {
        "workflowId": str(workflow_id),
        "agentName": "Validator",
        "stepNumber": step_number,
        "inputJson": input_json,
        "outputJson": output_json,
        "succeeded": succeeded,
        "errorMessage": error_message,
    }
    try:
        await _post("/api/agent/execution-logs", payload)
    except Exception:
        pass
