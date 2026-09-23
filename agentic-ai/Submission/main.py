import logging
import time

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from graph.nodes import classify_node
from graph.state import AnalyzerState
from schemas import AnalyzerRunRequest, AnalyzerRunResponse
from tools import submission_tools as tools

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("analyzer-agent")

app = FastAPI(title="Analyzer Agent — Component A", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "Analyzer"}


@app.post("/run", response_model=AnalyzerRunResponse)
async def run(req: AnalyzerRunRequest) -> AnalyzerRunResponse:
    started = time.time()
    log.info("Analyzer run starting (workflow=%s, submission=%s)", req.workflow_id, req.submission_id)

    submission = await tools.get_submission(req.submission_id)
    state: AnalyzerState = {"workflow_id": str(req.workflow_id), "submission": submission}

    try:
        state = await classify_node(state)
    except Exception as exc:
        await tools.log_execution(req.workflow_id, 2, req.model_dump(), None, False, str(exc))
        log.exception("Analyzer run failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    result = {
        "waste_category": state["waste_category"],
        "hazard_level": state["hazard_level"],
        "estimated_volume_kg": state["estimated_volume_kg"],
        "estimated_value_usd": state["estimated_value_usd"],
        "confidence_score": state["confidence_score"],
    }
    await tools.submit_analysis(req.workflow_id, result)
    await tools.log_execution(
        req.workflow_id, 2, req.model_dump(), result,
        succeeded=not state.get("errors"), error_message="; ".join(state.get("errors", [])) or None,
    )
    log.info("Analyzer run done in %.2fs (workflow=%s)", time.time() - started, req.workflow_id)

    return AnalyzerRunResponse(
        workflowId=req.workflow_id,
        wasteCategory=result["waste_category"],
        hazardLevel=result["hazard_level"],
        estimatedVolumeKg=result["estimated_volume_kg"],
        estimatedValueUsd=result["estimated_value_usd"],
        confidenceScore=result["confidence_score"],
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8003, reload=True)
