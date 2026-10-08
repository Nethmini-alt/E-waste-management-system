# Software Testing and Quality Evaluation of the SE3090 Integrated System
### E-Waste Management System — SE3110 Quality Management in Software Engineering

| | |
|---|---|
| Group | Group XX |
| Members | Dinuri (Component A) · Nethmini (Component B) · Manodya (Component C) · Upeksha (Component D) |
| Repository | https://github.com/Nethmini-alt/E-waste-management-system |
| Submission date | 8 October 2026 |

> **Draft status:** Sections marked ✅ are complete and backed by test runs. Sections marked ⏳ are
> placeholders for work still in progress (G2–G5 and individual component testing).

---

## Table of Contents

1. Introduction ✅
   1.1 Purpose of this report
   1.2 System under test
   1.3 Relationship to the SE3090 assignment
2. Test Plan ✅
   2.1 Scope
   2.2 Objectives
   2.3 Key features, workflows and quality risks
   2.4 Testing areas, types and tools
   2.5 Test environment
   2.6 Responsibilities
   2.7 Schedule
   2.8 Entry and exit criteria
3. Testing Strategy ✅
   3.1 Test levels
   3.2 Test design techniques
   3.3 Handling the AI agents in integration testing
4. Test Environment Setup (G0) ✅
5. Integrated / End-to-End Testing (G1) ✅
   5.1 The business workflow under test
   5.2 Implementation
   5.3 Test cases
   5.4 Results
   5.5 Interpretation
6. Non-Functional Testing ⏳
   6.1 Performance and load testing (G2)
   6.2 Security testing (G3)
   6.3 Additional non-functional testing and justification (G4)
7. Component-Level Testing (individual contributions) ⏳
   7.1 Component A — Generator & Submission
   7.2 Component B — Collection & Logistics
   7.3 Component C — Processing & Inventory
   7.4 Component D — Sales, Pricing & Export
8. CI/CD and Code Quality (G5) ⏳
9. Test Execution Summary (partial)
10. Defect Summary (partial)
11. Conclusion ⏳
12. Declaration of AI Usage (CLEAR framework) ⏳

Appendix A — Test Case Document (E2E section complete)
Appendix B — Defect / Bug Report (partial)
Appendix C — Tool-Generated Evidence Index (partial)
Appendix D — How to Re-run the Tests

---

## 1. Introduction ✅

### 1.1 Purpose of this report
This report documents how the group planned, built, executed and evaluated tests for the
E-Waste Management System developed for SE3090. It covers the test plan, the test strategy,
the tools used for each testing area, the executed test cases with their actual results,
the defects found with their fixes and retests, and the evidence produced by the tools.

### 1.2 System under test
| Layer | Technology | Purpose |
|---|---|---|
| Backend | ASP.NET Core 8 Web API, Entity Framework Core | Business logic, REST API, workflow orchestration |
| Database | PostgreSQL | Persistent storage, constraints, migrations |
| Web app | React + Vite (TypeScript) | Admin, management staff, households, corporate buyers |
| Mobile app | Flutter | Collectors and warehouse workers |
| Agentic AI | Python (LangGraph) agents: Planner, Analyzer, Validator, Matcher, Sales | Intake analysis, rule validation, collector matching, commercial planning |

The system is divided into four components, one per member:

| Component | Responsibility | Agent |
|---|---|---|
| A — Generator & Submission | Households and companies submit e-waste for pickup | Analyzer |
| B — Collection & Logistics | Collector matching, job assignment, pickup | Matcher |
| C — Processing & Inventory | Warehouse receiving, sorting, dismantling, classification, collector payments | Validator |
| D — Sales, Pricing & Export | Material pricing, buyers, sales and export orders, revenue | Planner / Sales |

### 1.3 Relationship to the SE3090 assignment
All tests in this report run against the same code base, database schema and applications
submitted for SE3090. No separate application was built for testing. The evidence in this
report can also be used for the testing section of the SE3090 documentation.

---

## 2. Test Plan ✅

