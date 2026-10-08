"""
Shared fixtures for the Matcher agent tests (Component B, owner: Nethmini).

The Matcher never talks to an LLM: it takes the backend's ranked collector
list and decides whether the top pick is safe to auto-assign. So every test
is deterministic. The backend calls (tools/collection_tools.py) are replaced
by fakes, so no API, database or network is needed.
"""

import sys
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Run from agentic-ai/Collection: make `main`, `schemas`, `graph`, `tools` importable.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main  # noqa: E402
from schemas import CollectorMatch  # noqa: E402


def make_collector(distance_km=2.0, rating=4.5, active_jobs=0, capacity_kg=500.0,
                   vehicle="Lorry", collector_id=None) -> CollectorMatch:
    return CollectorMatch(
        collectorId=collector_id or uuid.uuid4(),
        vehicleType=vehicle,
        capacityKg=capacity_kg,
        rating=rating,
        activeJobCount=active_jobs,
        distanceKm=distance_km,
        etaMinutes=None if distance_km is None else int(distance_km * 3),
    )


@pytest.fixture
def collector():
    return make_collector


class FakeBackend:
    """Stands in for the three backend tools and records what the agent sent."""

    def __init__(self):
        self.candidates: list[CollectorMatch] = []
        self.lookup_error: Exception | None = None
        self.lookup_calls: list[dict] = []
        self.submitted: list[dict] = []
        self.logs: list[dict] = []

    async def get_ranked_candidates(self, **kwargs):
        self.lookup_calls.append(kwargs)
        if self.lookup_error:
            raise self.lookup_error
        return list(self.candidates)

    async def submit_matching_result(self, workflow_id, result):
        self.submitted.append({"workflow_id": workflow_id, **result})
        return None

    async def log_execution(self, workflow_id, step_number, input_json, output_json, succeeded, error_message):
        self.logs.append({"succeeded": succeeded, "error_message": error_message, "output": output_json})


@pytest.fixture
def backend(monkeypatch):
    fake = FakeBackend()
    monkeypatch.setattr(main.tools, "get_ranked_candidates", fake.get_ranked_candidates)
    monkeypatch.setattr(main.tools, "submit_matching_result", fake.submit_matching_result)
    monkeypatch.setattr(main.tools, "log_execution", fake.log_execution)
    return fake


@pytest.fixture
def client(backend):
    return TestClient(main.app, raise_server_exceptions=False)


def run_request(**overrides) -> dict:
    """A valid /run body, as the backend's MatcherAgentClient sends it."""
    body = {
        "workflowId": str(uuid.uuid4()),
        "pickupLatitude": 6.9271,
        "pickupLongitude": 79.8612,
        "estimatedWeightKg": 12,
        "estimatedValueLkr": 20000,
        "alreadyEscalated": False,
        "excludeCollectorIds": [],
    }
    body.update(overrides)
    return body


@pytest.fixture
def body():
    return run_request
