import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from graph.planner import run_workflow
from schemas import AgentRunRequest, AgentRunResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("agent")

app = FastAPI(title="Commercial Recovery Planning Agent", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/run", response_model=AgentRunResponse)
async def run(req: AgentRunRequest) -> AgentRunResponse:
    """
    Run the planning workflow and submit the resulting plan to ASP.NET Core.
    Returns the submitted plan summary.
    """
    log.info("Starting agent run (workflow=%s)", req.workflow_id)
    try:
        state = await run_workflow(req.workflow_id)
    except Exception as exc:
        log.exception("Agent run failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not state.get("commercial_plan_id"):
        raise HTTPException(status_code=500, detail="Plan submission returned no id.")

    return AgentRunResponse(
        workflowId=state["workflow_id"],
        commercialPlanId=state["commercial_plan_id"],
        recommendedRoute=state["recommended_route"],
        expectedRevenue=state["expected_revenue"],
        estimatedNetValue=state["estimated_net_value"],
        approvalRequired=state.get("approval_required", True),
        reasoningSummary=state["reasoning_summary"],
        riskFlags=state.get("risk_flags", []),
    )