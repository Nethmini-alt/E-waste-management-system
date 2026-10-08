"""
TC-AI-B-019 .. 021 — the Matcher's allow-listed tools (tools/collection_tools.py).
The backend is mocked at the HTTP level with respx, so the real httpx code runs.
"""

import json
import uuid

import httpx
import pytest
import respx

from config import settings
from tools import collection_tools as tools


@pytest.mark.asyncio
@respx.mock
async def test_TC_AI_B_019_candidate_lookup_sends_agent_key_and_contract(monkeypatch):
    monkeypatch.setattr(settings, "agent_api_key", "test-key")
    excluded = uuid.uuid4()
    route = respx.post(f"{settings.api_base_url}/api/v1/collectors/match").mock(
        return_value=httpx.Response(200, json=[{
            "collectorId": str(uuid.uuid4()), "vehicleType": "Lorry", "capacityKg": 500,
            "rating": 4.5, "activeJobCount": 0, "distanceKm": 2.0, "etaMinutes": 6,
        }]))

    result = await tools.get_ranked_candidates(6.9, 79.8, required_capacity_kg=12, exclude_collector_ids=[excluded])

    sent = route.calls.last.request
    assert sent.headers["X-Agent-Key"] == "test-key"
    assert json.loads(sent.content) == {
        "pickupLatitude": 6.9, "pickupLongitude": 79.8, "requiredCapacityKg": 12,
        "excludeCollectorIds": [str(excluded)], "maxResults": 3,
    }
    assert result[0].vehicle_type == "Lorry"


@pytest.mark.asyncio
@respx.mock
async def test_TC_AI_B_020_rejected_agent_key_raises_instead_of_returning_no_candidates():
    # A 401 must surface as an error, never be mistaken for "no collectors available".
    respx.post(f"{settings.api_base_url}/api/v1/collectors/match").mock(return_value=httpx.Response(401))

    with pytest.raises(httpx.HTTPStatusError):
        await tools.get_ranked_candidates(6.9, 79.8)


@pytest.mark.asyncio
@respx.mock
async def test_TC_AI_B_021_execution_logging_never_breaks_the_run():
    respx.post(f"{settings.api_base_url}/api/agent/execution-logs").mock(side_effect=httpx.ConnectError("down"))

    # Must not raise: losing a log line is not worth failing the collection workflow.
    assert await tools.log_execution(uuid.uuid4(), 4, {}, None, True, None) is None
