"""Progress reporting from this (stateless) service back to ASP.NET Core, which owns durable state.

    POST {API}/api/agent/workflows/{workflow_id}/steps    one StepRecord per completed agent step
    POST {API}/api/agent/workflows/{workflow_id}/result   the final outcome, plan, analysis, validation, match, proposal

Reporting must never break a workflow: failures are logged and swallowed (after bounded retries).
The payload never contains secrets, tokens or model reasoning - only structured step/outcome data.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Awaitable, Callable, Protocol

import httpx

from .config import Settings

log = logging.getLogger("agentic-ai.reporter")


class WorkflowReporter(Protocol):
    async def report_step(self, workflow_id: str, step: dict[str, Any]) -> None: ...
    async def report_result(self, workflow_id: str, result: dict[str, Any]) -> None: ...


class NullReporter:
    async def report_step(self, workflow_id: str, step: dict[str, Any]) -> None:
        return None

    async def report_result(self, workflow_id: str, result: dict[str, Any]) -> None:
        return None


class BackendReporter:
    def __init__(self, settings: Settings, *, client: httpx.AsyncClient | None = None,
                 sleep: Callable[[float], Awaitable[None]] = asyncio.sleep) -> None:
        self._settings, self._client, self._sleep = settings, client, sleep

    async def report_step(self, workflow_id: str, step: dict[str, Any]) -> None:
        await self._post(f"/api/agent/workflows/{workflow_id}/steps", step)

    async def report_result(self, workflow_id: str, result: dict[str, Any]) -> None:
        await self._post(f"/api/agent/workflows/{workflow_id}/result", result)

    async def _post(self, path: str, body: dict[str, Any]) -> bool:
        headers = {"X-Agent-Key": self._settings.agent_api_key}
        for attempt in range(1, 4):
            try:
                if self._client is not None:
                    response = await self._client.post(path, json=body, headers=headers)
                else:
                    async with httpx.AsyncClient(base_url=self._settings.api_base_url,
                                                 timeout=httpx.Timeout(self._settings.tool_timeout_seconds)) as c:
                        response = await c.post(path, json=body, headers=headers)
                if response.status_code < 400:
                    return True
                if response.status_code not in (429, 500, 502, 503, 504):
                    log.warning("Backend rejected report to %s (HTTP %s)", path, response.status_code)
                    return False
            except httpx.HTTPError as exc:
                log.warning("Report to %s failed (%s)", path, type(exc).__name__)
            if attempt < 3:
                await self._sleep(0.3 * attempt)
        log.error("Giving up reporting to %s after 3 attempts", path)
        return False
