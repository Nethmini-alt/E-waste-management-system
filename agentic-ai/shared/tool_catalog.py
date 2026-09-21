"""The complete catalogue of backend tools agents in this package may ever call.

Each tool = one HTTP endpoint on the ASP.NET Core API + a strict request model + a strict
response model. An agent only receives the subset of names it is allow-listed for
(see ToolGateway). Nothing outside this catalogue can be called.
"""
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class _Req(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class _Resp(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


# ---- geocode_address  (PROPOSED endpoint - see BACKEND_CHANGES.md) --------------------
class GeocodeRequest(_Req):
    address: str = Field(min_length=5, max_length=300)


class GeocodeResponse(_Resp):
    resolved: bool
    latitude: float | None = None
    longitude: float | None = None


# ---- find_collectors  (POST /api/v1/collectors/match - exists) ------------------------
class FindCollectorsRequest(_Req):
    pickup_latitude: float = Field(alias="pickupLatitude", ge=-90, le=90)
    pickup_longitude: float = Field(alias="pickupLongitude", ge=-180, le=180)
    required_capacity_kg: float | None = Field(default=None, alias="requiredCapacityKg", gt=0)
    radius_km: float | None = Field(default=None, alias="radiusKm", gt=0, le=500)
    max_results: int = Field(default=5, alias="maxResults", ge=1, le=10)
    exclude_collector_ids: list[UUID] | None = Field(default=None, alias="excludeCollectorIds")


class CollectorMatch(_Resp):
    collector_id: UUID = Field(alias="collectorId")
    vehicle_type: str = Field(alias="vehicleType")
    capacity_kg: float = Field(alias="capacityKg")
    rating: float
    active_job_count: int = Field(alias="activeJobCount")
    distance_km: float | None = Field(default=None, alias="distanceKm")
    eta_minutes: int | None = Field(default=None, alias="etaMinutes")


# ---- validate_classification  (POST /api/v1/inventory/{id}/validate-classification) ---
class ValidateClassificationRequest(_Req):
    # The backend enum has no string converter: it accepts ONLY 0..3 (Reusable, LocalRecyclable,
    # Hazardous, ExportOnly). Sending a name such as "Reusable" returns 400.
    proposed_category: int = Field(alias="proposedCategory", ge=0, le=3)
    proposed_sub_category: str | None = Field(default=None, alias="proposedSubCategory", max_length=100)
    confidence_score: float | None = Field(default=None, alias="confidenceScore", ge=0, le=1)


class ValidateClassificationResponse(_Resp):
    approved: bool
    requires_human_review: bool = Field(default=False, alias="requiresHumanReview")
    reasons: list[str] = Field(default_factory=list)


# ---- get_approved_pricing  (GET /api/agent/pricing/approved - exists; prices are LKR per kg) ----
class ApprovedPrice(_Resp):
    material_type: str = Field(alias="materialType", max_length=80)
    price_per_kg: float = Field(alias="pricePerKg", ge=0)


# ---- get_eligible_buyers  (GET /api/agent/buyers/eligible - exists) ------------------------
# The endpoint also returns contact names and e-mails. This model deliberately declares only the
# two fields the Planner needs, so personal contact data is dropped at parse time (minimisation).
class EligibleBuyer(_Resp):
    buyer_id: UUID = Field(alias="buyerId")
    buyer_type: str = Field(alias="buyerType", max_length=20)   # "Local" | "Export"


@dataclass(frozen=True)
class ToolSpec:
    name: str
    method: str
    path: str                                   # may contain {placeholders} from path_params
    request_model: type[BaseModel] | None
    response_type: Any                          # a model class, or list[model] for arrays
    path_params: tuple[str, ...] = ()           # each is validated as a UUID before use
    redact: tuple[str, ...] = ()                # request fields never written to the audit trail


TOOLS: dict[str, ToolSpec] = {
    "geocode_address": ToolSpec(
        "geocode_address", "POST", "/api/v1/collectors/geocode",
        GeocodeRequest, GeocodeResponse, redact=("address",),
    ),
    "find_collectors": ToolSpec(
        "find_collectors", "POST", "/api/v1/collectors/match",
        FindCollectorsRequest, list[CollectorMatch],
    ),
    "get_approved_pricing": ToolSpec(
        "get_approved_pricing", "GET", "/api/agent/pricing/approved", None, list[ApprovedPrice],
    ),
    "get_eligible_buyers": ToolSpec(
        "get_eligible_buyers", "GET", "/api/agent/buyers/eligible", None, list[EligibleBuyer],
    ),
    "validate_classification": ToolSpec(
        "validate_classification", "POST", "/api/v1/inventory/{item_id}/validate-classification",
        ValidateClassificationRequest, ValidateClassificationResponse, path_params=("item_id",),
    ),
}
