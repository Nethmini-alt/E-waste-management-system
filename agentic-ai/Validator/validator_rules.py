"""Deterministic rule engine for the Validator agent's INTAKE gate.

Pure functions: no network, no LLM, no clock, no randomness -> same input, same decision, always.
That is the point: the component that approves high-impact actions must not itself be an LLM.

Design principles (each is unit-tested):
  1. ESCALATE-ONLY: upstream (Analyzer) signals can raise the bar, never lower it. The Analyzer's
     own `requiresHumanApproval=false` is ignored; every threshold is recomputed here.
  2. INDEPENDENT CROSS-CHECK: hazard keywords are checked against raw text, not just the
     Analyzer's hazard label, so a manipulated Analyzer cannot smuggle a hazardous load through.
  3. UNTRUSTED TEXT IS SCREENED: instruction-like content in user text or LLM labels forces
     human review.
  4. Unsupported -> REJECT (workflow ends safely). Risky -> HUMAN. Otherwise -> APPROVED.
"""
from __future__ import annotations

import re
from functools import lru_cache

from pydantic import ValidationError

from shared.contracts import (
    AnalyzerOutput, Decision, HazardLevel, IntakeValidationInput, RuleResult, Severity, ValidatorDecision,
)
from shared.policies import ValidationPolicy

_UNKNOWN_LABELS = {"uncategorized", "uncategorised", "unknown", "other", "n/a", "none", ""}


def _pass(code: str, message: str = "ok") -> RuleResult:
    return RuleResult(code=code, passed=True, message=message)


def _fail(code: str, outcome: str, severity: Severity, message: str) -> RuleResult:
    return RuleResult(code=code, passed=False, outcome=outcome, severity=severity, message=message)


@lru_cache(maxsize=32)
def _word_regex(terms: tuple[str, ...], plural: bool) -> re.Pattern[str]:
    alternatives = "|".join(re.escape(t) + ("s?" if plural else "") for t in terms)
    return re.compile(rf"\b(?:{alternatives})\b", re.IGNORECASE)


@lru_cache(maxsize=8)
def _injection_regex(patterns: tuple[str, ...]) -> re.Pattern[str]:
    return re.compile("|".join(f"(?:{p})" for p in patterns), re.IGNORECASE)


