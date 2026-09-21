"""E-Waste Agentic AI service - the ONLY thing ASP.NET Core calls.

    GET  /health                       liveness (no auth, no secrets)
    POST /workflows                    start the assessed workflow            -> 202 (runs in the background)
    GET  /workflows/{id}               status, result and step trail          (debug / polling fallback)
    POST /workflows/{id}/revise        staff "Request revision" feedback      -> 202

Security: every route except /health requires the shared `X-Agent-Key`. React and Flutter never reach this
service; they talk to ASP.NET Core, which calls it. Run:  uvicorn main:app --port 8000
"""
from __future__ import annotations

import asyncio
import hmac
import logging
from collections import OrderedDict
from typing import Any

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException

from graph import AgentFactories, RevisionError, build_graph, initial_state, revision_state, run_workflow
from shared.config import Settings, get_settings
from shared.contracts import ReviseRequest, StartWorkflowRequest, WorkflowAccepted
from shared.reporter import BackendReporter, NullReporter, WorkflowReporter

log = logging.getLogger("agentic-ai")


class WorkflowStore:
    """Small in-memory index so status can be polled and revisions can find prior state.
    NOT the source of truth (PostgreSQL via ASP.NET Core is); bounded and safe to lose on restart."""

    def __init__(self, max_items: int = 200) -> None:
        self._items: "OrderedDict[str, dict[str, Any]]" = OrderedDict()
        self._max = max_items

    def get(self, workflow_id: str) -> dict[str, Any] | None:
        return self._items.get(workflow_id)

    def put(self, workflow_id: str, record: dict[str, Any]) -> None:
        self._items[workflow_id] = record
        self._items.move_to_end(workflow_id)
        while len(self._items) > self._max:
            self._items.popitem(last=False)


def create_app(settings: Settings | None = None, factories: AgentFactories | None = None,
               reporter: WorkflowReporter | None = None) -> FastAPI:
    settings = settings or get_settings()
    graph = build_graph(factories)
    reporter = reporter or (BackendReporter(settings) if settings.report_to_backend else NullReporter())
    store = WorkflowStore()
    slots = asyncio.Semaphore(settings.max_concurrent_workflows)
    app = FastAPI(title="E-Waste Agentic AI Service", version="1.0.0")

    async def require_key(x_agent_key: str | None = Header(default=None)) -> None:
        expected = settings.agent_api_key
        if not expected:
            raise HTTPException(status_code=503, detail="Agent API key is not configured on this service.")
        if not x_agent_key or not hmac.compare_digest(x_agent_key.encode(), expected.encode()):
            raise HTTPException(status_code=401, detail="Invalid agent API key.")

    async def execute(workflow_id: str, state: dict[str, Any]) -> None:
        async with slots:                          # cap concurrent LLM-heavy runs
            result, final = await run_workflow(graph, state, reporter, settings.workflow_timeout_seconds)
        store.put(workflow_id, {"status": "Completed", "result": result, "state": final})

    @app.get("/health")
    async def health() -> dict[str, Any]:
        return {"status": "ok", "llm_configured": bool(settings.gemini_api_key),
                "reporting_to_backend": settings.report_to_backend}

    @app.post("/workflows", status_code=202, response_model=WorkflowAccepted, dependencies=[Depends(require_key)])
    async def start(body: StartWorkflowRequest, background: BackgroundTasks) -> WorkflowAccepted:
        workflow_id = str(body.workflow_id)
        if store.get(workflow_id):                 # idempotent: a retried request must not start a second run
            return WorkflowAccepted(workflow_id=workflow_id)
        store.put(workflow_id, {"status": "Running", "result": None, "state": None})
        background.add_task(execute, workflow_id, initial_state(body))
        return WorkflowAccepted(workflow_id=workflow_id)

    @app.get("/workflows/{workflow_id}", dependencies=[Depends(require_key)])
    async def status(workflow_id: str) -> dict[str, Any]:
        record = store.get(workflow_id)
        if not record:
            raise HTTPException(status_code=404, detail="Unknown workflow.")
        steps = (record["state"] or {}).get("steps") or []
        return {"workflow_id": workflow_id, "status": record["status"], "result": record["result"], "steps": steps}

    @app.post("/workflows/{workflow_id}/revise", status_code=202, response_model=WorkflowAccepted,
              dependencies=[Depends(require_key)])
    async def revise(workflow_id: str, body: ReviseRequest, background: BackgroundTasks) -> WorkflowAccepted:
        record = store.get(workflow_id)
        if record and record["status"] == "Running":
            raise HTTPException(status_code=409, detail="Workflow is still running.")
        previous = (record or {}).get("state") or body.previous_state
        if not previous:
            raise HTTPException(status_code=404, detail="Unknown workflow and no previous_state was supplied.")
        try:
            state = revision_state(previous, body, settings.max_revisions)
        except RevisionError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from None
        store.put(workflow_id, {"status": "Running", "result": None, "state": None})
        background.add_task(execute, workflow_id, state)
        return WorkflowAccepted(workflow_id=workflow_id)

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
