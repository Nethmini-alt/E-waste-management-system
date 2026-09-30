"""
Buyer-demand priority — the Sales agent's "who do we serve first?" decision layer.

The .NET backend used to answer that question itself: MaterialRestockMatcher ranked
waiting material requests with `OrderByDescending(EstimateNetValue(...))` and only then
called this agent, once per ranked request. The ranking was therefore a backend
revenue-first rule with no explanation, and the agent never saw the competing demand —
which is precisely what made it look weak.

Now the backend asks for the order first (POST /prioritize-demand) and keeps its
net-value sort only as the offline fallback it uses when this service is unreachable.

Division of labour, same as Planner's:
  * the model (when GOOGLE_API_KEY is configured) chooses WHICH objective to optimise
    and writes the prose a human reads;
  * the deterministic tools in tools/commercial_tools.py do the rupees, the kilograms,
    the feasibility rules and the ordering — so the queue is reproducible and auditable.
"""

import logging

from config import settings
from graph.llm import as_text, get_llm, model_name
from schemas import (
    DemandCandidate,
    ObjectiveChoice,
    PrioritizeDemandResponse,
    ReasoningNarrative,
)
from tools import commercial_tools as tools

log = logging.getLogger("agent.priority")


def _objective_prompt(
    pool: list[DemandCandidate], capacity_kg: float | None, material_type: str | None
) -> str:
    export_count = sum(
        1 for c in pool if tools.cost_rate_for(c.buyer_type) == tools.EXPORT_COST_RATE
    )
    backlog_kg = round(sum(c.quantity_kg for c in pool), 2)
    longest_wait = max((c.waiting_hours or 0.0) for c in pool)
    prices = [c.price_per_kg for c in pool if c.price_per_kg]
    price_range = f"{min(prices):,.2f} / {max(prices):,.2f}" if prices else "unpriced"

    return (
        "You are choosing the stock-allocation policy for an e-waste sales desk.\n"
        "Pick exactly one objective for ranking the buyer demand below.\n"
        "net_value = highest expected net value first (best money for one decision)\n"
        "throughput = most kilograms first (clears the warehouse fastest)\n"
        "margin_per_kg = highest net value per kilogram first (best rate)\n"
        "fifo = longest-waiting buyer first (fairness; stops big orders starving small ones)\n"
        "export_first = committed export demand before local demand\n\n"
        f"Material: {material_type or 'all materials'}\n"
        f"Unclaimed stock: {'unlimited' if capacity_kg is None else f'{capacity_kg:g} kg'}\n"
        f"Open requests: {len(pool)} ({export_count} export, {len(pool) - export_count} local), "
        f"{backlog_kg:g} kg in total\n"
        f"Longest wait: {longest_wait:.1f} h\n"
        f"Live price per kg: {price_range}\n"
    )


async def _choose_objective(
    explicit: str | None,
    pool: list[DemandCandidate],
    capacity_kg: float | None,
    material_type: str | None,
    llm,
) -> tuple[str, str]:
    """Returns (objective, why). The caller may override; the model reasons otherwise."""
    if explicit and explicit in tools.RANKING_OBJECTIVES:
        return explicit, f"Objective '{explicit}' was requested by the caller."

    default = settings.default_priority_objective
    if default not in tools.RANKING_OBJECTIVES:
        default = "net_value"

    if llm is None:
        return default, (
            f"No model configured, so the priority tool used the default '{default}' "
            "objective — the same net-value ordering the backend used to apply on its own."
        )

    try:
        choice: ObjectiveChoice = await llm.with_structured_output(ObjectiveChoice).ainvoke(
            _objective_prompt(pool, capacity_kg, material_type)
        )
    except Exception as exc:  # a flaky model must never break stock allocation
        log.warning("Objective choice failed (%s); falling back to '%s'", exc, default)
        return default, f"Objective choice call failed ({exc}); used the default '{default}' objective."

    if choice.objective in tools.RANKING_OBJECTIVES:
        return choice.objective, choice.reason.strip()

    return default, (
        f"Model suggested an unknown objective '{choice.objective}'; "
        f"used the default '{default}' objective instead."
    )


