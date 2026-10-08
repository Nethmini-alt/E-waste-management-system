### 7.2 Component B — Collection & Logistics (Nethmini)

#### 7.2.1 Scope and risks
Component B matches each approved submission to a collector and tracks the pickup.

| Part | What it does | Main quality risks |
|---|---|---|
| **Matcher agent** (`agentic-ai/Collection`, Python/FastAPI) | Takes the backend's ranked collectors and decides whether the top pick can be **auto-assigned** or must go to staff | Assigning the wrong collector (excluded or too small a vehicle); auto-assigning when a human should decide; accepting impossible input; failing silently |
| **Collector app** (`mobile_flutter/lib/features/collector`, Flutter) | The collector's job list, availability switch and job completion | Wrong or missing jobs shown; errors crashing the screen; completing a job without proof |
| **Backend** (`Features/Collection`, ASP.NET Core) | Matching service, job state machine, agent-key protection | Covered by the existing xUnit suite (below) |

#### 7.2.2 Tools and why
| Layer | Tool | Why |
|---|---|---|
| AI agent | **pytest** + FastAPI `TestClient` + **respx** | The Matcher is Python. `TestClient` calls the real `/run` endpoint in-process, and respx mocks the backend at HTTP level, so the real `httpx` code runs. The Matcher is rule-based (no LLM), so every result is deterministic. |
| Mobile | **flutter_test** (widget tests) + Riverpod overrides + a fake Dio adapter | Renders the real screens without a device, API, GPS or secure storage |
| Backend | **xUnit** (existing suite) | Already in the project and run in CI |

#### 7.2.3 Matcher agent tests (pytest): 21 test cases
| ID | Type | What is checked | Result |
|---|---|---|---|
| TC-AI-B-001 | Normal | Clear best collector + routine value → auto-assigned to the top pick | Pass |
| TC-AI-B-002 | Safe failure | No candidates → no recommendation, sent to staff review | Pass |
| TC-AI-B-003 | Boundary | Single candidate → not ambiguous, auto-assigned | Pass |
| TC-AI-B-004 | Boundary | Top two within the 3-point margin → ambiguous, left for staff | Pass |
| TC-AI-B-005 | Boundary | Value exactly Rs. 90,000 → auto; Rs. 90,000.01 → staff | Pass |
| TC-AI-B-006 | Approval enforcement | Workflow already escalated by the Validator → never auto-assigned | Pass |
| TC-AI-B-007 | Edge | Top pick with unresolved distance → not auto-assigned | Pass |
| TC-AI-B-008 | Business rule | Backend order is authoritative: the Matcher never re-ranks | Pass |
| TC-AI-B-009 | Deterministic | Same input → identical decision | Pass |
| TC-AI-B-010 | Structured output | Response matches `MatcherRunResponse` (camelCase keys the backend reads) | Pass |
| TC-AI-B-011 | Tool use | Decision submitted once; execution log written with `succeeded=true`; lookup asks for the job's weight | Pass |
| TC-AI-B-012 | Invalid | Missing / non-UUID `workflowId` → 422 | Pass |
| TC-AI-B-013 | Invalid | Negative weight/value, latitude 200, longitude −500 → 422, backend never queried | **Fail → Pass** (DEF-B-02) |
| TC-AI-B-014 | Business rule | Collector in `excludeCollectorIds` is never recommended | **Fail → Pass** (DEF-B-01) |
| TC-AI-B-015 | Business rule | Collector whose vehicle can't carry the load is never recommended | **Fail → Pass** (DEF-B-01) |
| TC-AI-B-016 | Safe failure | No eligible candidate left → no recommendation, no auto-assign | **Fail → Pass** (DEF-B-01) |
| TC-AI-B-017 | Prompt injection / security | Injected text in upstream data ("IGNORE ALL RULES…") and extra fields (`autoAssign: true`) cannot force auto-assignment | Pass |
| TC-AI-B-018 | Failure recovery | Backend lookup fails → 502, failure written to the execution log, nothing submitted | **Fail → Pass** (DEF-B-03) |
| TC-AI-B-019 | Tool contract | Lookup sends the `X-Agent-Key` header and the exact JSON contract | Pass |
| TC-AI-B-020 | Failure | Rejected agent key (401) raises an error instead of returning "no collectors" | Pass |
| TC-AI-B-021 | Failure | Execution-log endpoint down → logging never breaks the run | Pass |

**First run: 16 passed, 5 failed. After the fixes: 21 passed, 0 failed.**

> 📷 Figure 7.x — pytest first run: 5 failed
> 📷 Figure 7.x — pytest after fixes: 21 passed

