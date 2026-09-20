"""
Validator Agent — Component C's distinct Agentic AI contribution.

Responsibility: given a PROPOSED classification for an inventory item, apply deterministic
business-rule and safety checks before it's allowed to be persisted. Never classifies
anything itself, never touches the database — it only calls one allow-listed tool.

Input contract:  ValidateClassificationInput
Output contract: ValidatorDecision
Tool permission: HTTP POST {API_BASE_URL}/api/v1/inventory/{id}/validate-classification — nothing else.
"""

import os
import sys
import requests
from dataclasses import dataclass, field
from typing import Optional

API_BASE_URL = os.environ.get("EWASTE_API_BASE_URL", "http://localhost:5000")


@dataclass
class ValidateClassificationInput:
    inventory_item_id: str
    proposed_category: str
    proposed_sub_category: Optional[str] = None
    confidence_score: Optional[float] = None


@dataclass
class ValidatorDecision:
    approved: bool
    requires_human_review: bool = False
    reasons: list = field(default_factory=list)


def validate_classification(payload: ValidateClassificationInput) -> ValidatorDecision:
    url = f"{API_BASE_URL}/api/v1/inventory/{payload.inventory_item_id}/validate-classification"
    body = {
        "proposedCategory": payload.proposed_category,
        "proposedSubCategory": payload.proposed_sub_category,
        "confidenceScore": payload.confidence_score,
    }
    try:
        response = requests.post(url, json=body, timeout=5)
        response.raise_for_status()
    except requests.RequestException as exc:
        # Safe failure: never silently approve if the tool call itself fails.
        return ValidatorDecision(approved=False, requires_human_review=True,
                                  reasons=[f"Validation tool call failed: {exc}"])

    data = response.json()
    return ValidatorDecision(
        approved=data.get("approved", False),
        requires_human_review=data.get("requiresHumanReview", False),
        reasons=data.get("reasons", []),
    )


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python validator_agent.py <inventory_item_id> <proposed_category> [confidence]")
        sys.exit(1)

    demo = ValidateClassificationInput(
        inventory_item_id=sys.argv[1],
        proposed_category=sys.argv[2],
        confidence_score=float(sys.argv[3]) if len(sys.argv) > 3 else None,
    )
    print(validate_classification(demo))