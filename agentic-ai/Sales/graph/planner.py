import json
from uuid import uuid4

from config import settings
from graph.llm import as_text, get_llm
from graph.state import WorkflowState
from tools import commercial_tools as tools


# ---------- Node 1: retrieve ----------

async def retrieve_node(state: WorkflowState) -> WorkflowState:
    materials = await tools.get_available_recovered_materials()
    prices = await tools.get_current_material_pricing()
    buyers = await tools.get_eligible_buyers()

    # Apply goal filters
    if state.get("target_material_types"):
        wanted = {m.lower() for m in state["target_material_types"]}
        materials = [m for m in materials if m.material_type.lower() in wanted]

    if state.get("target_buyer_id"):
        buyers = [b for b in buyers if str(b.buyer_id) == state["target_buyer_id"]]

    return {
        **state,
        "materials": materials,
        "prices": prices,
        "buyers": buyers,
    }


# ---------- Node 2: analyze ----------

async def analyze_node(state: WorkflowState) -> WorkflowState:
    planned = tools.calculate_commercial_value(state["materials"], state["prices"])

    # Cap the plan by value-per-kg, not by whatever order the backend listed batches in:
    # the cap decides WHAT is sold, and a small high-grade batch should not lose its
    # place to a bulk low-grade one. (Was an inline loop with the same bug.)
    planned = tools.select_materials_within_cap(planned, state.get("max_quantity_kg"))

    comparison = tools.compare_commercial_options(planned, state["buyers"])

    return {
        **state,
        "planned_materials": planned,
        "comparison": comparison,
        "pricing_age_days": tools.pricing_age_days(state["prices"]),
    }


# ---------- Node 3: decide ----------

async def decide_node(state: WorkflowState) -> WorkflowState:
    comparison = state["comparison"]
    planned = state["planned_materials"]

    if not planned:
        return {
            **state,
            "recommended_route": "LocalSale",
            "selected_buyer_id": None,
            "destination_country": None,
            "expected_revenue": 0,
            "estimated_costs": 0,
            "estimated_net_value": 0,
            "reasoning_summary": "No materials with approved pricing match the requested goal.",
            "approval_required": True,
            "risk_flags": ["no_sellable_materials"],
        }

    preferred = state.get("preferred_route")
    objective = state.get("priority_objective") or settings.default_priority_objective
    risk_flags: list[str] = []

    # Route choice is a tool call, not a hand-rolled comparison: rank_route_options knows
    # the cost model and scores both routes against the objective, and returns the reason
    # it used. A preferred route from the caller still wins when it is feasible.
    ranked_routes = tools.rank_route_options(comparison, objective)
    if not ranked_routes:
        # Neither route is feasible (no active buyer of either type, or export volume too low).
        return {
            **state,
            "recommended_route": "LocalSale",
            "selected_buyer_id": None,
            "destination_country": None,
            "expected_revenue": comparison["total_revenue"],
            "estimated_costs": 0,
            "estimated_net_value": 0,
            "reasoning_summary": (
                f"Rs. {comparison['total_revenue']:,.2f} of sellable material has no feasible "
                "route: no active buyer of either type can take it."
            ),
            "approval_required": True,
            "risk_flags": ["no_feasible_route"],
            "priority_objective": objective,
            "route_scores": [],
        }

    chosen_route = ranked_routes[0]
    if preferred:
        match = next((option for option in ranked_routes if option["route"] == preferred), None)
        if match is None:
            risk_flags.append("preferred_route_infeasible")
        else:
            chosen_route = match

    recommended_route = chosen_route["route"]
    chosen = comparison[chosen_route["key"]]

    # Buyer selection is a tool too: a deterministic, explainable pick instead of
    # "whatever the database listed first".
    eligible_ids: list[str] = chosen["eligible_buyers"]
    selected_buyer_id = tools.select_buyer_for_route(
        state.get("buyers", []), recommended_route, eligible_ids
    )
    buyer_name = next(
        (b.company_name for b in state.get("buyers", []) if str(b.buyer_id) == selected_buyer_id),
        None,
    )

    destination = "India" if recommended_route == "Export" else None

    if recommended_route == "Export" and comparison["total_kg"] < 50:
        risk_flags.append("low_export_volume")
    if comparison["total_revenue"] > 0 and (chosen["net"] / comparison["total_revenue"]) < 0.10:
        risk_flags.append("thin_margin")
    if len(eligible_ids) == 1:
        risk_flags.append("single_buyer_option")

    pricing_age = state.get("pricing_age_days")
    if pricing_age is not None and pricing_age > tools.PRICING_STALE_DAYS:
        risk_flags.append("stale_pricing")

    # Build the reasoning from what the tools actually returned.
    parts = [
        f"Evaluated {len(planned)} sellable material batches totaling "
        f"{comparison['total_kg']} kg with expected revenue of Rs. {comparison['total_revenue']:,.2f}."
    ]
    if state.get("target_material_types"):
        parts.append(f"Goal restricted to: {', '.join(state['target_material_types'])}.")
    if state.get("target_buyer_id"):
        parts.append("Goal restricted to a specific buyer.")
    if state.get("max_quantity_kg"):
        parts.append(
            f"Goal capped at {state['max_quantity_kg']} kg, filled with the highest "
            "value-per-kg batches first."
        )
    parts.append(
        f"Local route net Rs. {comparison['local']['net']:,.2f}; "
        f"export route net Rs. {comparison['export']['net']:,.2f}."
    )
    parts.append(
        f"Recommended: {recommended_route} "
        f"({'preferred by caller' if preferred else chosen_route['reason']})."
    )
    if selected_buyer_id:
        parts.append(f"Buyer: {buyer_name or selected_buyer_id}.")
    if pricing_age is not None:
        parts.append(f"Pricing behind this plan is {pricing_age:.0f} day(s) old.")

    return {
        **state,
        "recommended_route": recommended_route,
        "selected_buyer_id": selected_buyer_id,
        "destination_country": destination,
        "expected_revenue": comparison["total_revenue"],
        "estimated_costs": chosen["costs"],
        "estimated_net_value": chosen["net"],
        "reasoning_summary": " ".join(parts),
        "approval_required": True,
        "risk_flags": risk_flags,
        "priority_objective": objective,
        "route_scores": ranked_routes,
    }