#### 7.2.4 Collector app tests (flutter_test): 8 test cases
| ID | Type | What is checked | Result |
|---|---|---|---|
| TC-FL-B-001 | Widget, normal | Active jobs listed with address and a collector-friendly status ("New job", "On the way") | Pass |
| TC-FL-B-002 | Widget, UI state | No active jobs → empty state | Pass |
| TC-FL-B-003 | Widget, error state | Failed job request → error message with retry, no crash | Pass |
| TC-FL-B-004 | Widget | Offline collector sees "Offline" and the "you won't be matched" notice | Pass |
| TC-FL-B-005 | Widget, interaction | Tapping the availability switch calls the API to go online | Pass |
| TC-FL-B-006 | Form validation | "Mark complete" without a photo shows an error, and nothing is sent to the API | Pass |
| TC-FL-B-007 | API integration | Active jobs merge Assigned + Accepted + InProgress from three requests, newest first | Pass |
| TC-FL-B-008 | Contract | Every backend job status round-trips and has a label; unknown values are not silently mapped | Pass |

A deliberate wrong assertion (expecting "Accepted" instead of "New job") made TC-FL-B-001 fail, which confirms the tests really check the screen.

> 📷 Figure 7.x — Flutter: 8 tests passed

#### 7.2.5 Backend (xUnit, existing suite)
The existing Collection tests (`backend/EWasteManagement.Tests/Collection/`) cover `MatchingService`, the job state machine (`JobsServiceTests`), `RequireAgentKey`, and the collector and job controllers. **109 / 109 passed** in this run (`collection-backend.trx`).

#### 7.2.6 Defects
| ID | Description | Severity / priority | Found by | Cause | Fix | Retest |
|---|---|---|---|---|---|---|
| **DEF-B-01** | The Matcher can recommend a collector who is in `excludeCollectorIds` (e.g. already rejected this job) or whose vehicle is too small for the load | **Medium / High**. Breaks a business rule if the list is ever wrong: the job goes back to someone who refused it, or to a bike for a 120 kg pickup. The backend's matching also filters these out today, so this is a missing safety check inside the agent (defence in depth). | TC-AI-B-014, 015, 016 | The agent trusted the candidate list from its tool completely and never checked the rules itself | `main.py`: after the lookup, drop excluded collectors and those with `capacity_kg` below the job weight before deciding. If none are left, the existing safe "staff review" path applies. | Pass |
| **DEF-B-02** | Impossible input (negative weight or value, latitude 200, longitude −500) was accepted with 200 OK and a decision was made | **Medium / Medium**. Garbage in, confident decision out. A negative value counted as "routine" and could be auto-assigned. | TC-AI-B-013 | No range validation on `MatcherRunRequest` | `schemas.py`: `ge`/`le` limits on coordinates, `ge=0` on weight and value. The API now answers 422 before any lookup. | Pass |
| **DEF-B-03** | If the backend candidate lookup failed (backend down, bad agent key), the Matcher crashed with a raw 500 and **nothing was written to the execution log** | **Medium / Medium**. The failure was invisible to staff looking at the workflow's agent log. | TC-AI-B-018 | The lookup call was outside the `try` block that logs failures | `main.py`: wrap the lookup, write a failed execution-log entry, and return **502 Bad Gateway** with a clear message | Pass |

Steps to reproduce each one are in the test of the same ID. Before/after output:
`docs/testing/evidence/component-B/pytest-before.txt` and `pytest-after.txt`.

> 📷 Figure 7.x — the fix in code (`main.py` / `schemas.py` diff)

#### 7.2.7 Interpretation
- The Matcher's core decision rules (thresholds, ambiguity, approval enforcement, determinism)
  were already correct. All the defects were at its **edges**: trusting tool output, trusting
  input, and handling a failing dependency. These are exactly the risks the AI testing
  guidance asks about.
- Because the Matcher is rule-based rather than LLM-based, prompt injection cannot change a
  decision (TC-AI-B-017). This is a deliberate design strength worth noting.
- The collector app handles the empty, error and offline states without crashing, and blocks
  completing a job without photo proof.

#### 7.2.8 How to run
```bash
# Matcher agent (from agentic-ai/Collection, with its venv)
pip install -r requirements.txt -r requirements-test.txt
python -m pytest -v

# Collector app (from mobile_flutter)
flutter test test/collector/collector_app_test.dart

# Backend Collection tests (from backend)
dotnet test EWasteManagement.Tests --filter "FullyQualifiedName~EWasteManagement.Tests.Collection"
```