def run_intake_rules(inp: IntakeValidationInput, policy: ValidationPolicy) -> list[RuleResult]:
    checks: list[RuleResult] = []
    description = inp.description or ""

    # ---- 1. required data --------------------------------------------------------
    if description.strip() or inp.image_count > 0:
        checks.append(_pass("required_data"))
    else:
        checks.append(_fail("required_data", "reject", Severity.MEDIUM,
                            "Submission has neither a description nor any images."))

    # ---- 2. location -------------------------------------------------------------
    lat, lng = inp.pickup_latitude, inp.pickup_longitude
    if len((inp.pickup_address or "").strip()) >= policy.min_address_chars or (lat is not None and lng is not None):
        checks.append(_pass("pickup_location_present"))
    else:
        checks.append(_fail("pickup_location_present", "reject", Severity.MEDIUM,
                            "Pickup address is missing or too short and no coordinates were given."))

    if lat is None and lng is None:
        checks.append(_pass("coordinates_valid", "no coordinates supplied (address will be geocoded)"))
    elif lat is None or lng is None or not (-90 <= lat <= 90 and -180 <= lng <= 180):
        checks.append(_fail("coordinates_valid", "reject", Severity.MEDIUM,
                            "Pickup coordinates are incomplete or out of range."))
    else:
        checks.append(_pass("coordinates_valid"))
        (lat_lo, lat_hi), (lng_lo, lng_hi) = policy.service_area_lat, policy.service_area_lng
        if lat_lo <= lat <= lat_hi and lng_lo <= lng <= lng_hi:
            checks.append(_pass("within_service_area"))
        else:
            checks.append(_fail("within_service_area", "human", Severity.MEDIUM,
                                "Pickup location is outside the configured service area."))

    # ---- 3. untrusted-text screen (runs even if the Analyzer output is unusable) --
    analysis: AnalyzerOutput | None = None
    schema_check = _parse_analysis(inp.analysis)
    if isinstance(schema_check, RuleResult):
        checks.append(schema_check)
    else:
        analysis = schema_check
        checks.append(_pass("analyzer_schema_valid"))

    screened = [description]
    if analysis is not None:
        screened += analysis.waste_categories + [analysis.recommended_handling or ""]
    if _injection_regex(policy.injection_patterns).search("\n".join(screened)):
        checks.append(_fail("prompt_injection_screen", "human", Severity.HIGH,
                            "Text contains instruction-like content; a person must review this submission."))
    else:
        checks.append(_pass("prompt_injection_screen"))

    if analysis is None:
        return checks  # nothing further can be judged without a valid Analyzer output

    # ---- 4. is it genuine e-waste? -----------------------------------------------
    if analysis.is_ewaste is False:
        checks.append(_fail("is_ewaste_confirmed", "reject", Severity.HIGH,
                            "Analyzer determined the submission is not e-waste."))
    else:
        checks.append(_pass("is_ewaste_confirmed"))

    known = _word_regex(tuple(policy.known_ewaste_terms), plural=True)
    unrecognised = [c for c in analysis.waste_categories
                    if c.strip().lower() in _UNKNOWN_LABELS or not known.search(c)]
    if unrecognised:
        shown = ", ".join(repr(c[:40]) for c in unrecognised[:3])
        checks.append(_fail("category_recognised", "human", Severity.MEDIUM,
                            f"Category not recognised as e-waste: {shown}."))
    else:
        checks.append(_pass("category_recognised"))

    # ---- 5. hazard ---------------------------------------------------------------
    level = analysis.hazard_level
    if level.rank >= policy.hazard_approval_at_or_above.rank:
        sev = Severity.CRITICAL if level == HazardLevel.CRITICAL else Severity.HIGH
        checks.append(_fail("hazard_level", "human", sev,
                            f"Hazard level {level.value} is at or above the approval threshold "
                            f"({policy.hazard_approval_at_or_above.value})."))
    else:
        checks.append(_pass("hazard_level"))

    keyword_hits = sorted({m.group(0).lower() for m in
                           _word_regex(tuple(policy.hazard_keywords), plural=False)
                           .finditer(" ".join([description] + analysis.waste_categories))})
    if keyword_hits and level.rank < HazardLevel.MEDIUM.rank:
        checks.append(_fail("hazard_keywords_consistent", "human", Severity.HIGH,
                            f"Text mentions hazardous material ({', '.join(keyword_hits)}) but the "
                            f"Analyzer rated hazard {level.value}."))
    else:
        checks.append(_pass("hazard_keywords_consistent"))

    # ---- 6. commercial limits ----------------------------------------------------
    if analysis.estimated_value_lkr > policy.max_auto_value_lkr:
        checks.append(_fail("value_within_auto_limit", "human", Severity.MEDIUM,
                            f"Estimated value Rs. {analysis.estimated_value_lkr:,.0f} exceeds the auto-approval "
                            f"limit of Rs. {policy.max_auto_value_lkr:,.0f}."))
    else:
        checks.append(_pass("value_within_auto_limit"))

    if analysis.estimated_volume_kg > policy.max_auto_volume_kg:
        checks.append(_fail("volume_within_auto_limit", "human", Severity.MEDIUM,
                            f"Estimated volume {analysis.estimated_volume_kg:.1f} kg exceeds the auto-approval "
                            f"limit of {policy.max_auto_volume_kg:.1f} kg."))
    else:
        checks.append(_pass("volume_within_auto_limit"))

    # ---- 7. confidence (mirrors the .NET rule: only flagged when a score is present) -----
    if analysis.confidence_score is not None and analysis.confidence_score < policy.min_confidence:
        checks.append(_fail("confidence_sufficient", "human", Severity.MEDIUM,
                            f"Confidence {analysis.confidence_score:.2f} is below the "
                            f"{policy.min_confidence:.2f} auto-approval threshold."))
    else:
        checks.append(_pass("confidence_sufficient"))

    # ---- 8. escalate-only echo of the Analyzer's own flag -------------------------
    if analysis.analyzer_requested_approval:
        checks.append(_fail("analyzer_requested_review", "human", Severity.MEDIUM,
                            "The Analyzer itself requested human review."))
    else:
        checks.append(_pass("analyzer_requested_review", "not requested (and never trusted to waive review)"))

    return checks


def _parse_analysis(raw: dict | None) -> AnalyzerOutput | RuleResult:
    if not raw:
        return _fail("analyzer_schema_valid", "reject", Severity.HIGH, "No Analyzer output was provided.")
    try:
        return AnalyzerOutput.model_validate(raw)
    except ValidationError as exc:
        # Report field names + reasons only - never echo raw values back into logs/UI.
        problems = "; ".join(sorted({f"{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in exc.errors()}))[:300]
        return _fail("analyzer_schema_valid", "reject", Severity.HIGH,
                     f"Analyzer output failed schema validation ({problems}).")


def decide(checks: list[RuleResult], policy_version: str, mode: str = "intake",
           safe_failure: bool = False) -> ValidatorDecision:
    failed = sorted((c for c in checks if not c.passed), key=lambda c: -c.severity.rank)
    if any(c.outcome == "reject" for c in failed):
        decision = Decision.REJECTED
    elif failed:
        decision = Decision.REQUIRES_HUMAN
    else:
        decision = Decision.APPROVED
    return ValidatorDecision(
        decision=decision,
        severity=failed[0].severity if failed else Severity.LOW,
        reasons=[c.message for c in failed],
        checks=checks,
        policy_version=policy_version,
        mode=mode,  # type: ignore[arg-type]
        safe_failure=safe_failure,
    )
