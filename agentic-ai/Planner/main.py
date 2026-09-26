import logging
import time

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from graph.nodes import create_plan_node, finalize_node
from graph.state import PlannerState
from schemas import (
    PlanRequest, PlanResponse,
    FinalizeRequest, FinalizeResponse,
)
from tools import planner_tools as tools

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("planner-agent")

app = FastAPI(title="Planner / Coordinator Agent — Component D", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten before deployment
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "Planner"}


@app.post("/plan", response_model=PlanResponse)
async def plan(req: PlanRequest) -> PlanResponse:
    """First pass — called before Analyzer runs."""
    started = time.time()
    submission = await tools.get_submission(req.submission_id)

    state: PlannerState = {
        "workflow_id": str(req.workflow_id),
        "submission": submission,
    }

    try:
        state = await create_plan_node(state)
    except Exception as exc:
        await tools.log_execution(req.workflow_id, 1, req.model_dump(mode="json"), None, False, str(exc))
        log.exception("Planner /plan failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    await tools.submit_plan(req.workflow_id, state["steps"], state["skip_matcher"], state["plan_reasoning"])
    await tools.log_execution(
        req.workflow_id, 1, req.model_dump(mode="json"),
        {"steps": [s.model_dump() for s in state["steps"]], "skip_matcher": state["skip_matcher"]},
        True, None,
    )
    log.info("Planner /plan done in %.2fs (workflow=%s)", time.time() - started, req.workflow_id)

    return PlanResponse(
        workflowId=req.workflow_id,
        steps=state["steps"],
        skipMatcher=state["skip_matcher"],
        reasoning=state["plan_reasoning"],
    )


@app.post("/finalize", response_model=FinalizeResponse)
async def finalize(req: FinalizeRequest) -> FinalizeResponse:
    """Second pass — called once Validator (and Matcher, if not skipped) have run."""
    started = time.time()
    state: PlannerState = {
        "workflow_id": str(req.workflow_id),
        "analyzer_result": req.analyzer_result,
        "validator_result": req.validator_result,
        "matcher_result": req.matcher_result,
    }

    try:
        state = await finalize_node(state)
    except Exception as exc:
        await tools.log_execution(req.workflow_id, 5, req.model_dump(mode="json"), None, False, str(exc))
        log.exception("Planner /finalize failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    await tools.submit_final_plan(req.workflow_id, state["final_reasoning_summary"], state["ready_for_job_creation"])
    await tools.log_execution(
        req.workflow_id, 5, req.model_dump(mode="json"),
        {"ready_for_job_creation": state["ready_for_job_creation"]}, True, None,
    )
    log.info("Planner /finalize done in %.2fs (workflow=%s)", time.time() - started, req.workflow_id)

    return FinalizeResponse(
        workflowId=req.workflow_id,
        finalReasoningSummary=state["final_reasoning_summary"],
        readyForJobCreation=state["ready_for_job_creation"],
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True)
