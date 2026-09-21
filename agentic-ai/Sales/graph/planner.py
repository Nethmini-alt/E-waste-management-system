import json
from uuid import uuid4

from graph.state import WorkflowState
from tools import commercial_tools as tools
from schemas import MaterialToPlan


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

    # Apply max quantity cap if requested
    max_kg = state.get("max_quantity_kg")
    if max_kg is not None and max_kg > 0:
        capped: list = []
        remaining = max_kg
        for m in planned:
            if remaining <= 0:
                break
            if m.quantity_kg <= remaining:
                capped.append(m)
                remaining -= m.quantity_kg
            else:
                capped.append(MaterialToPlan(
                    recovered_material_id=m.recovered_material_id,
                    material_type=m.material_type,
                    quantity_kg=round(remaining, 2),
                    quality_grade=m.quality_grade,
                    unit_price=m.unit_price,
                    line_value=round(remaining * m.unit_price, 2),
                ))
                remaining = 0
        planned = capped

    comparison = tools.compare_commercial_options(planned, state["buyers"])

    return {
        **state,
        "planned_materials": planned,
        "comparison": comparison,
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

    local = comparison["local"]
    export = comparison["export"]

    # Route decision: honor preferred route if given AND feasible
    preferred = state.get("preferred_route")
    if preferred == "Export" and export["feasible"]:
        recommended_route = "Export"
        chosen = export
    elif preferred == "LocalSale" and local["feasible"]:
        recommended_route = "LocalSale"
        chosen = local
    elif export["feasible"] and export["net"] > local["net"]:
        recommended_route = "Export"
        chosen = export
    else:
        recommended_route = "LocalSale"
        chosen = local

    # Buyer selection — respect target (already filtered) else first eligible
    selected_buyer_id = None
    eligible_ids = chosen["eligible_buyers"]
    if eligible_ids:
        selected_buyer_id = eligible_ids[0]

    destination = "India" if recommended_route == "Export" else None

    risk_flags: list[str] = []
    if recommended_route == "Export" and comparison["total_kg"] < 50:
        risk_flags.append("low_export_volume")
    if comparison["total_revenue"] > 0 and (chosen["net"] / comparison["total_revenue"]) < 0.10:
        risk_flags.append("thin_margin")
    if len(eligible_ids) == 1:
        risk_flags.append("single_buyer_option")

    # Build the reasoning
    parts = [
        f"Evaluated {len(planned)} sellable material batches totaling "
        f"{comparison['total_kg']} kg with expected revenue of Rs. {comparison['total_revenue']:,.2f}."
    ]
    if state.get("target_material_types"):
        parts.append(f"Goal restricted to: {', '.join(state['target_material_types'])}.")
    if state.get("target_buyer_id"):
        parts.append("Goal restricted to a specific buyer.")
    if state.get("max_quantity_kg"):
        parts.append(f"Goal capped at {state['max_quantity_kg']} kg.")
    parts.append(
        f"Local route net Rs. {local['net']:,.2f}; export route net Rs. {export['net']:,.2f}."
    )
    parts.append(
        f"Recommended: {recommended_route} "
        f"({'preferred by caller' if preferred else 'auto-selected for maximum net value'})."
    )

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
    }


# ---------- Node 4: submit ----------

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
) -> WorkflowState:
    state: WorkflowState = {
        "workflow_id": workflow_id or str(uuid4()),
        "target_buyer_id": target_buyer_id,
        "target_material_types": target_material_types,
        "max_quantity_kg": max_quantity_kg,
        "preferred_route": preferred_route,
    }

    state = await retrieve_node(state)
    state = await analyze_node(state)
    state = await decide_node(state)
    state = await submit_node(state)
    return state