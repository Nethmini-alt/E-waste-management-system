"""
TC-AI-B-001 .. 009 — the Matcher's decision logic (graph/nodes.py: decide_node).

Given the backend's ranked collectors, the Matcher decides:
  - which collector to recommend (always the backend's top pick),
  - whether that pick is safe to auto-assign, or should go to staff.
"""

from graph.nodes import AMBIGUOUS_SCORE_MARGIN, ROUTINE_VALUE_THRESHOLD_LKR, decide_node


def decide(ranked, value=20000.0, escalated=False):
    return decide_node({
        "workflow_id": "wf-1",
        "estimated_value_lkr": value,
        "already_escalated": escalated,
        "ranked": ranked,
    })


def test_TC_AI_B_001_clear_best_routine_job_is_auto_assigned(collector):
    best = collector(distance_km=1.5, rating=4.8)
    other = collector(distance_km=9.0, rating=3.5, active_jobs=2)

    out = decide([best, other])

    assert out["recommended_collector_id"] == str(best.collector_id)
    assert out["auto_assign"] is True
    assert out["ambiguous"] is False
    assert "Auto-assigning." in out["reasoning"]


def test_TC_AI_B_002_no_candidates_fails_safely_to_staff_review():
    out = decide([])

    assert out["recommended_collector_id"] is None
    assert out["auto_assign"] is False
    assert "staff review" in out["reasoning"]


def test_TC_AI_B_003_single_candidate_is_not_ambiguous(collector):
    only = collector()

    out = decide([only])

    assert out["ambiguous"] is False
    assert out["auto_assign"] is True
    assert out["recommended_collector_id"] == str(only.collector_id)


def test_TC_AI_B_004_near_tie_is_ambiguous_and_left_for_staff(collector):
    # Same rating and load, 1 km apart -> scores differ by 2 (< margin of 3).
    a = collector(distance_km=2.0, rating=4.5)
    b = collector(distance_km=3.0, rating=4.5)

    out = decide([a, b])

    assert out["ambiguous"] is True
    assert out["auto_assign"] is False
    assert out["recommended_collector_id"] == str(a.collector_id), "still suggests the top pick"
    assert f"within {AMBIGUOUS_SCORE_MARGIN} points" in out["reasoning"]


def test_TC_AI_B_005_value_threshold_boundary(collector):
    c = collector()

    at_limit = decide([c], value=ROUTINE_VALUE_THRESHOLD_LKR)
    just_over = decide([c], value=ROUTINE_VALUE_THRESHOLD_LKR + 0.01)

    assert at_limit["auto_assign"] is True, "Rs. 90,000 exactly is still routine"
    assert just_over["auto_assign"] is False
    assert "routine threshold" in just_over["reasoning"]


def test_TC_AI_B_006_escalated_workflow_is_never_auto_assigned(collector):
    # Approval enforcement: once the Validator asked for a human, the Matcher may only suggest.
    best = collector(distance_km=0.5, rating=5.0)

    out = decide([best], value=1000, escalated=True)

    assert out["auto_assign"] is False
    assert out["recommended_collector_id"] == str(best.collector_id)
    assert "suggestion only" in out["reasoning"]


def test_TC_AI_B_007_unresolved_distance_is_not_auto_assigned(collector):
    # Top pick has no driving distance (geocoding failed) -> not confident enough to auto-assign.
    unknown = collector(distance_km=None)
    known = collector(distance_km=2.0)

    out = decide([unknown, known])

    assert out["auto_assign"] is False
    assert "distance unresolved" in out["reasoning"]


def test_TC_AI_B_008_backend_order_is_authoritative(collector):
    # The Matcher must not re-rank: if the backend put a weaker-looking collector first,
    # it recommends that one, but flags the pick as ambiguous instead of auto-assigning.
    first = collector(distance_km=8.0, rating=3.0)
    second = collector(distance_km=1.0, rating=5.0)

    out = decide([first, second])

    assert out["recommended_collector_id"] == str(first.collector_id)
    assert out["auto_assign"] is False


def test_TC_AI_B_009_same_input_gives_same_decision(collector):
    ranked = [collector(distance_km=1.0), collector(distance_km=7.0)]

    assert decide(ranked) == decide(ranked)