def _served_kg(ranked, capacity_kg: float | None) -> float:
    """
    How much of the unclaimed stock the queue actually covers — a greedy walk, because
    that is what the matcher will really do with it (one request at a time, in order).
    """
    if capacity_kg is None:
        return round(sum(item.quantity_kg for item in ranked if item.feasible), 2)

    remaining, served = capacity_kg, 0.0
    for item in ranked:
        if item.feasible and item.quantity_kg <= remaining:
            served += item.quantity_kg
            remaining -= item.quantity_kg
    return round(served, 2)


def _deterministic_summary(
    ranked, strategy: str, material_type: str | None,
    capacity_kg: float | None, served_kg: float,
) -> str:
    feasible = [item for item in ranked if item.feasible]
    blocked = len(ranked) - len(feasible)
    scope = (
        f" within the {capacity_kg:g} kg of unclaimed stock"
        if capacity_kg is not None else ""
    )

    if not feasible:
        return (
            f"None of the {len(ranked)} open request(s) for {material_type or 'any material'} "
            f"can be served now{scope}; all {len(ranked)} are blocked and stay as backorders."
        )

    top = feasible[0]
    covered = (
        f"With {capacity_kg:g} kg unclaimed, the queue covers {served_kg:g} kg of it."
        if capacity_kg is not None
        else f"The queue covers {served_kg:g} kg of open demand."
    )
    return (
        f"{len(ranked)} open request(s) for {material_type or 'all materials'}: "
        f"{len(feasible)} can be served{scope} and {blocked} are blocked. "
        f"Ranked by '{strategy}'. First pick: "
        f"{top.buyer_company_name or top.buyer_type} for {top.quantity_kg:g} kg "
        f"(net Rs. {top.expected_net_value:,.2f}, waiting {top.waiting_hours:.1f} h). "
        f"{covered}"
    )


async def _narrate(llm, facts: str) -> str:
    try:
        narrative: ReasoningNarrative = await llm.with_structured_output(
            ReasoningNarrative
        ).ainvoke(
            "Rewrite these stock-allocation facts as two clear sentences for a sales "
            f"dashboard. Keep every number, add no new ones: {facts}"
        )
        rewritten = as_text(getattr(narrative, "summary", "") or "")
        return rewritten or facts
    except Exception as exc:
        log.warning("Priority narration failed (%s); keeping the deterministic summary", exc)
        return facts


async def build_priority_queue(
    material_type: str | None = None,
    capacity_kg: float | None = None,
    objective: str | None = None,
    candidates: list[DemandCandidate] | None = None,
) -> PrioritizeDemandResponse:
    """
    Rank competing buyer demand for saleable stock.

    `candidates` come from the backend's matcher when it is deciding which request to
    turn into a plan right now; when they are omitted the agent fetches open demand with
    its own tool, which makes this endpoint usable as a standalone backlog review.
    """
    pool = list(candidates) if candidates else await tools.get_open_material_requests(material_type)

    llm = get_llm()
    strategy, strategy_reason = await _choose_objective(
        objective, pool, capacity_kg, material_type, llm
    )

    if not pool:
        return PrioritizeDemandResponse(
            strategy=strategy,
            strategy_reason=strategy_reason,
            reasoning_summary=(
                f"No open buyer demand for {material_type or 'any material'}; nothing to rank."
            ),
            ranked=[],
            candidates_considered=0,
            capacity_kg=capacity_kg,
            served_kg=0.0,
            agent_model=model_name(),
        )

    ranked = tools.rank_demand_candidates(pool, capacity_kg, strategy)
    served_kg = _served_kg(ranked, capacity_kg)
    summary = _deterministic_summary(ranked, strategy, material_type, capacity_kg, served_kg)
    if llm is not None:
        summary = await _narrate(llm, summary)

    return PrioritizeDemandResponse(
        strategy=strategy,
        strategy_reason=strategy_reason,
        reasoning_summary=summary,
        ranked=ranked,
        candidates_considered=len(ranked),
        capacity_kg=capacity_kg,
        served_kg=served_kg,
        agent_model=model_name(),
    )