### 2.1 Scope
**In scope**
- Backend business logic, validation, controllers, authentication and authorization
- Database integrity: constraints, relationships, migrations, transactions
- React web application: forms, protected routes, API integration, UI states
- Flutter mobile application: widgets, form validation, navigation, API integration
- The complete cross-component business workflow (submission → collection → processing → sale)
- Agentic AI behaviour: structured output, business-rule compliance, approval enforcement, safe failure
- Non-functional: performance/load, security, plus accessibility and reliability (justified in §6.3)

**Out of scope**
- The accuracy of third-party services (LLM providers, OpenStreetMap). The system's
  *handling* of their responses and failures is in scope.
- Production hosting and infrastructure.

### 2.2 Objectives
1. Show that the four components work together as one business workflow.
2. Show that business rules hold at the boundaries between components (no double receiving,
   no overselling, weight conservation, role restrictions).
3. Show that the system fails safely when an external AI agent is unavailable.
4. Measure performance under load and identify security weaknesses.
5. Find, fix and retest defects, with evidence produced by testing tools.

### 2.3 Key features, workflows and quality risks
| # | Risk | Impact | Where it is tested |
|---|---|---|---|
| R1 | Components work alone but fail when joined (wrong ids, wrong statuses, missing data) | Workflow breaks | §5 E2E (TC-E2E-001, 007) |
| R2 | An AI agent is down or slow and the workflow is left stuck or creates a bad job | Lost submissions | §5 TC-E2E-002 |
| R3 | Human-approval step is bypassed | Unsafe automatic decisions | §5 TC-E2E-003, 004, 006 |
| R4 | The same job is received twice, or the same stock sold twice | Wrong payments / revenue | §5 TC-E2E-005 |
| R5 | Inventory weight is created out of nothing during dismantling | Wrong stock values | §5 TC-E2E-001, 005 |
| R6 | A user reaches functions of another role | Security breach | §5 TC-E2E-006, §6.2 |
| R7 | Slow responses under load | Poor usability | §6.1 |
| R8 | Known web vulnerabilities (OWASP Top 10) | Security breach | §6.2 |

### 2.4 Testing areas, types and tools
| Area | Testing types | Tool / framework | Status |
|---|---|---|---|
| Integration / E2E | API workflow, cross-component, UI workflow, negative paths | **Playwright** (API + browser) | ✅ Done |
| Backend / API | Unit, service, validation, controller, auth | xUnit (+ EF Core) | ⏳ Per member |
| Database | Constraints, relationships, transactions, migrations | xUnit + PostgreSQL | ⏳ Per member |
| React web app | Component, form validation, protected routes, API integration | Vitest + React Testing Library + MSW | ⏳ Per member |
| Flutter app | Unit, widget, navigation, form validation | flutter_test, mocktail | ⏳ Per member |
| Agentic AI | Structured output, business rules, prompt injection, safe failure | pytest | ⏳ Per member |
| Performance | Smoke, load, stress | k6 | ⏳ G2 |
| Security | Authorization matrix, OWASP scan, secret and dependency scans | Playwright/xUnit, OWASP ZAP, gitleaks, npm audit | ⏳ G3 |
| Accessibility / Reliability | WCAG checks; agent-down recovery | axe-core, Lighthouse; Playwright | ⏳ G4 |
| CI/CD | Automated test runs and reports | GitHub Actions | ⏳ G5 |

### 2.5 Test environment
| Item | Version / setting |
|---|---|
| OS | Windows 11 (developer machines); Ubuntu (GitHub Actions) |
| .NET SDK | 8.0 |
| Node.js | 20+ (tested on 24) |
| PostgreSQL | 18 (local) |
| Playwright | 1.63, Chromium |
| Test API | Release build on `http://localhost:5180` with its own database `SmartEWasteDB_E2E` |
| Test web app | Vite dev server on `http://localhost:5174` pointed at the test API |
| AI agents and maps (E2E only) | Deterministic stub server (see §3.3) |

Full details of the E2E environment are in §4.

### 2.6 Responsibilities
| Member | Component (individual) | Group workstream |
|---|---|---|
| Dinuri | A — Generator & Submission | G3 Security testing |
| Nethmini | B — Collection & Logistics | G2 Performance testing |
| Manodya | C — Processing & Inventory | G0 Test environment + G1 Integrated E2E testing (lead) |
| Upeksha | D — Sales, Pricing & Export | G5 CI/CD, evidence and report assembly |

