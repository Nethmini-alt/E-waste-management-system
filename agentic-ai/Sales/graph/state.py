from typing import TypedDict
from uuid import UUID

from schemas import MaterialBatch, ApprovedPrice, EligibleBuyer, MaterialToPlan


class WorkflowState(TypedDict, total=False):
    # --- Input ---
    workflow_id: str

    # --- Populated by retrieval step ---
    materials: list[MaterialBatch]
    prices: list[ApprovedPrice]
    buyers: list[EligibleBuyer]

    # --- Populated by analysis step ---
    planned_materials: list[MaterialToPlan]
    comparison: dict

    # --- Populated by decision step ---
    recommended_route: str             # "LocalSale" | "Export"
    selected_buyer_id: str | None
    destination_country: str | None
    expected_revenue: float
    estimated_costs: float
    estimated_net_value: float
    reasoning_summary: str
    approval_required: bool
    risk_flags: list[str]

    # --- Populated by submission step ---
    commercial_plan_id: str | None
    errors: list[str]