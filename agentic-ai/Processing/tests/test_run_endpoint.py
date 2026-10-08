"""
Component C — Validator agent: HTTP endpoint tests (TC-C-A08, A09).

The FastAPI app is driven through TestClient exactly as the .NET orchestrator calls it.
The backend is replaced by fakes, so no API, database or network is needed.
"""

import uuid

import httpx
import pytest
from fastapi.testclient import TestClient

import main
from schemas import BusinessRules
from tools import processing_tools as tools

WORKFLOW_ID = str(uuid.uuid4())

# The real rules tool, kept before the `backend` fixture replaces it with a fake.
REAL_GET_BUSINESS_RULES = tools.get_business_rules


def request_body(**analyzer_overrides) -> dict:
    analyzer = dict(wasteCategory="IT Equipment", hazardLevel="Low", estimatedVolumeKg=12,
                    estimatedValueLkr=20000, confidenceScore=0.92)
    analyzer.update(analyzer_overrides)
    return {"workflowId": WORKFLOW_ID, "submissionId": str(uuid.uuid4()), "analyzerResult": analyzer}


@pytest.fixture
def backend(monkeypatch):
    """Fake backend: serves the business rules and records what the agent writes back."""
    calls = {"submitted": [], "logged": []}

    async def get_rules():
        return BusinessRules()

    async def submit(workflow_id, result):
        calls["submitted"].append((str(workflow_id), result))
        return {"workflowId": str(workflow_id)}

    async def log(workflow_id, step, input_json, output_json, succeeded, error):
        calls["logged"].append({"step": step, "succeeded": succeeded, "error": error})

    monkeypatch.setattr(tools, "get_business_rules", get_rules)
    monkeypatch.setattr(tools, "submit_validation", submit)
    monkeypatch.setattr(tools, "log_execution", log)
    return calls


@pytest.fixture
def client():
    return TestClient(main.app, raise_server_exceptions=False)


# ---------- TC-C-A08 ----------

def test_A08_run_returns_the_contract_the_backend_expects(client, backend):
    res = client.post("/run", json=request_body())

    assert res.status_code == 200
    body = res.json()
    assert set(body) == {"workflowId", "approvedForAutoAssignment", "requiresHumanApproval", "reasons"}
    assert body["workflowId"] == WORKFLOW_ID
    assert body["approvedForAutoAssignment"] is True
    assert body["requiresHumanApproval"] is False


def test_A08_decision_is_sent_to_the_backend_and_logged(client, backend):
    client.post("/run", json=request_body(hazardLevel="High"))

    assert len(backend["submitted"]) == 1
    workflow_id, result = backend["submitted"][0]
    assert workflow_id == WORKFLOW_ID
    assert result["requires_human_approval"] is True
    assert backend["logged"] == [{"step": 3, "succeeded": True, "error": None}]


def test_A08_health_endpoint(client):
    res = client.get("/health")

    assert res.status_code == 200
    assert res.json() == {"status": "ok", "service": "Validator"}


# ---------- TC-C-A09 ----------

@pytest.mark.parametrize("body", [
    {},                                                         # empty
    {"workflowId": "not-a-uuid", "submissionId": str(uuid.uuid4()), "analyzerResult": {}},
    request_body(confidenceScore="very sure"),                  # wrong type
])
def test_A09_invalid_request_is_rejected_with_422(client, backend, body):
    res = client.post("/run", json=body)

    assert res.status_code == 422
    assert backend["submitted"] == []  # nothing written back for a bad request


def test_A09_backend_down_when_saving_gives_a_clean_error(client, backend, monkeypatch):
    async def failing_submit(workflow_id, result):
        raise httpx.ConnectError("backend unreachable")

    monkeypatch.setattr(tools, "submit_validation", failing_submit)

    res = client.post("/run", json=request_body())

    # The orchestrator treats a 5xx as an agent failure and marks the workflow Failed (safe).
    assert res.status_code == 500


def test_A09_rules_unavailable_never_auto_approves(client, backend, monkeypatch):
    """
    Safe failure: if the business rules cannot be loaded from the backend, the agent must not
    auto-approve on guessed thresholds — it has to send the submission to a human.
    """
    async def unreachable(path):
        raise httpx.ConnectError("backend unreachable")

    monkeypatch.setattr(tools, "_get", unreachable)
    monkeypatch.setattr(tools, "get_business_rules", REAL_GET_BUSINESS_RULES)

    res = client.post("/run", json=request_body())   # a submission well inside every limit

    assert res.status_code == 200
    body = res.json()
    assert body["requiresHumanApproval"] is True
    assert body["approvedForAutoAssignment"] is False
    assert any("business rules" in r.lower() for r in body["reasons"])
