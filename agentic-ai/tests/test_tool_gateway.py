"""ToolGateway: allow-list, input validation, retries, output validation, audit hygiene."""
import httpx
import pytest

from shared.tool_gateway import ToolCallError, ToolGateway, ToolNotAllowedError
from Matcher.matcher_agent import MATCHER_TOOLS
from Validator.validator_agent import VALIDATOR_TOOLS
from tests.helpers import API_KEY, collector, make_gateway, make_settings

ITEM = "00000000-0000-0000-0000-000000000007"


def ok_json(data, status=200):
    return httpx.Response(status, json=data)


async def test_matcher_cannot_call_validator_tool_and_vice_versa():
    gw, backend, _ = make_gateway("matcher", MATCHER_TOOLS, lambda r: ok_json({}))
    with pytest.raises(ToolNotAllowedError):
        await gw.call("validate_classification", path_params={"item_id": ITEM}, payload={"proposed_category": 1})
    gw2, backend2, _ = make_gateway("validator", VALIDATOR_TOOLS, lambda r: ok_json([]))
    with pytest.raises(ToolNotAllowedError):
        await gw2.call("find_collectors", payload={"pickup_latitude": 6.9, "pickup_longitude": 79.8})
    assert backend.requests == [] and backend2.requests == []  # nothing left the process


def test_unknown_tool_in_allow_list_is_rejected_at_construction():
    with pytest.raises(ValueError):
        ToolGateway("x", ["delete_everything"], make_settings())


@pytest.mark.parametrize("bad", ["../../admin", "not-a-uuid", "", "7; DROP TABLE", "{00000000-0000-0000-0000-000000000007}/../x"])
async def test_path_params_must_be_uuids(bad):
    gw, backend, _ = make_gateway("validator", VALIDATOR_TOOLS, lambda r: ok_json({"approved": True}))
    with pytest.raises(ToolCallError):
        await gw.call("validate_classification", path_params={"item_id": bad}, payload={"proposed_category": 0})
    assert backend.requests == []


async def test_request_payload_is_validated_and_unknown_fields_rejected():
    gw, backend, _ = make_gateway("matcher", MATCHER_TOOLS, lambda r: ok_json([]))
    for bad in ({"pickup_latitude": 999, "pickup_longitude": 0}, {"pickup_latitude": 1, "pickup_longitude": 1, "evil": "x"}):
        with pytest.raises(ToolCallError):
            await gw.call("find_collectors", payload=bad)
    assert backend.requests == []


async def test_retries_transient_5xx_then_succeeds_with_backoff():
    responses = iter([httpx.Response(503), httpx.Response(502), ok_json([collector(1, 2.0, 5)])])
    gw, backend, sleeps = make_gateway("matcher", MATCHER_TOOLS, lambda r: next(responses))
    result = await gw.call("find_collectors", payload={"pickup_latitude": 6.9, "pickup_longitude": 79.8})
    assert len(result) == 1 and len(backend.requests) == 3
    rec = gw.calls[0]
    assert rec.ok and rec.attempts == 3 and sleeps == [0.2, 0.4]


async def test_never_retries_4xx():
    gw, backend, sleeps = make_gateway("matcher", MATCHER_TOOLS, lambda r: httpx.Response(400, json={"m": "bad"}))
    with pytest.raises(ToolCallError):
        await gw.call("find_collectors", payload={"pickup_latitude": 6.9, "pickup_longitude": 79.8})
    assert len(backend.requests) == 1 and sleeps == []
    assert gw.calls[0].status_code == 400 and not gw.calls[0].ok


async def test_retry_limit_is_enforced_on_persistent_failure():
    gw, backend, _ = make_gateway("matcher", MATCHER_TOOLS, lambda r: httpx.Response(500), tool_max_retries=1)
    with pytest.raises(ToolCallError):
        await gw.call("find_collectors", payload={"pickup_latitude": 6.9, "pickup_longitude": 79.8})
    assert len(backend.requests) == 2


async def test_timeouts_are_retried_then_reported():
    def boom(request):
        raise httpx.ReadTimeout("slow", request=request)
    gw, backend, _ = make_gateway("matcher", MATCHER_TOOLS, boom)
    with pytest.raises(ToolCallError, match="ReadTimeout"):
        await gw.call("find_collectors", payload={"pickup_latitude": 6.9, "pickup_longitude": 79.8})
    assert len(backend.requests) == 3


@pytest.mark.parametrize("response", [
    httpx.Response(200, text="<html>oops</html>"),
    httpx.Response(200, json={"unexpected": "shape"}),
    httpx.Response(200, json=[{"collectorId": "nope"}]),
])
async def test_malformed_responses_are_rejected_not_trusted(response):
    gw, _, _ = make_gateway("matcher", MATCHER_TOOLS, lambda r: response)
    with pytest.raises(ToolCallError):
        await gw.call("find_collectors", payload={"pickup_latitude": 6.9, "pickup_longitude": 79.8})


async def test_agent_key_is_sent_but_never_recorded_and_address_is_redacted():
    gw, backend, _ = make_gateway("matcher", MATCHER_TOOLS,
                                  lambda r: ok_json({"resolved": True, "latitude": 6.9, "longitude": 79.8}))
    await gw.call("geocode_address", payload={"address": "45 Galle Road, Colombo 03"})
    assert backend.requests[0].headers["X-Agent-Key"] == API_KEY
    dumped = gw.calls[0].model_dump_json()
    assert API_KEY not in dumped and "Galle" not in dumped
    assert gw.calls[0].input_summary["address"].startswith("<redacted")


async def test_drain_returns_and_clears_records():
    gw, _, _ = make_gateway("matcher", MATCHER_TOOLS, lambda r: ok_json([]))
    await gw.call("find_collectors", payload={"pickup_latitude": 6.9, "pickup_longitude": 79.8})
    assert len(gw.drain()) == 1 and gw.calls == []