# ---------- Node 4: narrate (optional) ----------

async def narrate_node(state: WorkflowState) -> WorkflowState:
    """
    Rewrites the deterministic summary for the approval screen — the same "model writes
    prose only" split Planner's finalize node uses. Skipped entirely when no model is
    configured, and on any failure the deterministic text stays as-is.
    """
    llm = get_llm()
    if llm is None:
        return state

    try:
        prose = await llm.ainvoke(
            "Rewrite this commercial plan summary in two clear sentences for a sales "
            "approver, keeping every number and every risk flag: "
            f"{state['reasoning_summary']}"
        )
        rewritten = as_text(getattr(prose, "content", "") or "")
    except Exception:
        return state  # keep the deterministic summary

    if not rewritten:
        return state

    return {**state, "reasoning_summary": rewritten}


# ---------- Node 5: submit ----------

async def submit_node(state: WorkflowState) -> WorkflowState:
    planned = state["planned_materials"]

    materials_json = json.dumps([
        {
            "materialType": m.material_type,
            "quantityKg": m.quantity_kg,
            "qualityGrade": m.quality_grade,
            "recoveredMaterialId": str(m.recovered_material_id),
            "unitPrice": m.unit_price,
            "lineValue": m.line_value,
        }
        for m in planned
    ])

    payload = {
        "workflowId": state["workflow_id"],
        "recommendedRoute": state["recommended_route"],
        "selectedBuyerId": state.get("selected_buyer_id"),
        "destinationCountry": state.get("destination_country"),
        "materialsJson": materials_json,
        "expectedRevenue": state["expected_revenue"],
        "estimatedCosts": state["estimated_costs"],
        "estimatedNetValue": state["estimated_net_value"],
        "reasoningSummary": state["reasoning_summary"],
        "approvalRequired": state.get("approval_required", True),
        "riskFlags": json.dumps(state.get("risk_flags", [])),
    }

    result = await tools.create_commercial_plan(payload)

    return {
        **state,
        "commercial_plan_id": result.get("commercialPlanId"),
    }


# ---------- Graph assembly ----------

async def run_workflow(
    workflow_id: str | None = None,
    target_buyer_id: str | None = None,
    target_material_types: list[str] | None = None,
    max_quantity_kg: float | None = None,
    preferred_route: str | None = None,
    priority_objective: str | None = None,
) -> WorkflowState:
    state: WorkflowState = {
        "workflow_id": workflow_id or str(uuid4()),
        "target_buyer_id": target_buyer_id,
        "target_material_types": target_material_types,
        "max_quantity_kg": max_quantity_kg,
        "preferred_route": preferred_route,
        "priority_objective": priority_objective or settings.default_priority_objective,
    }

    state = await retrieve_node(state)
    state = await analyze_node(state)
    state = await decide_node(state)
    state = await narrate_node(state)   # no-op without a configured model
    state = await submit_node(state)
    return state