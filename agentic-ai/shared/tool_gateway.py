"""ToolGateway - the ONLY way an agent touches the outside world.

Enforces, in code (not just in prompts or docs):
  * allow-list per agent (least privilege)          -> ToolNotAllowedError
  * validated inputs (strict Pydantic, UUID path params, no free-form URLs)
  * fixed base URL from settings (never from workflow data)
  * timeout + bounded retries with backoff (transport errors, 429, 5xx only; never 4xx)
  * validated, structured outputs                   -> ToolCallError on malformed data
  * an audit record per call (tool, attempts, status, timing, redacted input, error)
  * secret hygiene: X-Agent-Key is sent but never appears in any record
"""
from __future__ import annotations

import asyncio
import time
from typing import Any, Awaitable, Callable, Iterable
from uuid import UUID

import httpx
from pydantic import BaseModel, TypeAdapter, ValidationError

from .config import Settings, get_settings
from .contracts import ToolCallRecord
from .tool_catalog import TOOLS, ToolSpec

_RETRYABLE_STATUS = {429, 500, 502, 503, 504}


class ToolNotAllowedError(PermissionError):
    """Raised when an agent asks for a tool outside its allow-list."""


class ToolCallError(RuntimeError):
    def __init__(self, tool: str, message: str, *, status_code: int | None = None):
        super().__init__(f"{tool}: {message}")
        self.tool = tool
        self.status_code = status_code


class ToolGateway:
    def __init__(
        self,
        agent_name: str,
        allowed_tools: Iterable[str],
        settings: Settings | None = None,
        *,
        client: httpx.AsyncClient | None = None,
        correlation_id: str | None = None,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        allowed = frozenset(allowed_tools)
        unknown = allowed - TOOLS.keys()
        if unknown:
            raise ValueError(f"Unknown tools in allow-list: {sorted(unknown)}")
        self.agent_name = agent_name
        self._allowed = allowed
        self._settings = settings or get_settings()
        self._client = client
        self._correlation_id = correlation_id
        self._sleep = sleep
        self._calls: list[ToolCallRecord] = []

    # ---- observability -----------------------------------------------------------
    @property
    def calls(self) -> list[ToolCallRecord]:
        return list(self._calls)

    def drain(self) -> list[ToolCallRecord]:
        calls, self._calls = self._calls, []
        return calls

    # ---- public API --------------------------------------------------------------
    async def call(
        self,
        tool_name: str,
        *,
        path_params: dict[str, str] | None = None,
        payload: BaseModel | dict[str, Any] | None = None,
    ) -> Any:
        if tool_name not in self._allowed:
            raise ToolNotAllowedError(f"Agent '{self.agent_name}' is not allowed to call '{tool_name}'.")
        spec = TOOLS[tool_name]
        record = ToolCallRecord(tool=tool_name, agent=self.agent_name)
        started = time.perf_counter()
        try:
            path, body = self._prepare(spec, path_params, payload, record)
            result = await self._send_with_retries(spec, path, body, record)
            record.ok = True
            return result
        except ToolCallError as exc:
            record.error = str(exc)[:300]
            record.status_code = exc.status_code if exc.status_code is not None else record.status_code
            raise
        finally:
            record.duration_ms = int((time.perf_counter() - started) * 1000)
            self._calls.append(record)

    # ---- internals ---------------------------------------------------------------
    def _prepare(
        self, spec: ToolSpec, path_params: dict[str, str] | None,
        payload: BaseModel | dict[str, Any] | None, record: ToolCallRecord,
    ) -> tuple[str, dict[str, Any] | None]:
        params: dict[str, str] = {}
        for name in spec.path_params:
            raw = (path_params or {}).get(name)
            try:
                params[name] = str(UUID(str(raw)))  # canonical form; rejects '../', braces, etc.
            except (ValueError, AttributeError, TypeError):
                raise ToolCallError(spec.name, f"invalid path parameter '{name}' (must be a UUID)") from None
        record.input_summary.update(params)

        body: dict[str, Any] | None = None
        if spec.request_model is not None:
            try:
                model = spec.request_model.model_validate(payload if payload is not None else {})
            except ValidationError as exc:
                fields = sorted({".".join(map(str, e["loc"])) for e in exc.errors()})
                raise ToolCallError(spec.name, f"invalid request fields: {fields}") from None
            body = model.model_dump(mode="json", by_alias=True, exclude_none=True)
            for key, value in body.items():
                if key in spec.redact:
                    record.input_summary[key] = f"<redacted {len(str(value))} chars>"
                else:
                    record.input_summary[key] = value
        return spec.path.format(**params), body

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json"}
        if self._settings.agent_api_key:
            headers["X-Agent-Key"] = self._settings.agent_api_key
        if self._correlation_id:
            headers["X-Correlation-Id"] = self._correlation_id
        return headers

    async def _send_with_retries(
        self, spec: ToolSpec, path: str, body: dict[str, Any] | None, record: ToolCallRecord,
    ) -> Any:
        max_attempts = 1 + max(0, self._settings.tool_max_retries)
        last_error = "unknown error"
        last_status: int | None = None

        for attempt in range(1, max_attempts + 1):
            record.attempts = attempt
            retryable = False
            try:
                response = await self._request(spec.method, path, body)
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_error, last_status, retryable = f"{type(exc).__name__} (no response)", None, True
            else:
                last_status = response.status_code
                record.status_code = last_status
                if response.status_code < 400:
                    return self._parse(spec, response)
                last_error = f"HTTP {response.status_code}: {response.text[:120]}"
                retryable = response.status_code in _RETRYABLE_STATUS

            if not retryable or attempt == max_attempts:
                break
            await self._sleep(0.2 * (2 ** (attempt - 1)))  # 0.2s, 0.4s, ...

        raise ToolCallError(spec.name, last_error, status_code=last_status)

    async def _request(self, method: str, path: str, body: dict[str, Any] | None) -> httpx.Response:
        if self._client is not None:
            return await self._client.request(method, path, json=body, headers=self._headers())
        timeout = httpx.Timeout(self._settings.tool_timeout_seconds)
        async with httpx.AsyncClient(base_url=self._settings.api_base_url, timeout=timeout) as client:
            return await client.request(method, path, json=body, headers=self._headers())

    @staticmethod
    def _parse(spec: ToolSpec, response: httpx.Response) -> Any:
        try:
            data = response.json()
        except ValueError:
            raise ToolCallError(spec.name, "response was not valid JSON", status_code=response.status_code) from None
        try:
            return TypeAdapter(spec.response_type).validate_python(data)
        except ValidationError:
            raise ToolCallError(spec.name, "response did not match the expected schema",
                                status_code=response.status_code) from None
