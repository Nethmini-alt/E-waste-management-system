import json
from datetime import date
from uuid import UUID, uuid4

import httpx

from config import settings
from schemas import (
    MaterialBatch,
    ApprovedPrice,
    EligibleBuyer,
    MaterialToPlan,
    DemandCandidate,
    PrioritizedDemand,
)


# ---------- HTTP client with API key ----------

def _headers() -> dict:
    return {"X-Agent-Key": settings.agent_api_key}


async def _get(path: str, params: dict | None = None):
    async with httpx.AsyncClient(base_url=settings.api_base_url, timeout=30.0) as client:
        r = await client.get(path, params=params, headers=_headers())
        r.raise_for_status()
        return r.json()


async def _post(path: str, payload: dict):
    async with httpx.AsyncClient(base_url=settings.api_base_url, timeout=30.0) as client:
        r = await client.post(path, json=payload, headers=_headers())
        r.raise_for_status()
        return r.json()


# ---------- Cost model — one definition, shared by everything below ----------
# These three numbers are the commercial model of this system. They are duplicated in
# the .NET backend (MaterialRestockMatcher.EstimateNetValue) on purpose: the backend's
# copy is only the OFFLINE FALLBACK for when this agent is unreachable, so both sides
# must agree on what a request is worth.

LOCAL_COST_RATE = 0.05      # local: logistics + processing
EXPORT_COST_RATE = 0.12     # export: shipping + customs + documentation
EXPORT_MIN_KG = 20.0        # mirrors ExportOrderService / MaterialRequestService

# Prices older than this get flagged, not refused — see pricing_age_days().
PRICING_STALE_DAYS = 30


def cost_rate_for(buyer_type: str) -> float:
    """Export demand costs more to serve than local demand."""
    return EXPORT_COST_RATE if (buyer_type or "").strip().lower() == "export" else LOCAL_COST_RATE



# ---------- Tool 1: getAvailableRecoveredMaterials ----------

async def get_available_recovered_materials() -> list[MaterialBatch]:
    data = await _get("/api/agent/materials/available")
    return [MaterialBatch(**m) for m in data]


# ---------- Tool 2: getCurrentMaterialPricing ----------

async def get_current_material_pricing() -> list[ApprovedPrice]:
    data = await _get("/api/agent/pricing/approved")
    return [ApprovedPrice(**p) for p in data]


# ---------- Tool 3: getEligibleBuyers ----------

async def get_eligible_buyers() -> list[EligibleBuyer]:
    data = await _get("/api/agent/buyers/eligible")
    return [EligibleBuyer(**b) for b in data]


# ---------- Tool 4: getBuyerOffers ----------

async def get_buyer_offers(buyer_id: UUID) -> list[dict]:
    return await _get(f"/api/agent/buyers/{buyer_id}/offers")


# ---------- Tool 5: calculateCommercialValue ----------

def calculate_commercial_value(
    materials: list[MaterialBatch],
    prices: list[ApprovedPrice],
) -> list[MaterialToPlan]:
    """
    Deterministic: joins materials to their approved price and computes line value.
    No LLM involved — this is the tool that enforces arithmetic correctness.
    """
    price_map = {p.material_type: p.price_per_kg for p in prices}
    result: list[MaterialToPlan] = []

    for m in materials:
        unit_price = price_map.get(m.material_type)
        if unit_price is None:
            # Skip materials with no approved price — they're not sellable yet
            continue
        result.append(
            MaterialToPlan(
                recovered_material_id=m.recovered_material_id,
                material_type=m.material_type,
                quantity_kg=m.quantity_kg,
                quality_grade=m.quality_grade,
                unit_price=unit_price,
                line_value=round(m.quantity_kg * unit_price, 2),
            )
        )

    return result


# ---------- Tool 6: compareCommercialOptions ----------

