import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from graph.planner import run_workflow
from graph.priority import build_priority_queue
from schemas import AgentRunRequest, AgentRunResponse, PrioritizeDemandRequest, PrioritizeDemandResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("agent")

app = FastAPI(title="Commercial Recovery Planning Agent", version="0.2.0")

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
    log.info(
        "Starting agent run (workflow=%s, buyer=%s, materials=%s, max_kg=%s, preferred=%s)",
        req.workflow_id, req.target_buyer_id,
        req.target_material_types, req.max_quantity_kg, req.preferred_route,
    )
    try:
        state = await run_workflow(
            workflow_id=str(req.workflow_id) if req.workflow_id else None,
            target_buyer_id=str(req.target_buyer_id) if req.target_buyer_id else None,
            target_material_types=req.target_material_types,
            max_quantity_kg=req.max_quantity_kg,
            preferred_route=req.preferred_route,
            priority_objective=req.priority_objective,
        )
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
        priorityObjective=state.get("priority_objective", "net_value"),
        pricingAgeDays=state.get("pricing_age_days"),
        routeScores=state.get("route_scores", []),
    )


@app.post("/prioritize-demand", response_model=PrioritizeDemandResponse)
async def prioritize_demand(req: PrioritizeDemandRequest) -> PrioritizeDemandResponse:
    """
    Rank competing buyer demand for saleable stock, then hand the order back.

    The .NET matcher calls this before it decides which waiting material request to turn
    into a commercial plan. With `candidates` supplied it ranks exactly those; without
    them it fetches open demand with its own tool, so the same endpoint answers
    "what should we sell next?" for a dashboard too.
    """
    log.info(
        "Prioritising demand (material=%s, capacity=%s, objective=%s, supplied_candidates=%s)",
        req.material_type, req.capacity_kg, req.objective,
        len(req.candidates) if req.candidates else "fetched",
    )
    try:
        return await build_priority_queue(
            material_type=req.material_type,
            capacity_kg=req.capacity_kg,
            objective=req.objective,
            candidates=req.candidates,
        )
    except Exception as exc:
        log.exception("Demand prioritisation failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc