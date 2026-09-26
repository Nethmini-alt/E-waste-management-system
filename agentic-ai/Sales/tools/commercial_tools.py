import json
from uuid import UUID, uuid4

import httpx

from config import settings
from schemas import MaterialBatch, ApprovedPrice, EligibleBuyer, MaterialToPlan


# ---------- HTTP client with API key ----------

def _headers() -> dict:
    return {"X-Agent-Key": settings.agent_api_key}


async def _get(path: str):
    async with httpx.AsyncClient(base_url=settings.api_base_url, timeout=30.0) as client:
        r = await client.get(path, headers=_headers())
        r.raise_for_status()
        return r.json()


async def _post(path: str, payload: dict):
    async with httpx.AsyncClient(base_url=settings.api_base_url, timeout=30.0) as client:
        r = await client.post(path, json=payload, headers=_headers())
        r.raise_for_status()
        return r.json()


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
    local_costs = round(total_revenue * 0.05, 2)
    export_costs = round(total_revenue * 0.12, 2)

    local_net = round(total_revenue - local_costs, 2)
    export_net = round(total_revenue - export_costs, 2)

    # Export minimum weight rule (mirrors ExportOrderService)
    export_min_kg = 20.0
    export_feasible = total_kg >= export_min_kg and len(export_buyers) > 0

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