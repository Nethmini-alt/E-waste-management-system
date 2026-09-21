"""Validator classification gate (tool call to Component C's /validate-classification)."""
import json
from uuid import UUID

import httpx
import pytest

from shared.contracts import ClassificationValidationInput, Decision
from Validator.validator_agent import VALIDATOR_TOOLS, ValidatorAgent
from tests.helpers import API_KEY, make_gateway

ITEM = str(UUID(int=7))


def agent_with(handler, **kw):
    gw, backend, sleeps = make_gateway("validator", VALIDATOR_TOOLS, handler, **kw)
    return ValidatorAgent(gw), backend, sleeps


def data(category="LocalRecyclable", conf=0.9, item=ITEM, sub="Metal"):
    return ClassificationValidationInput(inventory_item_id=item, proposed_category=category,
                                         proposed_sub_category=sub, confidence_score=conf, workflow_id="wf-1")


async def test_sends_integer_enum_and_correct_path_REGRESSION_for_original_agent():
    """The original validator_agent.py sent strings; the .NET enum accepts only 0-3 -> always HTTP 400."""
    agent, backend, _ = agent_with(lambda r: httpx.Response(200, json={"approved": True, "requiresHumanReview": False, "reasons": ["ok"]}))
    await agent.validate_classification(data("LocalRecyclable"))
    assert backend.paths == [f"/api/v1/inventory/{ITEM}/validate-classification"]
    body = backend.body()
    assert body["proposedCategory"] == 1 and isinstance(body["proposedCategory"], int)
    assert body["proposedSubCategory"] == "Metal" and body["confidenceScore"] == 0.9


@pytest.mark.parametrize("given,code", [("Reusable", 0), ("local recyclable", 1), ("HAZARDOUS", 2), ("Export-Only", 3), (2, 2), ("3", 3)])
async def test_category_names_and_numbers_normalise_to_backend_codes(given, code):
    agent, backend, _ = agent_with(lambda r: httpx.Response(200, json={"approved": True}))
    await agent.validate_classification(data(given))
    assert backend.body()["proposedCategory"] == code


@pytest.mark.parametrize("payload,expected", [
    ({"approved": True, "requiresHumanReview": False, "reasons": ["Passed all deterministic checks."]}, Decision.APPROVED),
    ({"approved": True, "requiresHumanReview": True, "reasons": ["Battery not Hazardous"]}, Decision.REQUIRES_HUMAN),
    ({"approved": False, "requiresHumanReview": False, "reasons": ["Inventory item not found."]}, Decision.REJECTED),
])
async def test_backend_response_maps_to_single_decision(payload, expected):
    agent, _, _ = agent_with(lambda r: httpx.Response(200, json=payload))
    result = await agent.validate_classification(data())
    assert result.output.decision == expected and result.output.mode == "classification"
    assert result.output.reasons == ([] if expected == Decision.APPROVED else payload["reasons"])
    assert result.step.status == "succeeded" and result.step.tool_calls[0].ok


@pytest.mark.parametrize("bad", [
    dict(item="../../admin"), dict(category="Toxic"), dict(category=7), dict(conf=1.5), dict(sub="x" * 101),
])
async def test_invalid_input_is_rejected_locally_without_any_http_call(bad):
    agent, backend, _ = agent_with(lambda r: httpx.Response(200, json={"approved": True}))
    result = await agent.validate_classification(data(**bad))
    assert result.output.decision == Decision.REJECTED and backend.requests == []


async def test_transient_failures_are_retried_and_recorded():
    responses = iter([httpx.Response(503), httpx.Response(503), httpx.Response(200, json={"approved": True})])
    agent, backend, _ = agent_with(lambda r: next(responses))
    result = await agent.validate_classification(data())
    assert result.output.decision == Decision.APPROVED
    assert result.step.retries == 2 and result.step.tool_calls[0].attempts == 3


@pytest.mark.parametrize("response", [
    httpx.Response(500), httpx.Response(400, json={"error": "bad"}), httpx.Response(200, text="not json"),
    httpx.Response(200, json={"whatever": 1}), httpx.Response(401, json={"message": "Invalid agent API key."}),
])
async def test_any_tool_failure_escalates_to_human_and_never_approves(response):
    agent, _, _ = agent_with(lambda r: response)
    result = await agent.validate_classification(data())
    assert result.output.decision == Decision.REQUIRES_HUMAN
    assert result.output.safe_failure is True and result.step.status == "failed" and result.step.error


async def test_network_error_is_a_safe_failure():
    def down(request):
        raise httpx.ConnectError("refused", request=request)
    agent, _, _ = agent_with(down)
    result = await agent.validate_classification(data())
    assert result.output.decision == Decision.REQUIRES_HUMAN and result.output.safe_failure


async def test_agent_key_header_sent_and_absent_from_step_record():
    agent, backend, _ = agent_with(lambda r: httpx.Response(200, json={"approved": True}))
    result = await agent.validate_classification(data())
    assert backend.requests[0].headers["X-Agent-Key"] == API_KEY
    assert API_KEY not in result.step.model_dump_json()
