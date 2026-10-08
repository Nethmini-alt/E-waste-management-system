# End-to-end tests (G0 environment + G1 integrated workflow)

Playwright tests that run the **whole business workflow across all four components**
through the real ASP.NET Core API, the real PostgreSQL database, the real workflow
orchestrator and the React web app.

```
A  household submits  →  Planner → Analyzer → Validator  →  paused for approval
B  reviewer approves  →  Matcher  →  job assigned  →  collector accepts, starts, completes
C  worker receives the delivery  →  Sorting  →  dismantled into Copper (ReadyForSale)
D  staff sell the Copper to an active buyer  →  order Completed  →  revenue recorded
```

## Why the AI agents are stubbed here

The API calls the agents itself (`Infrastructure/ExternalServices/*AgentClient.cs`).
Real LLM agents are slow and give different answers each run, so they would make an
integration test flaky. `stubs/agent-stubs.mjs` answers on the **same HTTP contract**
with fixed results, and stands in for OpenStreetMap (Photon/OSRM) too, so the run needs
no internet. The stub can also simulate failures (agent down) and records every call,
so the tests check that the API called the agents **in the planned order**.

Agent *quality* is not tested here. Each member tests their own agent separately (pytest).
For the demo, one run can also be recorded with the real agents.

## G0 — test environment

| Part | What | Where |
|---|---|---|
| API under test | Release build of `backend/EWasteManagement.API` on **http://localhost:5180** | `scripts/start-api.mjs` |
| Database | **`SmartEWasteDB_E2E`**, dropped and re-created by EF migrations on every run | `scripts/start-api.mjs` |
| Stub agents | Planner 18002, Analyzer 18003, Validator 18004, Matcher 18005, Sales 18001 | `stubs/agent-stubs.mjs` |
| Stub maps | Photon + OSRM on 18099; control API on 18090 | `stubs/agent-stubs.mjs` |
| Web app | Vite dev server on **http://localhost:5174**, pointed at the test API | `playwright.config.ts` |
| Accounts | Bootstrap admin, plus fresh Staff / Worker / Household / Collector / Buyer per test | `support/accounts.ts` |
| Reference data | Warehouse locations + rate policies (migrations), approved Copper price (setup) | `setup/environment.setup.ts` |

Your dev API (5172), your dev database and the real agents (8001–8005) are not touched,
so they can keep running alongside the tests.

The DB password is read from `backend/EWasteManagement.API/appsettings.Development.json`
(your own local file). Set `E2E_DB_PASSWORD` to override it. Every other setting is in
`env.ts` and can be overridden with an environment variable.

## Run

Needs: Node 20+, .NET 8 SDK, PostgreSQL running locally.

```bash
cd frontend-react/project
npm install
npx playwright install chromium      # once, for the UI test

npm run e2e          # everything (setup + API E2E + UI E2E)
npm run e2e:api      # API-level workflow tests only (fast)
npm run e2e:ui       # browser test only
npm run e2e:report   # open the HTML report
```

Playwright starts the stubs, the test API and the web app by itself. The first run
builds the API, which takes about a minute.

## Test cases

| ID | File | What it proves | Type |
|---|---|---|---|
| G0 | `setup/environment.setup.ts` | API healthy, migrations applied, stubs up, admin + reference data ready | Environment |
| TC-E2E-001 | `specs/full-workflow.api.spec.ts` | The full A→B→C→D workflow. Agents called once each, in order. Weight conserved. Stock reserved. Revenue = order total | Normal |
| TC-E2E-002 | `specs/workflow-rules.api.spec.ts` | Analyzer down → workflow `Failed`, error logged, chain stops, no job, customer sees *Failed* | Failure / safe-failure |
| TC-E2E-003 | 〃 | Reviewer rejects → `Rejected`, Matcher never runs, no job, approving afterwards → 400 | Alternative path |
| TC-E2E-004 | 〃 | Validator auto-approves → job assigned with no human step | Alternative path |
| TC-E2E-005 | 〃 | Cross-component rules: complete before accept (409), receive before collected (409), wrong collector (409), receive twice (409), skip to ReadyForSale (409), outputs heavier than unit (400), unpriced material (400), oversell (400), Pending buyer (400) | Invalid / boundary |
| TC-E2E-006 | 〃 | Each role limited to its own part: no token 401, household/worker/collector cannot approve, collector cannot open the warehouse, worker cannot sell, staff cannot set prices (403) | Security (authorization) |
| TC-E2E-007 | `specs/full-workflow.ui.spec.ts` | Household submits through the **React form**. Staff see the Copper *Ready for sale* and the completed order **in the web app** | Normal (UI) |

## Who owns which step

| File | Component | Owner |
|---|---|---|
| `steps/a-submission.ts` | A – Generator & Submission | Dinuri |
| `steps/b-collection.ts` | B – Collection & Logistics | Nethmini |
| `steps/c-inventory.ts` | C – Processing & Inventory | Manodya (E2E lead) |
| `steps/d-sales.ts` | D – Sales, Pricing & Export | Upeksha |

Each member should be able to explain their step's calls and assertions in the viva.

## Evidence produced by a run

| Evidence | Location | Use it for |
|---|---|---|
| HTML report: every test, every `test.step` per component, pass/fail, timings | `e2e-report/index.html` | Main screenshot for the report / test execution summary |
| Playwright traces (each request and response, each UI action with DOM snapshot) | `e2e-results/artifacts/**/trace.zip` → `npx playwright show-trace <file>` | Viva demo of a step |
| Videos + screenshots of the UI test | `e2e-results/artifacts/**/*.webm`, `*.png` | Showing the UI part of the workflow |
| `workflow-trace.json` (all ids created by TC-E2E-001) | Attached to TC-E2E-001 in the HTML report | Linking test to DB rows |
| JUnit XML / JSON results | `e2e-results/junit.xml`, `e2e-results/results.json` | Test case document actual results, CI |
| Terminal output (`list` reporter) | Your terminal | Screenshot of the run |