Each member also wrote the E2E step for their own component (§5.2).

### 2.7 Schedule
| Phase | Work | Status |
|---|---|---|
| 1 | Risk analysis, test plan, tool selection | ✅ Complete |
| 2 | G0 test environment and G1 E2E suite | ✅ Complete (8 Oct 2026) |
| 3 | G2 performance, G3 security, G4 accessibility/reliability | ⏳ In progress |
| 4 | Individual component tests (A–D) | ⏳ In progress |
| 5 | Defect fixing and retesting | ⏳ In progress |
| 6 | CI integration, evidence collection, report | ⏳ In progress |

### 2.8 Entry and exit criteria
**Entry:** the code builds; EF migrations apply to an empty database; the test environment
health check (G0 setup test) passes.
**Exit:** all planned test cases executed; every failure is either fixed and retested or
recorded as a known defect with justification; no open Critical/High defects in the main workflow.

---

## 3. Testing Strategy ✅

### 3.1 Test levels
| Level | What it proves | Example |
|---|---|---|
| Unit / service | A single rule is correct | Payment calculation, status transitions |
| Component (API, UI, mobile, agent) | One component works on its own | React form validation, Flutter widget |
| Integration / E2E | The components work together through the real API and database | TC-E2E-001 full workflow |
| Non-functional | Quality attributes under realistic conditions | k6 load test, ZAP scan |

### 3.2 Test design techniques
- **Normal (happy path):** the full workflow with valid data (TC-E2E-001, 007).
- **Alternative paths:** reviewer rejection, automatic approval (TC-E2E-003, 004).
- **Invalid input / business-rule violations:** receiving twice, skipping statuses, unknown
  materials, inactive buyers (TC-E2E-005).
- **Boundary values:** dismantled outputs heavier than the unit (12 kg vs 11.5 kg); ordering
  1.5 kg when exactly 1 kg is in stock (TC-E2E-005).
- **Failure / safe-failure:** the Analyzer agent returns HTTP 500 (TC-E2E-002).
- **Security / authorization:** each role calling another role's endpoints (TC-E2E-006).

### 3.3 Handling the AI agents in integration testing
The backend calls the AI agents itself over HTTP during the intake workflow
(Planner → Analyzer → Validator → Matcher → Planner finalize) and calls OpenStreetMap to
geocode addresses. Real LLM agents are slow and return different answers on each run, so an
E2E test that depends on them would fail randomly.

The E2E suite therefore replaces them with a **stub server** that implements the same HTTP
contract as the real agents (`/plan`, `/run`, `/finalize`) and the same response shapes as
Photon/OSRM. The stub:
- returns fixed, realistic results, so every run is repeatable;
- can be switched to simulate failures (Analyzer down) and different decisions (approval
  required / automatic);
- records every call, so the tests can check that the API called the agents **in the
  planned order with the correct data**.

Everything else is real: the ASP.NET Core API, the workflow orchestrator and background
queue, PostgreSQL, EF Core migrations and the React app. The quality of each real agent is
tested separately by its owner (§7). One demonstration run is also recorded with the real agents.

---

## 4. Test Environment Setup (G0) ✅

The E2E environment starts automatically with one command (`npm run e2e`) and is isolated
from each developer's normal setup.

| Part | Detail |
|---|---|
| API under test | Release build of `backend/EWasteManagement.API`, started on port 5180 by `e2e/scripts/start-api.mjs` |
| Database | `SmartEWasteDB_E2E`: dropped and recreated by EF Core migrations on every run, so every run starts from the same state |
| Configuration | Supplied through environment variables (database, agent URLs, map URLs). `appsettings.json` is not edited |
| Stub services | Planner (18002), Analyzer (18003), Validator (18004), Matcher (18005), Sales (18001), Photon/OSRM (18099), control API (18090) |
| Web app | Vite dev server on port 5174, configured with `VITE_API_BASE_URL` = test API |
| Accounts | Bootstrap admin (registered, then promoted in the test DB). Every test creates fresh Staff, Worker, Household, Collector and Buyer accounts |
| Reference data | Warehouse locations and rate policies come from migrations. The setup test creates an approved Copper price |

**Setup verification (G0 test).** A Playwright *setup project* runs before all E2E tests and
checks: API health endpoint returns 200; migrations applied; stubs reachable; admin account
works; warehouse locations and rate policies seeded; an approved, live Copper price exists
and Copper is accepted as a material type. If any check fails, no E2E test runs, so
environment problems are reported as environment problems.

> 📷 **Figure 4.1** — Terminal output of `npm run e2e` showing the setup test passing.

---

## 5. Integrated / End-to-End Testing (G1) ✅

### 5.1 The business workflow under test
```
A  Household submits e-waste  →  Planner → Analyzer → Validator  →  paused for human approval
B  Reviewer approves  →  Matcher recommends a collector  →  job created and assigned
   →  collector accepts, starts and completes the pickup (photo + measured weight)
C  Warehouse worker receives the delivery  →  inventory unit created, collector payment calculated
   →  Sorting  →  dismantled into 2.5 kg of Copper  →  material is ReadyForSale
D  Copper appears as sellable stock  →  staff create an order for an active buyer
   →  stock reserved  →  order Confirmed → Completed  →  revenue recorded
```

### 5.2 Implementation
| File | Purpose | Owner |
|---|---|---|
| `playwright.config.ts` | Projects (setup, api-e2e, ui-e2e), web servers, reporters, trace/video settings | Manodya |
| `e2e/stubs/agent-stubs.mjs` | Deterministic agent and map stubs | Manodya |
| `e2e/scripts/start-api.mjs` | Builds and starts the isolated test API, resets the test DB | Manodya |
| `e2e/support/*.ts` | HTTP client per role, account creation, stub control | Manodya |
| `e2e/steps/a-submission.ts` | Component A step: submit, wait for workflow, submission status | Dinuri |
| `e2e/steps/b-collection.ts` | Component B step: approve, job assignment, pickup | Nethmini |
| `e2e/steps/c-inventory.ts` | Component C step: receive delivery, sort, dismantle | Manodya |
| `e2e/steps/d-sales.ts` | Component D step: pricing, buyer, sales order, revenue | Upeksha |
| `e2e/specs/*.spec.ts` | The test cases, built from the steps above | Manodya |

Each test case is divided into `test.step` blocks named after the components (A, B, C, D),
so the HTML report shows exactly which component a failure belongs to.

### 5.3 Test cases
| ID | Title | Type |
|---|---|---|
| G0 | Environment and reference data ready | Environment |
| TC-E2E-001 | Submission → collection → processing → sale → revenue (API) | Normal |
| TC-E2E-002 | Analyzer agent down: workflow fails safely | Failure |
| TC-E2E-003 | Reviewer rejects the submission | Alternative |
| TC-E2E-004 | Validator approves automatically (no human step) | Alternative |
| TC-E2E-005 | Business rules across component boundaries (9 checks) | Invalid / boundary |
| TC-E2E-006 | Role restrictions along the workflow (401/403) | Security |
| TC-E2E-007 | Same workflow through the React web app (browser) | Normal (UI) |

Full steps, expected and actual results are in **Appendix A**.

### 5.4 Results
| Run date | Tests | Passed | Failed | Duration |
|---|---|---|---|---|
| 8 Oct 2026 (first run) | 8 | 7 | 1 (TC-E2E-007) | 1.7 min |
| 8 Oct 2026 (after fix, DEF-E2E-01) | 8 | **8** | **0** | 1.2 min |

> 📷 **Figure 5.1** — Terminal summary of the final run (`8 passed`).
> 📷 **Figure 5.2** — Playwright HTML report, TC-E2E-001 expanded to show the A, B, C and D steps.
> 📷 **Figure 5.3** — Screenshots recorded by TC-E2E-007: submission awaiting review, submission collected, Copper ready for sale, completed sales order.
> 📷 **Figure 5.4** — Playwright trace viewer for one step (requests and responses).

### 5.5 Interpretation
- **The four components integrate correctly.** A single submission produced a job, an
  inventory unit, a recovered material, a sales order and a revenue record. Each was linked
  to the previous one by id (recorded in the `workflow-trace.json` attachment).
- **The orchestrator calls the agents in the planned order**, exactly once each, and passes the
  geocoded pickup location and the Analyzer's weight estimate to the Matcher.