def compare_commercial_options(
    materials: list[MaterialToPlan],
    buyers: list[EligibleBuyer],
) -> dict:
    """
    Deterministic comparison of Local vs Export routes.
    Returns metrics the LLM uses to justify its recommendation.
    """
    total_revenue = round(sum(m.line_value for m in materials), 2)
    total_kg = round(sum(m.quantity_kg for m in materials), 2)

    local_buyers = [b for b in buyers if b.buyer_type == "Local"]
    export_buyers = [b for b in buyers if b.buyer_type == "Export"]

    # Cost model (simple, defensible for a student project):
    # - Local: 5% of revenue (logistics + processing)
    # - Export: 12% of revenue (shipping + customs + docs)
    local_costs = round(total_revenue * LOCAL_COST_RATE, 2)
    export_costs = round(total_revenue * EXPORT_COST_RATE, 2)

    local_net = round(total_revenue - local_costs, 2)
    export_net = round(total_revenue - export_costs, 2)

    # Export minimum weight rule (mirrors ExportOrderService)
    export_feasible = total_kg >= EXPORT_MIN_KG and len(export_buyers) > 0

    return {
        "total_revenue": total_revenue,
        "total_kg": total_kg,
        "local": {
            "costs": local_costs,
            "net": local_net,
            "eligible_buyers": [str(b.buyer_id) for b in local_buyers],
            "feasible": len(local_buyers) > 0,
        },
        "export": {
            "costs": export_costs,
            "net": export_net,
            "eligible_buyers": [str(b.buyer_id) for b in export_buyers],
            "feasible": export_feasible,
        },
    }


# ---------- Tool 7: createCommercialPlan ----------

async def create_commercial_plan(payload: dict) -> dict:
    """
    Submits the structured plan to ASP.NET Core for human approval.
    The backend stores it as PendingApproval and logs a 'Submitted' action.
    """
    return await _post("/api/commercial-plans", payload)


# ---------- Tool 8: getOpenMaterialRequests ----------

async def get_open_material_requests(material_type: str | None = None) -> list[DemandCandidate]:
    """
    Open buyer demand — Waiting, WaitingForPrice and PlanGenerationFailed requests from
    Active buyers, each with the live approved price for its material.

    This is what lets the agent prioritise on its own: before this existed the only code
    that knew which buyer requests were waiting was the backend's matcher.
    """
    params = {"materialType": material_type} if material_type else None
    data = await _get("/api/agent/material-requests/open", params=params)
    return [DemandCandidate(**row) for row in data]


# ---------- Priority objectives ----------
# "Priority" is a policy, so it is a named objective instead of a hidden sort order.
# The model picks one (graph/priority.py); these functions do the ranking, so a model
# having a bad day can never produce bad rupee arithmetic.

RANKING_OBJECTIVES = ("net_value", "throughput", "margin_per_kg", "fifo", "export_first")

# Route objectives. Honest note: for route choice these two coincide today — both routes
# sell the same batches at the same approved prices, so the ONLY difference is the cost
# rate (5% local vs 12% export), and a higher cost rate means lower net *and* lower net
# per kg. Export therefore only ever wins when the caller asks for it (preferred_route),
# which is exactly how the old hand-written if/else behaved in practice. The rule still
# belongs in a tool rather than in the graph: the comparison is explicit, scored and
# returned to the API for audit, and a future export price premium is a one-line change
# here instead of a rewrite of decide_node.
ROUTE_OBJECTIVES = ("net_value", "margin_per_kg")


def _rank_key(objective: str, row: dict) -> tuple:
    """Sort key for one scored candidate. Lower sorts first, never mixes types."""
    is_export_flag = 0 if row["is_export"] else 1
    if objective == "throughput":
        return (-row["quantity_kg"], -row["expected_net_value"], row["order"])
    if objective == "margin_per_kg":
        return (-row["net_per_kg"], -row["expected_net_value"], row["order"])
    if objective == "fifo":
        return (-row["waiting_hours"], -row["expected_net_value"], row["order"])
    if objective == "export_first":
        return (is_export_flag, -row["expected_net_value"], row["order"])
    # net_value — the historical backend behaviour, and the default
    return (-row["expected_net_value"], -row["net_per_kg"], row["order"])


def _priority_score(objective: str, row: dict) -> float:
    """The objective's headline number, reported so a human can audit the order."""
    if objective == "throughput":
        return row["quantity_kg"]
    if objective == "margin_per_kg":
        return row["net_per_kg"]
    if objective == "fifo":
        return row["waiting_hours"]
    # net_value and export_first both report net value; under export_first the export
    # group simply sorts ahead of it, which the rationale states explicitly.
    return row["expected_net_value"]


