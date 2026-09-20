import json
from uuid import uuid4

from graph.state import WorkflowState
from tools import commercial_tools as tools


# ---------- Node 1: retrieve ----------

async def retrieve_node(state: WorkflowState) -> WorkflowState:
    materials = await tools.get_available_recovered_materials()
    prices = await tools.get_current_material_pricing()
    buyers = await tools.get_eligible_buyers()

    return {
        **state,
        "materials": materials,
        "prices": prices,
        "buyers": buyers,
    }


# ---------- Node 2: analyze ----------

async def analyze_node(state: WorkflowState) -> WorkflowState:
    planned = tools.calculate_commercial_value(state["materials"], state["prices"])
    comparison = tools.compare_commercial_options(planned, state["buyers"])

    return {
        **state,
        "planned_materials": planned,
        "comparison": comparison,
    }


# ---------- Node 3: decide ----------

async def decide_node(state: WorkflowState) -> WorkflowState:
    """
    Rule-based decision that mirrors what an LLM would do but stays
    deterministic and testable. Can be swapped with an LLM later.
    """
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
            "reasoning_summary": "No materials with approved pricing are available to plan for.",
            "approval_required": True,
            "risk_flags": ["no_sellable_materials"],
        }

    local = comparison["local"]
    export = comparison["export"]

    risk_flags: list[str] = []

    # Prefer export if feasible AND higher net value
    if export["feasible"] and export["net"] > local["net"]:
        recommended_route = "Export"
        chosen = export
    else:
        recommended_route = "LocalSale"
        chosen = local

    # Pick a buyer for the chosen route
    selected_buyer_id = None
    destination = None
    eligible_ids = chosen["eligible_buyers"]

    if eligible_ids:
        # For export, also derive a destination hint from the first export buyer
        selected_buyer_id = eligible_ids[0]

        if recommended_route == "Export":
            # In the real system this would come from the buyer record.
            # For now we set a sensible default the admin can override.
            destination = "India"

    # Risk flags
    if recommended_route == "Export" and comparison["total_kg"] < 50:
        risk_flags.append("low_export_volume")
    if chosen["net"] / comparison["total_revenue"] < 0.10:
        risk_flags.append("thin_margin")
    if len(eligible_ids) == 1:
        risk_flags.append("single_buyer_option")

    reasoning = (
        f"Evaluated {len(planned)} sellable material batches "
        f"totaling {comparison['total_kg']} kg with an expected revenue of "
        f"Rs. {comparison['total_revenue']:,.2f}. "
        f"Local route yields net Rs. {local['net']:,.2f} after "
        f"Rs. {local['costs']:,.2f} costs; export route yields net "
        f"Rs. {export['net']:,.2f} after Rs. {export['costs']:,.2f} costs. "
        f"Recommended: {recommended_route} because it maximizes net value "
        f"while satisfying route feasibility constraints."
    )

    return {
        **state,
        "recommended_route": recommended_route,
        "selected_buyer_id": selected_buyer_id,
        "destination_country": destination,
        "expected_revenue": comparison["total_revenue"],
        "estimated_costs": chosen["costs"],
        "estimated_net_value": chosen["net"],
        "reasoning_summary": reasoning,
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

async def run_workflow(workflow_id: str | None = None) -> WorkflowState:
    """
    Simple linear workflow. LangGraph's value-add here is state passing
    between nodes and the ability to add conditionals later.
    """
    state: WorkflowState = {"workflow_id": workflow_id or str(uuid4())}

    state = await retrieve_node(state)
    state = await analyze_node(state)
    state = await decide_node(state)
    state = await submit_node(state)

    return state