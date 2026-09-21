"""Business-rule thresholds. Everything the agents decide with lives here, versioned, so a
decision can be traced to the exact policy that produced it and thresholds can be changed
without touching agent logic.

NOTE: numeric defaults below are PLACEHOLDERS chosen for the assignment demo. Agree the real
values with the team (the 'must-approve' limits in the project document) and bump `version`.
"""
from pydantic import BaseModel

from .contracts import HazardLevel


class ValidationPolicy(BaseModel):
    version: str = "intake-policy-2026-09-v1"

    # Hazard: at or above this level a human must approve.
    hazard_approval_at_or_above: HazardLevel = HazardLevel.HIGH
    max_auto_value_lkr: float = 50_000.0  # Rs.; above this -> human approval ("high value")
    max_auto_volume_kg: float = 100.0     # above this -> human approval ("large volume")
    # Mirrors ClassificationValidationService.LowConfidenceThreshold (0.7) in the .NET backend.
    min_confidence: float = 0.7
    min_address_chars: int = 5

    # Service area (default: Sri Lanka bounding box). Outside -> a human decides.
    service_area_lat: tuple[float, float] = (5.8, 9.95)
    service_area_lng: tuple[float, float] = (79.4, 82.0)

    # Mirrors ClassificationValidationService.HazardKeywords in the .NET backend (+ plural).
    hazard_keywords: tuple[str, ...] = ("battery", "batteries", "crt", "mercury", "lithium", "lead", "cfc")

    known_ewaste_terms: tuple[str, ...] = (
        "electronic", "electrical", "battery", "batteries", "it equipment", "appliance", "laptop",
        "computer", "desktop", "phone", "mobile", "smartphone", "tablet", "monitor", "television",
        "tv", "printer", "scanner", "router", "modem", "server", "cable", "charger", "circuit",
        "keyboard", "camera", "console", "speaker", "fridge", "refrigerator", "washing machine",
        "microwave", "air conditioner", "ups", "e-waste", "lighting", "lamp",
    )

    # Screens UNTRUSTED text (user description, LLM-produced labels) for instruction-like content.
    injection_patterns: tuple[str, ...] = (
        r"ignore\s+(?:all\s+|any\s+|the\s+|your\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|rules?|prompts?)",
        r"disregard\s+(?:all\s+|any\s+|the\s+|your\s+)?(?:previous|prior|above|earlier|instructions?|rules?)",
        r"(?:system|developer)\s+prompt",
        r"you\s+are\s+(?:now|no\s+longer)\b",
        r"\b(?:act|behave|respond)\s+as\b",
        r"requires?_?human_?approval",
        r"(?:do\s+not|don'?t)\s+(?:flag|escalate|require|ask\s+for)\b",
        r"auto[\s-]?approve|approve\s+(?:this|it|automatically)",
        r"</?\s*(?:system|assistant|instructions?)\s*>",
        r"```",
    )


class MatchingPolicy(BaseModel):
    version: str = "matching-policy-2026-09-v1"

    max_radius_km: float = 50.0
    candidate_pool: int = 5               # how many ranked candidates to ask the backend for
    max_active_jobs: int = 3              # mirrors MatchingService.MaxActiveJobsPerCollector

    # Composite score weights (sum to 1.0).
    w_distance: float = 0.5
    w_load: float = 0.2
    w_rating: float = 0.2
    w_capacity_fit: float = 0.1

    # Bounded LLM discretion: it may only choose among the top-K candidates whose deterministic
    # score is within `llm_score_tolerance` of the best one.
    llm_top_k: int = 3
    llm_score_tolerance: float = 0.15

    # Pickup-window proposal (local business hours).
    timezone: str = "Asia/Colombo"
    lead_time_minutes: int = 120
    window_hours: int = 3
    work_start_hour: int = 8
    work_end_hour: int = 18


class AnalyzerPolicy(BaseModel):
    version: str = "analyzer-policy-2026-09-v1"
    max_text_chars_per_item: int = 2000
    max_total_text_chars: int = 8000
    max_csv_rows_in_prompt: int = 200
    pricing_rows_in_prompt: int = 15


class PlannerPolicy(BaseModel):
    version: str = "planner-policy-2026-09-v1"
    # Cost model carried over from the Sales prototype (assumptions - confirm with Component D owner).
    local_cost_rate: float = 0.05
    export_cost_rate: float = 0.12
    export_min_kg: float = 20.0                 # mirrors ExportOrderService minimum
    local_max_hazard: HazardLevel = HazardLevel.MEDIUM   # local reuse/recycling is not offered above this hazard level
    summary_max_chars: int = 600
