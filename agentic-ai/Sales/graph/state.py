from typing import TypedDict

from schemas import MaterialBatch, ApprovedPrice, EligibleBuyer, MaterialToPlan


class WorkflowState(TypedDict, total=False):
    # --- Input ---
    workflow_id: str

    # --- Optional goal filters ---
    target_buyer_id: str | None
    target_material_types: list[str] | None
    max_quantity_kg: float | None
    preferred_route: str | None

    # --- Retrieval ---
    materials: list[MaterialBatch]
    prices: list[ApprovedPrice]
    buyers: list[EligibleBuyer]

    # --- Analysis ---
    planned_materials: list[MaterialToPlan]
    comparison: dict

    # --- Decision ---
    recommended_route: str
    selected_buyer_id: str | None
    destination_country: str | None
    expected_revenue: float
    estimated_costs: float
    estimated_net_value: float
    reasoning_summary: str
    approval_required: bool
    risk_flags: list[str]

    # --- Submission ---
    commercial_plan_id: str | None
    errors: list[str]