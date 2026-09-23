"""
Matcher's allow-listed tools.

get_ranked_candidates calls the backend's EXISTING POST /api/v1/collectors/match
endpoint (see Features/Collection/Controllers/CollectorsController.cs) — the
same endpoint the backend's own reject-and-reassign flow relies on. Matcher
does not rank collectors itself.
"""

from uuid import UUID

import httpx

from config import settings
from schemas import CollectorMatch


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


# ---------- Tool 1: getRankedCandidates ----------

async def get_ranked_candidates(
    pickup_latitude: float,
    pickup_longitude: float,
    required_capacity_kg: float | None = None,
    exclude_collector_ids: list[UUID] | None = None,
    max_results: int = 3,
) -> list[CollectorMatch]:
    payload = {
        "pickupLatitude": pickup_latitude,
        "pickupLongitude": pickup_longitude,
        "requiredCapacityKg": required_capacity_kg,
        "excludeCollectorIds": [str(c) for c in (exclude_collector_ids or [])],
        "maxResults": max_results,
    }
    data = await _post("/api/v1/collectors/match", payload)
    return [CollectorMatch(**c) for c in data]


# ---------- Tool 2: submitMatchingResult ----------

async def submit_matching_result(workflow_id: UUID, result: dict) -> dict:
    payload = {
        "rankedCollectors": [r.model_dump(mode="json", by_alias=True) for r in result["ranked"]],
        "recommendedCollectorId": result["recommended_collector_id"],
        "autoAssign": result["auto_assign"],
        "ambiguous": result["ambiguous"],
        "reasoning": result["reasoning"],
    }
    return await _post(f"/api/agent/workflows/{workflow_id}/matcher-result", payload)


# ---------- Tool 3: logExecution ----------

async def log_execution(workflow_id: UUID, step_number: int, input_json: dict,
                         output_json: dict | None, succeeded: bool, error_message: str | None) -> None:
    payload = {
        "workflowId": str(workflow_id),
        "agentName": "Matcher",
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