- **Human approval is enforced:** a workflow that needs approval waits in `PendingApproval`. It
  cannot be approved by Household, Worker or Collector accounts, and cannot be approved after
  rejection.
- **Safe failure:** when the Analyzer is down, the workflow ends in `Failed` with the error
  logged, the chain stops, no job is created and the customer sees *Failed*. Nothing is stuck.
- **Money and stock rules hold across components:** collector payment is calculated on
  receipt (LKR 482.50 for 11.5 kg). Dismantling conserves weight (11.5 kg → 2.5 kg Copper + 9 kg
  remaining). Ordering 2 kg reserves stock (2.5 → 0.5 kg available). Revenue equals the order
  total (2 kg × LKR 1,500 = LKR 3,000).
- The single failure on the first run was a defect in the test script, not in the system (DEF-E2E-01).

---

## 6. Non-Functional Testing ⏳
### 6.1 Performance and load testing (G2 — Nethmini) ⏳
### 6.2 Security testing (G3 — Dinuri) ⏳
Security observations already noted during G1, to be assessed in G3:
- OBS-SEC-01 — JWT signing key and agent API key are stored in `appsettings.json` in the repository.
- OBS-SEC-02 — CORS policy allows any origin (`AllowAnyOrigin`).
- OBS-SEC-03 — For unhandled errors (HTTP 500), `GlobalExceptionHandler` returns the raw exception message in `detail`.
### 6.3 Additional non-functional testing and justification (G4) ⏳

## 7. Component-Level Testing ⏳
### 7.1 Component A ⏳
### 7.2 Component B ⏳
### 7.3 Component C ⏳
### 7.4 Component D ⏳

## 8. CI/CD and Code Quality (G5) ⏳

---

## 9. Test Execution Summary (partial)
| Area | Executed | Passed | Failed | Defects found | Defects fixed |
|---|---|---|---|---|---|
| Integration / E2E (G0 + G1) | 8 | 8 | 0 | 1 | 1 |
| Performance (G2) | ⏳ | | | | |
| Security (G3) | ⏳ | | | | |
| Accessibility / Reliability (G4) | ⏳ | | | | |
| Component A–D | ⏳ | | | | |
| **Total so far** | **8** | **8** | **0** | **1** | **1** |

## 10. Defect Summary (partial)
| ID | Title | Severity | Priority | Status | Retest |
|---|---|---|---|---|---|
| DEF-E2E-01 | TC-E2E-007 sales-order check matched a hidden dropdown option instead of the table row | Low (test script) | Medium | Fixed | Passed |

Full details are in **Appendix B**.

## 11. Conclusion ⏳
## 12. Declaration of AI Usage (CLEAR framework) ⏳

---

## Appendix A — Test Case Document (Integration / E2E)

Executed 8 Oct 2026 on the environment in §4. Tool: Playwright 1.63.

| ID | Feature | Preconditions | Steps / input | Expected result | Actual result | Status |
|---|---|---|---|---|---|---|
| G0 | Test environment | PostgreSQL running; ports 5174, 5180, 18001–18099 free | Start environment; call `/healthz`; log in as admin; read lookups; ensure Copper price | API 200; admin role = Admin; warehouse locations > 0; rate policies include Laptop and GeneralCollection; Copper approved and accepted as material type | As expected | Pass |
| TC-E2E-001 | Full workflow (API) | G0 passed; fresh Staff, Worker, Household, Collector accounts; stub Validator = approval | 1) Household submits 1 laptop, 12 kg, Colombo 03. 2) Staff approve. 3) Collector accepts, starts, completes (11.8 kg). 4) Worker receives 11.5 kg as Laptop, sorts, dismantles 2.5 kg Copper. 5) Staff activate buyer, order 2 kg, confirm, complete | Workflow pauses at PendingApproval; job Assigned to the test collector; agent calls in order plan→analyze→validate→match→finalize; submission statuses AwaitingReview→CollectorAssigned→Collected; payment > 0; Copper ReadyForSale with parent = unit; available 2.5→0.5 kg after order; order total = 2 × price; revenue row = order total | All as expected. Payment LKR 482.50; unit 11.5→9 kg; order and revenue LKR 3,000 | Pass |
| TC-E2E-002 | Safe failure — Analyzer down | Stub Analyzer returns HTTP 500 | Household submits | Workflow → Failed; execution log has an error mentioning Analyzer; Validator and Matcher not called; no job; submission status Failed | Failed; log: "Analyzer agent failed with status 500."; no job; submission Failed | Pass |
| TC-E2E-003 | Reviewer rejects | Workflow in PendingApproval | Staff reject; then try to approve | Workflow Rejected; no job; Matcher not called; approve afterwards → 400; submission Rejected | As expected (approve after reject → 400) | Pass |
| TC-E2E-004 | Automatic approval | Stub Validator = auto | Household submits | approvalRequired = false; job created and Assigned without any human action; submission CollectorAssigned | As expected | Pass |
| TC-E2E-005 | Cross-component business rules | Job assigned to test collector | a) complete before accept; b) receive before collected; c) receive with a different collector; d) receive twice; e) Received → ReadyForSale; f) dismantle 12 kg from 11.5 kg unit; g) material "Unobtainium"; h) order 1.5 kg when 1 kg in stock; i) order for a Pending buyer | a) 409 b) 409 "Job not ready for receipt" c) 409 "Collector does not match the job" d) 409 "Job already received" e) 409 f) 400 g) 400 h) 400 and stock unchanged i) 400 | All as expected | Pass |
| TC-E2E-006 | Role restrictions | Workflow in PendingApproval | Approve with no token / as Household / Worker / Collector; Collector opens warehouse; Household opens inventory; Worker creates sales order; Staff creates price | 401; 403; 403; 403; 403; 403; 403; 403; workflow still PendingApproval | As expected | Pass |
| TC-E2E-007 | Full workflow (web UI) | G0 passed; React app on 5174 | Household signs in and submits through the form; steps B–D via API; household opens My submissions; staff open the material page and Sales orders page | "Submission recorded" then "Awaiting review"; My submissions shows Collected; material page shows Copper, ready for sale; the order row shows Completed, Copper (2 kg), Rs. 3000.00 | Run 1: failed at the sales-orders check (DEF-E2E-01). Run 2 after fix: as expected | Pass (retest) |

## Appendix B — Defect / Bug Report (partial)

**DEF-E2E-01 — UI test checked a hidden element on the Sales orders page**
| Field | Value |
|---|---|
| Found by | TC-E2E-007, first run, 8 Oct 2026 |
| Component | E2E test script (`e2e/specs/full-workflow.ui.spec.ts`); not a system defect |
| Severity / Priority | Low / Medium (blocked the UI evidence run) |
| Description | The check `getByText(/E2E Metals/).first()` matched the buyer name inside the hidden `<option>` of the "All buyers" filter instead of the visible order row, so `toBeVisible()` failed. It was also too loose: buyers from earlier runs also match "E2E Metals". |
| Steps to reproduce | Run `npm run e2e:ui` with the original locator |
| Evidence | Playwright error output and failure screenshot `test-failed-2.png` (the page correctly shows the order as Completed, Rs. 3000.00) |
| Fix | Locate this run's own order row by its id prefix, then assert status *Completed*, item *Copper (2 kg)* and total *Rs. 3000.00* |
| Status | Fixed |
| Retest | Passed, 8 Oct 2026 (full suite 8/8) |

## Appendix C — Tool-Generated Evidence Index (partial)
| Evidence | Location | Produced by |
|---|---|---|
| E2E HTML report | `frontend-react/project/e2e-report/index.html` | Playwright |
| E2E JUnit and JSON results | `frontend-react/project/e2e-results/junit.xml`, `results.json` | Playwright |
| E2E traces, videos, screenshots | `frontend-react/project/e2e-results/artifacts/` | Playwright |
| Workflow id trace | `workflow-trace.json` attached to TC-E2E-001 in the HTML report | Playwright |

## Appendix D — How to Re-run the Tests
```bash
cd frontend-react/project
npm install
npx playwright install chromium
npm run e2e            # setup + all E2E tests
npm run e2e:report     # open the HTML report
```
Requirements: Node 20+, .NET 8 SDK, PostgreSQL running locally. The database password is read
from `backend/EWasteManagement.API/appsettings.Development.json` or `E2E_DB_PASSWORD`. Full
instructions: `frontend-react/project/e2e/README.md`.
