"""Exercises the gateway's OWN httpx client against a real local HTTP server (no mock transport):
base URL handling, real headers on the wire, JSON bodies, and a real read timeout."""
import asyncio
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from shared.contracts import ClassificationValidationInput, Decision
from shared.tool_gateway import ToolCallError, ToolGateway
from Validator.validator_agent import VALIDATOR_TOOLS, ValidatorAgent
from tests.helpers import API_KEY, make_settings

SEEN: list[dict] = []
ITEM = "00000000-0000-0000-0000-000000000007"
SLOW_ITEM = "00000000-0000-0000-0000-000000000009"   # the fake server stalls on this id


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # keep test output quiet
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        SEEN.append({"path": self.path, "key": self.headers.get("X-Agent-Key"), "body": body})
        if SLOW_ITEM in self.path:
            time.sleep(1.0)
        payload = json.dumps({"approved": True, "requiresHumanReview": False, "reasons": ["ok"]}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


@pytest.fixture(scope="module")
def server():
    srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_address[1]}"
    srv.shutdown()


async def test_real_http_round_trip_sends_key_and_integer_enum(server):
    SEEN.clear()
    settings = make_settings()
    settings.api_base_url = server
    agent = ValidatorAgent(ToolGateway("validator", VALIDATOR_TOOLS, settings))
    result = await agent.validate_classification(ClassificationValidationInput(
        inventory_item_id=ITEM, proposed_category="Hazardous", confidence_score=0.95))
    assert result.output.decision == Decision.APPROVED
    assert SEEN[0]["path"] == f"/api/v1/inventory/{ITEM}/validate-classification"
    assert SEEN[0]["key"] == API_KEY and SEEN[0]["body"]["proposedCategory"] == 2


async def test_real_read_timeout_is_enforced_and_retries_are_bounded(server):
    SEEN.clear()
    settings = make_settings(tool_timeout_seconds=0.2, tool_max_retries=1)
    settings.api_base_url = server
    gateway = ToolGateway("validator", VALIDATOR_TOOLS, settings, sleep=lambda s: asyncio.sleep(0))
    started = time.perf_counter()
    with pytest.raises(ToolCallError, match="Timeout"):
        await gateway.call("validate_classification", path_params={"item_id": SLOW_ITEM},
                           payload={"proposed_category": 1})
    assert time.perf_counter() - started < 2.0   # gave up after two short tries, not the server's 1s stall per try (loose: slow CI/Windows)
    assert gateway.calls[0].attempts == 2 and not gateway.calls[0].ok   # first try + exactly one retry
