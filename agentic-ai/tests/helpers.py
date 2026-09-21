"""Shared test helpers: an in-process fake ASP.NET backend (httpx.MockTransport), fixtures, a fake LLM."""
import json
from datetime import datetime, timezone
from typing import Callable
from uuid import UUID

import httpx

from shared.config import Settings
from shared.tool_gateway import ToolGateway

FIXED_NOW = datetime(2026, 9, 21, 4, 0, tzinfo=timezone.utc)  # 09:30 in Asia/Colombo
API_KEY = "test-agent-key"


def make_settings(**kw) -> Settings:
    kw.setdefault("api_base_url", "http://test")
    kw.setdefault("agent_api_key", API_KEY)
    return Settings(_env_file=None, **kw)


class FakeBackend:
    """Callable transport handler that records every request the agents make."""

    def __init__(self, handler: Callable[[httpx.Request], httpx.Response]):
        self.requests: list[httpx.Request] = []
        self._handler = handler

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return self._handler(request)

    @property
    def paths(self) -> list[str]:
        return [r.url.path for r in self.requests]

    def body(self, index: int = -1) -> dict:
        return json.loads(self.requests[index].content)


def make_gateway(agent: str, tools, handler, **settings_kw):
    backend = FakeBackend(handler)
    client = httpx.AsyncClient(transport=httpx.MockTransport(backend), base_url="http://test")
    sleeps: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        sleeps.append(seconds)

    gateway = ToolGateway(agent, tools, make_settings(**settings_kw), client=client, sleep=fake_sleep)
    return gateway, backend, sleeps


def collector(i: int, dist: float | None, eta: int | None, active: int = 0, rating: float = 4.0,
              cap: float = 500, vehicle: str = "Truck") -> dict:
    return {"collectorId": str(UUID(int=i)), "vehicleType": vehicle, "capacityKg": cap, "rating": rating,
            "activeJobCount": active, "distanceKm": dist, "etaMinutes": eta}


def cid(i: int) -> UUID:
    return UUID(int=i)


def analysis(**over) -> dict:
    base = {"wasteCategories": ["Household Electronics"], "hazardLevel": "Low", "estimatedVolumeKg": 12.5,
            "estimatedValueLkr": 8000.0, "confidenceScore": 0.92, "requiresHumanApproval": False}
    base.update(over)
    return base


class FakeLLM:
    def __init__(self, response=None, exc: Exception | None = None):
        self.response, self.exc = response, exc
        self.calls: list[dict] = []

    async def generate_json(self, *, system: str, user: str, images=None) -> dict:
        self.calls.append({"system": system, "user": user, "images": images})
        if self.exc:
            raise self.exc
        return self.response(user) if callable(self.response) else self.response


# ---------------------------------------------------------------- Analyzer / whole-system fixtures
JPEG = b"\xff\xd8\xff\xe0" + b"0" * 200
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 200
PRICING = [{"materialType": "Copper", "pricePerKg": 1800, "effectiveDate": "2026-09-01"},
           {"materialType": "Aluminium", "pricePerKg": 400, "effectiveDate": "2026-09-01"}]
BUYERS = [{"buyerId": str(UUID(int=101)), "companyName": "Local Co", "contactPerson": "Nimal Perera",
           "email": "nimal@example.com", "buyerType": "Local"},
          {"buyerId": str(UUID(int=102)), "companyName": "Export Co", "contactPerson": "Anna Lee",
           "email": "anna@example.com", "buyerType": "Export"}]


def llm_analysis(**over) -> dict:
    """What a well-behaved model returns (snake_case, exactly as the prompt requests)."""
    base = {"is_ewaste": True, "waste_categories": ["Household Electronics"], "hazard_level": "Low",
            "estimated_volume_kg": 12.5, "estimated_value_lkr": 8000, "confidence_score": 0.9,
            "recommended_handling": "Local recycle"}
    base.update(over)
    return base


def image_response(request: httpx.Request) -> httpx.Response:
    return httpx.Response(200, content=JPEG, headers={"content-type": "image/jpeg"})


def full_backend(*, match=None, buyers=BUYERS, pricing=PRICING, geocode=None, images=image_response):
    """One fake ASP.NET API for the whole workflow: every tool the four agents may call."""
    match = [collector(1, 2.0, 6, active=0, rating=4.0), collector(2, 10.0, 18, active=1, rating=5.0)] if match is None else match
    geocode = {"resolved": True, "latitude": 6.93, "longitude": 79.85} if geocode is None else geocode

    def respond(value):
        return value() if callable(value) else httpx.Response(200, json=value)

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/api/agent/pricing/approved":
            return respond(pricing)
        if path == "/api/agent/buyers/eligible":
            return respond(buyers)
        if path == "/api/v1/collectors/geocode":
            return respond(geocode)
        if path == "/api/v1/collectors/match":
            return respond(match)
        if path.startswith("/uploads/"):
            return images(request)
        return httpx.Response(404)
    return handler


def make_factories(handler=None, *, analyzer_llm="default", planner_llm=None, matcher_llm=None, **settings_kw):
    """All four agents wired to ONE fake backend. Returns (AgentFactories, FakeBackend)."""
    from Analyzer import ANALYZER_TOOLS, AnalyzerAgent, ImageFetcher
    from graph import AgentFactories
    from Matcher import MATCHER_TOOLS, MatcherAgent
    from Planner import PLANNER_TOOLS, PlannerAgent
    from Validator import ValidatorAgent

    settings = make_settings(**settings_kw)
    backend = FakeBackend(handler or full_backend())
    client = httpx.AsyncClient(transport=httpx.MockTransport(backend), base_url="http://test")
    analyzer_llm = FakeLLM(llm_analysis()) if analyzer_llm == "default" else analyzer_llm

    async def no_sleep(seconds: float) -> None:
        return None

    def gw(agent, tools, wid):
        return ToolGateway(agent, tools, settings, client=client, correlation_id=wid, sleep=no_sleep)

    return AgentFactories(
        analyzer=lambda wid: AnalyzerAgent(gw("analyzer", ANALYZER_TOOLS, wid), analyzer_llm, ImageFetcher(settings, client=client)),
        validator=lambda wid: ValidatorAgent(),
        matcher=lambda wid: MatcherAgent(gw("matcher", MATCHER_TOOLS, wid), llm=matcher_llm, now=lambda: FIXED_NOW),
        planner=lambda wid: PlannerAgent(gw("planner", PLANNER_TOOLS, wid), planner_llm),
    ), backend


def start_request(**over):
    from shared.contracts import StartWorkflowRequest
    base = dict(workflow_id=UUID(int=500), submission_id=UUID(int=600), pickup_address="45 Galle Road, Colombo 03",
                items=[{"itemName": "Laptop", "description": "Old Dell laptop, works", "imageUrl": "/uploads/a.jpg"}])
    base.update(over)
    return StartWorkflowRequest.model_validate(base)


class RecordingReporter:
    def __init__(self):
        self.steps: list[tuple[str, dict]] = []
        self.results: list[tuple[str, dict]] = []

    async def report_step(self, workflow_id, step):
        self.steps.append((workflow_id, step))

    async def report_result(self, workflow_id, result):
        self.results.append((workflow_id, result))
