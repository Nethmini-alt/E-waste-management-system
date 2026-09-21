"""Deterministic commercial logic for the Planner: which handling path is feasible, and what it is worth.

No LLM here: money and feasibility must be reproducible. Rules (all thresholds in PlannerPolicy):
  * local reuse / recycling only up to `local_max_hazard`, and only if a local buyer exists
  * export only if the load is at least `export_min_kg` and an export buyer exists
  * the Analyzer's recommendation is honoured when feasible, otherwise the cheapest feasible alternative
  * buyer counts unknown (tool failed) -> keep the recommendation but flag it as unverified
"""
from __future__ import annotations

from dataclasses import dataclass

from shared.contracts import AnalyzerOutput, HandlingPath
from shared.policies import PlannerPolicy

_FROM_ANALYZER = {"Local reuse": HandlingPath.LOCAL_REUSE, "Local recycle": HandlingPath.LOCAL_RECYCLE,
                  "Export": HandlingPath.EXPORT}
_CHEAPEST_FIRST = (HandlingPath.LOCAL_RECYCLE, HandlingPath.LOCAL_REUSE, HandlingPath.EXPORT)


@dataclass(frozen=True)
class BuyerCounts:
    local: int | None   # None = could not be verified
    export: int | None


@dataclass(frozen=True)
class HandlingDecision:
    path: HandlingPath
    verified: bool
    notes: list[str]


def feasibility(path: HandlingPath, a: AnalyzerOutput, buyers: BuyerCounts, policy: PlannerPolicy) -> bool | None:
    """True / False, or None when it depends on data we could not verify."""
    if path in (HandlingPath.LOCAL_REUSE, HandlingPath.LOCAL_RECYCLE):
        if a.hazard_level.rank > policy.local_max_hazard.rank:
            return False
        count = buyers.local
    elif path == HandlingPath.EXPORT:
        if a.estimated_volume_kg < policy.export_min_kg:
            return False
        count = buyers.export
    else:
        return False
    return None if count is None else count >= 1


def choose_handling(a: AnalyzerOutput, buyers: BuyerCounts, policy: PlannerPolicy) -> HandlingDecision:
    preferred = _FROM_ANALYZER[a.recommended_handling or "Local recycle"]
    notes: list[str] = []
    f = feasibility(preferred, a, buyers, policy)
    if f is True:
        return HandlingDecision(preferred, True, notes)
    if f is None:
        notes.append("Buyer availability could not be verified.")
        return HandlingDecision(preferred, False, notes)

    notes.append(f"Recommended path {preferred.value} is not feasible.")
    for alt in (p for p in _CHEAPEST_FIRST if p != preferred):
        fa = feasibility(alt, a, buyers, policy)
        if fa is True:
            notes.append(f"Switched to {alt.value}.")
            return HandlingDecision(alt, True, notes)
        if fa is None:
            notes.append(f"Switched to {alt.value}, but buyer availability could not be verified.")
            return HandlingDecision(alt, False, notes)
    notes.append("No feasible handling path exists.")
    return HandlingDecision(HandlingPath.MANUAL, True, notes)


def value_load(gross: float, path: HandlingPath, policy: PlannerPolicy) -> tuple[float, float]:
    """(estimated costs, net value) in LKR."""
    rate = policy.export_cost_rate if path == HandlingPath.EXPORT else policy.local_cost_rate
    costs = round(gross * rate, 2)
    return costs, round(gross - costs, 2)
