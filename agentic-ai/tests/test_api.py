"""FastAPI entry point: auth, idempotency, background execution, revise, validation."""
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from main import create_app
from shared.reporter import NullReporter
from tests.helpers import API_KEY, FakeLLM, RecordingReporter, cid, llm_analysis, make_factories, make_settings

KEY = {"X-Agent-Key": API_KEY}
WID = str(UUID(int=500))
BODY = {"workflowId": WID, "submissionId": str(UUID(int=600)), "submissionType": "Household",
        "pickupAddress": "45 Galle Road, Colombo 03",
        "items": [{"itemName": "Laptop", "description": "Old Dell laptop", "imageUrl": "/uploads/a.jpg"}]}


def client(analyzer_llm="default", settings=None, reporter=None, handler=None):
    factories, backend = make_factories(handler, analyzer_llm=analyzer_llm)
    reporter = reporter or RecordingReporter()
    app = create_app(settings or make_settings(), factories, reporter)
    return TestClient(app), reporter, backend


def test_health_is_open_and_reveals_no_secrets():
    c, _, _ = client()
    r = c.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"
    assert API_KEY not in r.text and "gemini" not in r.text.lower().replace("llm_configured", "")


@pytest.mark.parametrize("headers", [{}, {"X-Agent-Key": "wrong"}, {"X-Agent-Key": ""}])
def test_every_workflow_route_requires_the_agent_key(headers):
    c, _, backend = client()
    assert c.post("/workflows", json=BODY, headers=headers).status_code == 401
    assert c.get(f"/workflows/{WID}", headers=headers).status_code == 401
    assert c.post(f"/workflows/{WID}/revise", json={"feedback": {}}, headers=headers).status_code == 401
    assert backend.requests == []


def test_service_refuses_everything_when_no_key_is_configured():
    c, _, _ = client(settings=make_settings(agent_api_key=""))
    assert c.post("/workflows", json=BODY, headers=KEY).status_code == 503


def test_start_accepts_camel_case_from_dotnet_and_runs_to_completion():
    c, reporter, _ = client()
    r = c.post("/workflows", json=BODY, headers=KEY)
    assert r.status_code == 202 and r.json() == {"workflow_id": WID, "status": "Running"}
    status = c.get(f"/workflows/{WID}", headers=KEY).json()
    assert status["status"] == "Completed" and status["result"]["outcome"] == "ReadyForAutoAssignment"
    assert [s["agent"] for s in status["steps"]] == ["planner", "analyzer", "validator", "matcher", "planner"]
    assert len(reporter.steps) == 5 and len(reporter.results) == 1        # reported to the backend as it went


def test_snake_case_payloads_work_too():
    c, _, _ = client()
    body = {"workflow_id": WID, "submission_id": str(UUID(int=600)), "pickup_address": "45 Galle Road",
            "items": [{"item_name": "Laptop", "description": "Old laptop"}]}
    assert c.post("/workflows", json=body, headers=KEY).status_code == 202


def test_duplicate_start_is_idempotent_and_does_not_run_twice():
    llm = FakeLLM(llm_analysis())
    c, reporter, _ = client(analyzer_llm=llm)
    assert c.post("/workflows", json=BODY, headers=KEY).status_code == 202
    assert c.post("/workflows", json=BODY, headers=KEY).status_code == 202
    assert len(llm.calls) == 1 and len(reporter.results) == 1


@pytest.mark.parametrize("bad", [
    {**BODY, "items": []}, {**BODY, "workflowId": "not-a-uuid"}, {k: v for k, v in BODY.items() if k != "submissionId"},
    {**BODY, "items": [{"itemName": "x", "description": "A" * 2001}]}, {**BODY, "pickupLatitude": 123},
    {**BODY, "items": [{"itemName": "x"}] * 21},
])
def test_invalid_requests_are_rejected_before_anything_runs(bad):
    c, reporter, backend = client()
    assert c.post("/workflows", json=bad, headers=KEY).status_code == 422
    assert backend.requests == [] and reporter.steps == []


def test_unknown_workflow_is_404():
    c, _, _ = client()
    assert c.get(f"/workflows/{UUID(int=9)}", headers=KEY).status_code == 404
    assert c.post(f"/workflows/{UUID(int=9)}/revise", json={"feedback": {}}, headers=KEY).status_code == 404


def hazardous_client():
    llm = FakeLLM(llm_analysis(hazard_level="High", waste_categories=["Batteries"], estimated_volume_kg=30, recommended_handling="Export"))
    return client(analyzer_llm=llm)


def test_revise_reruns_matching_and_bumps_the_revision_count():
    c, reporter, _ = hazardous_client()
    c.post("/workflows", json=BODY, headers=KEY)
    first = c.get(f"/workflows/{WID}", headers=KEY).json()["result"]
    assert first["outcome"] == "PendingApproval" and first["match"]["recommended_collector_id"] == str(cid(1))

    r = c.post(f"/workflows/{WID}/revise", headers=KEY,
               json={"feedback": {"excludeCollectorIds": [str(cid(1))], "notes": "driver unavailable"}})
    assert r.status_code == 202
    second = c.get(f"/workflows/{WID}", headers=KEY).json()
    assert second["result"]["revision_count"] == 1 and second["result"]["match"]["recommended_collector_id"] == str(cid(2))
    assert [s["agent"] for s in second["steps"]] == ["validator", "matcher", "planner"]
    assert len(reporter.results) == 2


def test_revision_limit_returns_409():
    c, _, _ = hazardous_client()
    c.post("/workflows", json=BODY, headers=KEY)
    for _ in range(3):
        assert c.post(f"/workflows/{WID}/revise", json={"feedback": {}}, headers=KEY).status_code == 202
    r = c.post(f"/workflows/{WID}/revise", json={"feedback": {}}, headers=KEY)
    assert r.status_code == 409 and "limit" in r.json()["detail"]


def test_revise_from_state_supplied_by_the_backend_when_memory_was_lost():
    c1, _, _ = hazardous_client()
    c1.post("/workflows", json=BODY, headers=KEY)
    # simulate a restarted service: a fresh app knows nothing, .NET supplies the stored state
    c1_status = c1.get(f"/workflows/{WID}", headers=KEY).json()["result"]
    previous = {"workflow_id": WID, "submission_id": c1_status["submission_id"], "plan": c1_status["plan"],
                "analysis": c1_status["analysis"], "pickup_address": "45 Galle Road, Colombo 03",
                "description": "Old Dell laptop", "items": BODY["items"], "csv_items": []}
    c2, _, _ = hazardous_client()
    r = c2.post(f"/workflows/{WID}/revise", json={"feedback": {}, "previousState": previous}, headers=KEY)
    assert r.status_code == 202
    assert c2.get(f"/workflows/{WID}", headers=KEY).json()["result"]["outcome"] == "PendingApproval"
    # ...and a tampered state is refused
    c3, _, _ = hazardous_client()
    bad = {**previous, "plan": {"steps": []}}
    assert c3.post(f"/workflows/{WID}/revise", json={"feedback": {}, "previousState": bad}, headers=KEY).status_code == 409


def test_a_failed_analysis_still_completes_as_a_reported_safe_failure():
    c, reporter, _ = client(analyzer_llm=None)
    c.post("/workflows", json=BODY, headers=KEY)
    status = c.get(f"/workflows/{WID}", headers=KEY).json()
    assert status["status"] == "Completed" and status["result"]["outcome"] == "SafeFailure"
    assert reporter.results[0][1]["failure_reason"]
