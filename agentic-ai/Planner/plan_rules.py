"""The plan: a small DAG of steps, each owned by one agent, and the deterministic rules that make
sure any plan (ours, or one handed back by a caller for a revision) is safe to execute.

`validate_plan` is the guard: a plan that skips the Validator, reorders the safety gate after the
Matcher, invents an agent/action, repeats a step or contains a cycle is rejected before anything runs.
"""
from __future__ import annotations

from shared.contracts import Plan, PlanStep

# action -> the ONLY agent allowed to perform it
CATALOG: dict[str, str] = {
    "analyze_submission": "analyzer",
    "validate_analysis": "validator",
    "match_collector": "matcher",
    "finalize_proposal": "planner",
}
DESCRIPTIONS = {
    "analyze_submission": "Classify the waste; estimate weight, hazard and recoverable value.",
    "validate_analysis": "Apply deterministic safety and business rules; decide auto-proceed, human review or reject.",
    "match_collector": "Find the best available collector and propose a pickup window.",
    "finalize_proposal": "Choose the handling path, value the load and assemble the proposal for approval.",
}
DEFAULT_OBJECTIVE = "Assess this submission and create an optimal, safe collection plan."


def build_template_steps() -> list[PlanStep]:
    order = list(CATALOG)
    return [PlanStep(id=a, agent=CATALOG[a], action=a, description=DESCRIPTIONS[a],  # type: ignore[arg-type]
                     depends_on=[order[i - 1]] if i else [])
            for i, a in enumerate(order)]


def _ancestors(step_id: str, deps: dict[str, list[str]], seen: set[str] | None = None) -> set[str]:
    seen = seen if seen is not None else set()
    for d in deps.get(step_id, []):
        if d not in seen:
            seen.add(d)
            _ancestors(d, deps, seen)
    return seen


def validate_plan(plan: Plan | dict) -> list[str]:
    """Return a list of problems; an empty list means the plan may be executed."""
    try:
        steps = (plan if isinstance(plan, Plan) else Plan.model_validate(plan)).steps
    except Exception:
        return ["plan is not a valid Plan structure"]
    problems: list[str] = []
    ids = [s.id for s in steps]
    if len(set(ids)) != len(ids):
        problems.append("duplicate step ids")
    actions = [s.action for s in steps]
    for step in steps:
        if step.action not in CATALOG:
            problems.append(f"unknown action '{step.action[:40]}'")
        elif CATALOG[step.action] != step.agent:
            problems.append(f"action '{step.action}' may only be run by '{CATALOG[step.action]}', not '{step.agent}'")
        if step.id != step.action:
            problems.append(f"step id '{step.id[:40]}' must equal its action")
    for required in CATALOG:
        if actions.count(required) != 1:
            problems.append(f"required step '{required}' must appear exactly once")
    if problems:
        return problems

    deps = {s.id: s.depends_on for s in steps}
    for step in steps:
        for d in step.depends_on:
            if d not in deps:
                problems.append(f"'{step.id}' depends on missing step '{d[:40]}'")
    if problems:
        return problems
    for step in steps:
        if step.id in _ancestors(step.id, deps):
            problems.append(f"cycle involving '{step.id}'")
    if problems:
        return problems

    # Safety ordering, independent of whatever the plan says:
    if "analyze_submission" not in _ancestors("validate_analysis", deps):
        problems.append("validation must come after analysis")
    if "validate_analysis" not in _ancestors("match_collector", deps):
        problems.append("collector matching must come after validation")
    if not {"analyze_submission", "validate_analysis", "match_collector"} <= _ancestors("finalize_proposal", deps):
        problems.append("the final proposal must come after analysis, validation and matching")
    return problems
