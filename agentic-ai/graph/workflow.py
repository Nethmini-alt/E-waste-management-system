"""The graph that connects the four agents, and the runner that executes it safely.

    START -> planner_plan -> [dispatcher] -> analyzer -> [dispatcher] -> validator -> [dispatcher]
          -> matcher -> [dispatcher] -> planner_finalize -> END
                                   `-> safe_failure -> END     (validator rejected / plan invalid / no analysis)

DELEGATION IS REAL: after every step, `dispatch` reads the Planner's validated plan and routes to the
agent that owns the next unfinished step. The hard safety rule (a Validator rejection stops everything;
nothing runs from an invalid plan) lives in `dispatch`, not in anyone's prompt.

HUMAN APPROVAL: the graph does not wait in memory. It ends with outcome PendingApproval and the whole
state is reported to ASP.NET Core; approve / reject / revise arrive later as separate requests.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from langgraph.graph import END, START, StateGraph

from Analyzer import AnalyzerAgent, default_analyzer_factory, make_analyzer_node
from Matcher import MatcherAgent, default_matcher_factory, make_matcher_node
from Planner import PlannerAgent, default_planner_factory, make_planner_nodes, validate_plan
from Validator import ValidatorAgent, make_validator_node
from shared.contracts import AnalyzerOutput, ReviseRequest, StartWorkflowRequest, StepRecord, utcnow
from shared.reporter import WorkflowReporter
from shared.state import WorkflowState

log = logging.getLogger("agentic-ai.graph")

NODE_FOR_ACTION = {
    "analyze_submission": "analyzer",
    "validate_analysis": "validator",
    "match_collector": "matcher",
    "finalize_proposal": "planner_finalize",
}


@dataclass
class AgentFactories:
    """Per-run agent constructors (a fresh gateway each run). Tests inject fakes here."""
    analyzer: Callable[[str], AnalyzerAgent]
    validator: Callable[[str], ValidatorAgent]
    matcher: Callable[[str], MatcherAgent]
    planner: Callable[[str], PlannerAgent]

    @classmethod
    def default(cls) -> "AgentFactories":
        return cls(default_analyzer_factory, lambda workflow_id: ValidatorAgent(), default_matcher_factory,
                   default_planner_factory)


# ------------------------------------------------------------------ routing
def dispatch(state: dict) -> str:
    """Decide the next node from the plan. Returns a node name, 'safe_failure' or 'end'."""
    if state.get("outcome"):
        return "end"
    if (state.get("validation") or {}).get("decision") == "Rejected":
        return "safe_failure"
    plan = state.get("plan")
    if not plan or validate_plan(plan):
        return "safe_failure"            # never execute a missing or unsafe plan
    done = set(state.get("completed_steps") or [])
    for step in plan["steps"]:
        if step["id"] in done:
            continue
        if all(dep in done for dep in step["depends_on"]):
            return NODE_FOR_ACTION[step["action"]]
        return "safe_failure"
    return "end"


def entry(state: dict) -> str:
    return dispatch(state) if state.get("plan") else "planner_plan"   # revisions re-enter with a plan


def _mark(action: str, node: Callable[[dict], Awaitable[dict]]) -> Callable[[dict], Awaitable[dict]]:
    """Keep agents ignorant of orchestration: the graph records which plan step just finished."""
    async def wrapped(state: dict) -> dict:
        update = dict(await node(state))
        update["completed_steps"] = [action]
        return update
    return wrapped


def build_graph(factories: AgentFactories | None = None):
    f = factories or AgentFactories.default()
    plan_node, finalize_node, failure_node = make_planner_nodes(f.planner)

    g = StateGraph(WorkflowState)
    g.add_node("planner_plan", plan_node)
    g.add_node("analyzer", _mark("analyze_submission", make_analyzer_node(f.analyzer)))
    g.add_node("validator", _mark("validate_analysis", make_validator_node(f.validator)))
    g.add_node("matcher", _mark("match_collector", make_matcher_node(f.matcher)))
    g.add_node("planner_finalize", _mark("finalize_proposal", finalize_node))
    g.add_node("safe_failure", failure_node)

    routes = {"analyzer": "analyzer", "validator": "validator", "matcher": "matcher",
              "planner_finalize": "planner_finalize", "safe_failure": "safe_failure", "end": END}
    g.add_conditional_edges(START, entry, {**routes, "planner_plan": "planner_plan"})
    for node in ("planner_plan", "analyzer", "validator", "matcher"):
        g.add_conditional_edges(node, dispatch, routes)
    g.add_edge("planner_finalize", END)
    g.add_edge("safe_failure", END)
    return g.compile()


# ------------------------------------------------------------------ inputs
def initial_state(req: StartWorkflowRequest) -> dict[str, Any]:
    text = [f"{i.item_name}: {i.description}".strip(": ").strip() for i in req.items]
    text += [f"{r.item_type} {r.condition or ''}".strip() for r in req.csv_items]
    state: dict[str, Any] = {
        "workflow_id": str(req.workflow_id), "submission_id": str(req.submission_id),
        "submission_type": req.submission_type, "objective": req.objective or "",
        "pickup_address": req.pickup_address,
        "description": "\n".join(t for t in text if t)[:8000],   # ALL untrusted text: what the Validator screens
        "items": [i.model_dump(mode="json") for i in req.items],
        "csv_items": [r.model_dump(mode="json") for r in req.csv_items],
        "exclude_collector_ids": [], "revision_count": 0,
        "completed_steps": [], "steps": [], "errors": [],
    }
    for key in ("pickup_latitude", "pickup_longitude"):
        if getattr(req, key) is not None:
            state[key] = getattr(req, key)
    for key in ("preferred_window_start", "preferred_window_end"):
        if getattr(req, key) is not None:
            state[key] = getattr(req, key).isoformat()
    return state


class RevisionError(ValueError):
    pass


def revision_state(previous: dict[str, Any], request: ReviseRequest, max_revisions: int) -> dict[str, Any]:
    """Re-enter the graph after 'Request revision'. Only the Analyzer's work is kept: the Validator, Matcher
    and Planner re-run, so a stale or tampered validation result can never carry a revision through."""
    count = int(previous.get("revision_count") or 0) + 1
    if count > max_revisions:
        raise RevisionError(f"Revision limit of {max_revisions} reached.")
    if validate_plan(previous.get("plan") or {}):
        raise RevisionError("Previous state does not contain a valid plan.")
    try:
        AnalyzerOutput.model_validate(previous.get("analysis") or {})
    except Exception:
        raise RevisionError("Previous state does not contain a usable analysis.") from None

    fb = request.feedback
    keep = ("workflow_id", "submission_id", "submission_type", "objective", "pickup_address", "pickup_latitude",
            "pickup_longitude", "description", "items", "csv_items", "plan", "analysis")
    state = {k: previous[k] for k in keep if k in previous}
    state.update(
        completed_steps=["analyze_submission"], steps=[], errors=[], revision_count=count,
        exclude_collector_ids=list(dict.fromkeys([*map(str, previous.get("exclude_collector_ids") or []),
                                                  *map(str, fb.exclude_collector_ids)])))
    start = fb.preferred_window_start.isoformat() if fb.preferred_window_start else previous.get("preferred_window_start")
    end = fb.preferred_window_end.isoformat() if fb.preferred_window_end else previous.get("preferred_window_end")
    if start and end:
        state.update(preferred_window_start=start, preferred_window_end=end)
    return state


# ------------------------------------------------------------------ result + runner
def build_result(state: dict[str, Any]) -> dict[str, Any]:
    return {
        "workflow_id": state.get("workflow_id"), "submission_id": state.get("submission_id"),
        "outcome": state.get("outcome") or "SafeFailure", "failure_reason": state.get("failure_reason"),
        "revision_count": state.get("revision_count", 0), "plan": state.get("plan"),
        "analysis": state.get("analysis"), "validation": state.get("validation"), "match": state.get("match"),
        "proposal": state.get("proposal"), "errors": state.get("errors") or [], "step_count": len(state.get("steps") or []),
    }


async def run_workflow(graph, state: dict[str, Any], reporter: WorkflowReporter,
                       timeout_seconds: float = 120.0) -> tuple[dict[str, Any], dict[str, Any]]:
    """Run the graph, streaming each finished step to `reporter`. Never raises: any crash or timeout
    becomes a recorded SafeFailure. Returns (result, final_state)."""
    wid = state.get("workflow_id", "unknown")
    holder: dict[str, Any] = {"state": dict(state), "reported": 0}

    async def _drive() -> None:
        async for current in graph.astream(state, stream_mode="values"):
            holder["state"] = current
            steps = current.get("steps") or []
            for step in steps[holder["reported"]:]:
                await reporter.report_step(wid, step)
            holder["reported"] = len(steps)

    failure: str | None = None
    try:
        await asyncio.wait_for(_drive(), timeout=timeout_seconds)
    except asyncio.TimeoutError:
        failure = f"Workflow exceeded the {timeout_seconds:.0f}s time limit."
    except Exception as exc:                      # containment boundary: report the class, log the detail
        log.exception("Workflow %s crashed", wid)
        failure = f"Unexpected internal error ({type(exc).__name__})."

    final = holder["state"]
    if failure:
        record = StepRecord(workflow_id=str(wid), agent="orchestrator", step_name="runtime_failure",
                            status="failed", started_at=utcnow(), duration_ms=0, error=failure,
                            output={"outcome": "SafeFailure"})
        final = {**final, "outcome": "SafeFailure", "failure_reason": failure,
                 "errors": [*(final.get("errors") or []), failure],
                 "steps": [*(final.get("steps") or []), record.model_dump(mode="json")]}
        await reporter.report_step(wid, record.model_dump(mode="json"))
    result = build_result(final)
    await reporter.report_result(wid, result)
    return result, final
