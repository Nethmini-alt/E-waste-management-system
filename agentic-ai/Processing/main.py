import logging
import time

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from graph.nodes import validate_node
from graph.state import ValidatorState
from schemas import ValidatorRunRequest, ValidatorRunResponse
from tools import processing_tools as tools

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("validator-agent")

app = FastAPI(title="Validator Agent — Component C", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "Validator"}


@app.post("/run", response_model=ValidatorRunResponse)
async def run(req: ValidatorRunRequest) -> ValidatorRunResponse:
    started = time.time()
    rules = await tools.get_business_rules()

    state: ValidatorState = {
        "workflow_id": str(req.workflow_id),
        "submission_id": str(req.submission_id),
        "analyzer_result": req.analyzer_result,
        "rules": rules,
    }

    try:
        state = validate_node(state)
    except Exception as exc:
        await tools.log_execution(req.workflow_id, 3, req.model_dump(mode="json"), None, False, str(exc))
        log.exception("Validator run failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    result = {
        "approved_for_auto_assignment": state["approved_for_auto_assignment"],
        "requires_human_approval": state["requires_human_approval"],
        "reasons": state["reasons"],
    }
    await tools.submit_validation(req.workflow_id, result)
    await tools.log_execution(req.workflow_id, 3, req.model_dump(mode="json"), result, True, None)
    log.info("Validator run done in %.2fs (workflow=%s, approved=%s)",
              time.time() - started, req.workflow_id, result["approved_for_auto_assignment"])

    return ValidatorRunResponse(
        workflowId=req.workflow_id,
        approvedForAutoAssignment=result["approved_for_auto_assignment"],
        requiresHumanApproval=result["requires_human_approval"],
        reasons=result["reasons"],
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8004, reload=True)