def _score_demand(candidate: DemandCandidate, capacity_kg: float | None, order: int) -> dict:
    """Feasibility + money for one candidate. Pure arithmetic, no policy."""
    quantity = float(candidate.quantity_kg)
    cost_rate = cost_rate_for(candidate.buyer_type)
    is_export = cost_rate == EXPORT_COST_RATE

    blocked: list[str] = []
    if candidate.price_per_kg is None or candidate.price_per_kg <= 0:
        revenue = net = net_per_kg = 0.0
        blocked.append("no live approved price, so it cannot be priced yet")
    else:
        revenue = round(quantity * candidate.price_per_kg, 2)
        net = round(revenue * (1 - cost_rate), 2)
        net_per_kg = round(candidate.price_per_kg * (1 - cost_rate), 2)

    if is_export and quantity < EXPORT_MIN_KG:
        blocked.append(f"below the {EXPORT_MIN_KG:g} kg export minimum")
    if capacity_kg is not None and quantity > capacity_kg:
        blocked.append(f"needs {quantity:g} kg but only {capacity_kg:g} kg of stock is unclaimed")

    return {
        "candidate": candidate,
        "order": order,
        "is_export": is_export,
        "cost_rate": cost_rate,
        "quantity_kg": quantity,
        "expected_revenue": revenue,
        "expected_net_value": net,
        "net_per_kg": net_per_kg,
        "waiting_hours": float(candidate.waiting_hours or 0.0),
        "feasible": not blocked,
        "blocked": blocked,
    }


def rank_demand_candidates(
    candidates: list[DemandCandidate],
    capacity_kg: float | None = None,
    objective: str = "net_value",
) -> list[PrioritizedDemand]:
    """
    THE priority tool: given competing buyer demand and the unclaimed stock, decide who
    gets served first.

    Deterministic on purpose — the ranking moves money (which buyer's request becomes a
    commercial plan and which stays a backorder), so it must be reproducible and
    explainable rather than a model's opinion. Feasible candidates come first, ranked by
    the chosen objective; blocked ones follow with the blocking reason attached.
    """
    chosen = objective if objective in RANKING_OBJECTIVES else "net_value"
    scored = [_score_demand(candidate, capacity_kg, index)
              for index, candidate in enumerate(candidates)]
    ordered = sorted(scored,
                     key=lambda row: (0 if row["feasible"] else 1, _rank_key(chosen, row)))

    result: list[PrioritizedDemand] = []
    for rank, row in enumerate(ordered, start=1):
        candidate: DemandCandidate = row["candidate"]
        company = candidate.buyer_company_name or f"{candidate.buyer_type} buyer"
        rationale = (
            f"{company} wants {row['quantity_kg']:g} kg {candidate.material_type or 'material'} — "
            f"net Rs. {row['expected_net_value']:,.2f} (Rs. {row['net_per_kg']:,.2f}/kg after the "
            f"{row['cost_rate']:.0%} {candidate.buyer_type.lower()} cost rate), "
            f"waiting {row['waiting_hours']:.1f} h."
        )
        if row["blocked"]:
            rationale += " Blocked: " + "; ".join(row["blocked"]) + "."
        else:
            rationale += f" Rank #{rank} under the '{chosen}' objective."

        result.append(PrioritizedDemand(
            material_request_id=candidate.material_request_id,
            buyer_id=candidate.buyer_id,
            buyer_company_name=candidate.buyer_company_name,
            buyer_type=candidate.buyer_type,
            material_type=candidate.material_type,
            quantity_kg=row["quantity_kg"],
            priority_rank=rank,
            priority_score=round(_priority_score(chosen, row), 2),
            objective=chosen,
            expected_revenue=row["expected_revenue"],
            expected_net_value=row["expected_net_value"],
            net_per_kg=row["net_per_kg"],
            cost_rate_applied=row["cost_rate"],
            waiting_hours=row["waiting_hours"],
            feasible=row["feasible"],
            factors={
                "quantityKg": row["quantity_kg"],
                "netPerKg": row["net_per_kg"],
                "expectedNetValue": row["expected_net_value"],
                "waitingHours": row["waiting_hours"],
                "exportFlag": 1.0 if row["is_export"] else 0.0,
            },
            rationale=rationale,
        ))

    return result


# ---------- Tool 9: selectMaterialsWithinCap ----------

