# agentic-ai - the four agents, one workflow

Assessed workflow: **Intelligent Waste Intake, Valuation & Collection Planning**.
ASP.NET Core calls `main.py`; React and Flutter never reach this service.

```
agentic-ai/
  main.py          FastAPI entry (POST /workflows, GET /workflows/{id}, POST /workflows/{id}/revise, GET /health)
  shared/          config, contracts, policies, tool catalogue + gateway, LLM interface, reporter, state
  Analyzer/        Component A agent   analyzer_agent.py, image_fetcher.py
  Matcher/         Component B agent   matcher_agent.py
  Validator/       Component C agent   validator_agent.py, validator_rules.py
  Planner/         Component D agent   planner_agent.py, plan_rules.py, handling.py
  graph/           workflow.py: the LangGraph graph, dispatcher, revision entry, safe runner
  tests/           246 tests
```

## How a run works

```
START -> planner_plan -> dispatch -> analyzer -> dispatch -> validator -> dispatch -> matcher -> dispatch -> planner_finalize -> END
                            `-> safe_failure -> END   (validator rejected / plan invalid / nothing to analyse)
```
1. **Planner** builds a 4-step plan (validated DAG: each action may only be run by its owning agent, validation must
   precede matching, the proposal comes last). The **dispatcher** then executes that plan, delegating each step.
2. **Analyzer** reads all items and images (SSRF-safe) and returns a typed assessment, or fails with a recorded reason.
3. **Validator** applies deterministic rules. Result: `ApprovedForAutoAssignment` / `RequiresHumanApproval` / `Rejected`.
4. **Matcher** ranks collectors and proposes a pickup window (skipped if the Validator rejected).
5. **Planner** picks the handling path, values the load (LKR), and produces the proposal.
   Outcome is `ReadyForAutoAssignment`, `PendingApproval` (human decides in React) or `SafeFailure`.

The graph never waits in memory: "pause for approval" is just the outcome `PendingApproval`. Approve / reject / revise
arrive later as separate requests through ASP.NET Core (`revise` re-enters this service).

## Agent cards (for the report and viva)

| | Analyzer (A) | Validator (C) | Matcher (B) | Planner (D) |
|---|---|---|---|---|
| Responsibility | Assess the waste | Decide proceed / human / reject | Propose collector + pickup window | Plan, delegate, value, propose |
| Input | items, image URLs, CSV rows | Analyzer output + submission facts | address/coords, kg, window | objective; all prior results |
| Output | `AnalyzerOutput` or a recorded failure | `ValidatorDecision` (+ every check) | `MatcherOutput` (ranked, ETA, window) | `Plan`, `Proposal`, safe-failure record |
| Tools (allow-list) | `get_approved_pricing`, `fetch_image`, LLM | none at intake (pure rules); `validate_classification` only for the facility-side check | `geocode_address`, `find_collectors` | `get_eligible_buyers`, LLM |
| LLM use | vision + text classification | none, by design | optional tie-break among near-equals | plan flags + summary text only |
| Cannot | approve, match, write | classify, price, plan | create jobs | analyse images, choose collectors |
| On failure | no output, workflow ends safely | tool failure -> human review, never approve | typed status, never raises | unverifiable data -> approval required |

**"LLM proposes, code disposes."** Every model output is validated against a schema, bounded to an enumerated set or a
length cap, and can only *escalate* (more review), never relax a check. All numbers, feasibility and approval decisions are
deterministic.

## Run

```bash
cd agentic-ai
python -m venv .venv && source .venv/bin/activate         # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                       # set AGENT_API_KEY (and GEMINI_API_KEY)
python -m pytest -q                                        # no backend, no API key needed
uvicorn main:app --port 8000
```
Startup order: PostgreSQL -> ASP.NET Core (:5172) -> `uvicorn main:app` (:8000).

## Tidy-up in the repo

Delete `Sales/` (superseded by `Planner/`: it planned recovered-material sales, not the intake workflow), the old
`agents/validator_agent.py`, and the old root `main.py` (replaced). Then follow **BACKEND_CONTRACT.md**.

## Assumptions to confirm (all in `shared/policies.py`, versioned)

Currency LKR everywhere. Auto-approval limits: Rs. 50,000 and 100 kg; hazard High+ always needs a human. Service area = Sri
Lanka bounding box. Local cost 5%, export cost 12%, export minimum 20 kg (carried over from Sales). Scoring weights for
collectors (distance .5, load .2, rating .2, capacity fit .1). All are placeholders for your team to agree.

## Known limits

* Verified with an in-process fake backend, one real local HTTP server, and a real `uvicorn` smoke run (safe-failure path).
  **Not yet run against your ASP.NET + PostgreSQL, and never against the live Gemini API** (no key or network here).
  Tests use a fake model. Do one live run before the demo.
* The default model is `models/gemini-3.1-flash-lite-preview` (a preview model; override with `GEMINI_MODEL`).
* State is reported to ASP.NET Core (the source of truth). This service keeps only a small in-memory index (200 runs).
* Versions: langgraph 0.2.34 as requested; FastAPI tested on 0.115.0 and 0.141.1 (older FastAPI on new pydantic prints a
  harmless pydantic warning at startup).
