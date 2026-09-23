"""
Planner's allow-listed tools — the only things this agent is permitted to do
outside its own reasoning. Both calls go to ASP.NET Core; Planner never talks
to Analyzer, Validator or Matcher directly (see the team's orchestration
design — the backend is the only thing that calls agents, and agents only
call the backend back).
"""

from uuid import UUID

import httpx

from config import settings
from schemas import SubmissionSnapshot


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


# ---------- Tool 1: getSubmission ----------

async def get_submission(submission_id: UUID) -> SubmissionSnapshot:
    data = await _get(f"/api/agent/submissions/{submission_id}")
    return SubmissionSnapshot(**data)


# ---------- Tool 2: submitPlan ----------

async def submit_plan(workflow_id: UUID, steps: list, skip_matcher: bool, reasoning: str) -> dict:
    payload = {
        "planJson": [s.model_dump() for s in steps],
        "skipMatcher": skip_matcher,
        "reasoning": reasoning,
    }
    return await _post(f"/api/agent/workflows/{workflow_id}/plan", payload)


# ---------- Tool 3: submitFinalPlan ----------

async def submit_final_plan(workflow_id: UUID, reasoning_summary: str, ready_for_job_creation: bool) -> dict:
    payload = {
        "finalReasoningSummary": reasoning_summary,
        "readyForJobCreation": ready_for_job_creation,
    }
    return await _post(f"/api/agent/workflows/{workflow_id}/finalize", payload)


# ---------- Tool 4: logExecution (observability) ----------

async def log_execution(workflow_id: UUID, step_number: int, input_json: dict,
                         output_json: dict | None, succeeded: bool, error_message: str | None) -> None:
    payload = {
        "workflowId": str(workflow_id),
        "agentName": "Planner",
        "stepNumber": step_number,
        "inputJson": input_json,
        "outputJson": output_json,
        "succeeded": succeeded,
        "errorMessage": error_message,
    }
    try:
        await _post("/api/agent/execution-logs", payload)
    except Exception:
        pass  # observability must never break the run it's observing