def select_materials_within_cap(
    planned: list[MaterialToPlan], max_kg: float | None
) -> list[MaterialToPlan]:
    """
    Fills a quantity cap with the highest value-per-kg batches first (FIFO within equal
    prices) and splits the batch that straddles the cap.

    The previous behaviour kept batches in whatever order the backend listed them, so a
    small high-grade batch could be left on the shelf while a bulk low-grade one used up
    the whole cap. Same total weight, better money.
    """
    if max_kg is None or max_kg <= 0 or not planned:
        return planned

    ranked = sorted(enumerate(planned), key=lambda pair: (-pair[1].unit_price, pair[0]))
    selected: list[tuple[int, MaterialToPlan]] = []
    remaining = max_kg
    for index, material in ranked:
        if remaining <= 0:
            break
        if material.quantity_kg <= remaining:
            selected.append((index, material))
            remaining -= material.quantity_kg
        else:
            selected.append((index, MaterialToPlan(
                recovered_material_id=material.recovered_material_id,
                material_type=material.material_type,
                quantity_kg=round(remaining, 2),
                quality_grade=material.quality_grade,
                unit_price=material.unit_price,
                line_value=round(remaining * material.unit_price, 2),
            )))
            remaining = 0

    # Back to the original planning order: the cap decides *what* is sold, not how the
    # materials JSON reads.
    return [material for _, material in sorted(selected, key=lambda pair: pair[0])]


# ---------- Tool 10: rankRouteOptions ----------

def rank_route_options(comparison: dict, objective: str = "net_value") -> list[dict]:
    """
    Scores the feasible routes against an explicit objective, best first.

    Replaces the hand-written `if export["net"] > local["net"]` that used to live in
    decide_node: a router that cannot say *why* it chose, and that had no place to record
    the losing option's numbers. It also can't distinguish the routes by revenue at all —
    same batches, same approved prices — which is why "prioritise revenue" was never a
    real policy here; net value (the cost side) is.
    """
    chosen = objective if objective in ROUTE_OBJECTIVES else "net_value"
    total_kg = float(comparison.get("total_kg") or 0.0)

    options: list[dict] = []
    for key, route in (("local", "LocalSale"), ("export", "Export")):
        side = comparison.get(key) or {}
        if not side.get("feasible"):
            continue
        net = float(side.get("net") or 0.0)
        costs = float(side.get("costs") or 0.0)
        net_per_kg = round(net / total_kg, 2) if total_kg else 0.0
        options.append({
            "route": route,
            "key": key,
            "score": net_per_kg if chosen == "margin_per_kg" else net,
            "expected_revenue": float(comparison.get("total_revenue") or 0.0),
            "estimated_costs": costs,
            "estimated_net_value": net,
            "net_per_kg": net_per_kg,
            "reason": (
                f"{route} nets Rs. {net:,.2f} "
                f"(Rs. {net_per_kg:,.2f}/kg after Rs. {costs:,.2f} of costs) — "
                f"best score under the '{chosen}' objective."
            ),
        })

    options.sort(key=lambda option: (-option["score"], -option["estimated_net_value"],
                                     option["route"]))
    return options


# ---------- Tool 11: selectBuyerForRoute ----------

def select_buyer_for_route(
    buyers: list[EligibleBuyer], route: str, eligible_ids: list[str]
) -> str | None:
    """
    Deterministic buyer pick: one whose registered buyer type matches the route, then
    alphabetical company name, then id.

    Replaces `eligible_ids[0]`, which was whatever order the database happened to return
    — it could hand an export plan to a local buyer for no stated reason.
    """
    if not eligible_ids:
        return None

    wanted = "Export" if route == "Export" else "Local"
    matching = sorted(
        (b for b in buyers if str(b.buyer_id) in eligible_ids and b.buyer_type == wanted),
        key=lambda b: (b.company_name.lower(), str(b.buyer_id)),
    )
    if matching:
        return str(matching[0].buyer_id)
    return eligible_ids[0]


# ---------- Tool 12: pricingAgeDays ----------

def pricing_age_days(prices: list[ApprovedPrice]) -> float | None:
    """
    Age in days of the oldest approved price this plan is priced against — the weakest
    link in the chain, not the newest. Flags stale pricing instead of silently
    presenting month-old rates as today's value. None when nothing is priced.
    """
    dates: list[date] = []
    for price in prices:
        raw = (price.effective_date or "").strip()[:10]
        try:
            dates.append(date.fromisoformat(raw))
        except ValueError:
            continue
    if not dates:
        return None
    return float((date.today() - min(dates)).days)
