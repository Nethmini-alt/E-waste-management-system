# G2 — Performance Testing (k6): Plan and Instructions

**Owner:** Nethmini · **Deadline:** 8 Oct 2026 · **Required by the brief:** yes (performance testing is mandatory)

This pack has everything needed to run the group's performance tests and write them up:
- a plan,
- ready-to-run k6 scripts (the smoke test has already been run successfully against our system),
- step-by-step instructions,
- a report-section template.

You run the tests, collect the evidence, and explain them in the viva. Read every script before
running it, so you can explain each line.

---

## 1. Plan

### Goal
Measure how the E-Waste API behaves under normal load, heavy load and sudden bursts, and
find the point where it starts to slow down or fail.

### Why k6
- Scriptable in JavaScript, so tests are code: repeatable, in Git, reviewable.
- Built-in pass/fail rules ("thresholds") and an HTML dashboard report for evidence.
- Light enough to generate hundreds of virtual users from one laptop.
- Suggested by the assignment brief (k6 / JMeter).

### What is tested
A realistic mix of the main screens of **all four components**, per virtual user:

| Component | Endpoint | Who calls it |
|---|---|---|
| A — Submission | `GET /api/v1/submissions/mine` | Household |
| B — Collection | `GET /api/v1/jobs/my` | Collector |
| C — Inventory | `GET /api/v1/inventory` (page 1, 20 rows), `GET /api/v1/inventory/recovered-materials` | Staff |
| D — Sales | `GET /api/recovered-materials/available`, `GET /api/sales-orders`, `GET /api/revenue/summary` | Staff |
| Auth | `POST /api/auth/login` (≈1 in 10 iterations) | Household |

Each virtual user waits 1 s between iterations ("think time"), like a real user.

**Not load-tested, on purpose:** the real AI agents and OpenStreetMap. Load-testing them would
test someone else's servers (and could get us rate-limited). The workflow's handling of agent
failures is already covered by the E2E test TC-E2E-002.

### Test cases
| ID | Script | Load profile | Pass criteria | Duration |
|---|---|---|---|---|
| TC-PERF-001 | `smoke.js` | 1 user | 0 errors; reads p95 < 500 ms; login p95 < 1000 ms | 30 s |
| TC-PERF-002 | `load.js` | ramp to **50 users**, hold 5 min | errors < 1%; reads p95 < 500 ms; login p95 < 1000 ms; checks > 99% | ~7 min |
| TC-PERF-003 | `stress.js` | 50 → 100 → 200 → 300 users | No pass/fail. Find the stage where p95 > 2 s or errors > 5%, and check recovery | ~14 min |
| TC-PERF-004 | `spike.js` | 5 → **150 users in 10 s** → back to 5 | Errors < 5% during the spike; response times return to normal afterwards | ~3 min |

Thresholds are in `tests/performance/k6/lib/config.js`.

### Environment
The tests run against the **isolated E2E test API** (port 5180, database `SmartEWasteDB_E2E`),
never against the dev API or the shared database. Record the machine specs in the report:
CPU, RAM, Windows version. Results depend on the laptop, and the API and k6 share the same machine.

---

## 2. Setup (one time)

1. **Get the latest code** with the E2E tests (G1). They are on `develop` after Manodya's PR is merged:
   ```bash
   git checkout develop
   git pull
   git checkout -b feature/g2-performance-testing
   ```
2. **Copy this pack's `tests/` folder into the repository root**, so you get
   `E-waste-management-system/tests/performance/k6/...`
3. **Install k6:**
   ```powershell
   winget install k6 --source winget
   ```
   If winget fails, download the Windows zip from https://github.com/grafana/k6/releases and
   use `k6.exe` from it. Check it works with `k6 version`.

   Linux (Fedora): `sudo dnf install k6` (from the k6 repo), or download the
   `k6-vX.Y.Z-linux-amd64.tar.gz` release, extract it and put `k6` in `~/.local/bin`.
4. **Make the E2E suite work once** (it creates the admin account and realistic data the k6 tests use):
   ```bash
   cd frontend-react/project
   npm install
   npx playwright install chromium
   npm run e2e
   ```
   It must end with `8 passed`. If it doesn't, fix that first (see `frontend-react/project/e2e/README.md`).

---

## 3. Running the tests

### Terminal 1 — start the test API (keep it open)
**Keep the data from the E2E run.** Without `E2E_KEEP_DB=1` the database is wiped and the admin is lost.

PowerShell:
```powershell
cd frontend-react/project
$env:E2E_KEEP_DB = "1"
node e2e/scripts/start-api.mjs
```
Git Bash:
```bash
cd frontend-react/project
E2E_KEEP_DB=1 node e2e/scripts/start-api.mjs
```
Wait until `http://localhost:5180/healthz` shows `{"status":"ok"}`.

### Terminal 2 — run k6
Close other heavy programs first. Run from `tests/performance/k6`.

PowerShell (each test writes an HTML report and a JSON summary into `results/`):
```powershell
cd tests/performance/k6
mkdir results -Force
$env:K6_WEB_DASHBOARD = "true"

$env:K6_WEB_DASHBOARD_EXPORT = "results/smoke-report.html";  k6 run --summary-export results/smoke-summary.json  smoke.js
$env:K6_WEB_DASHBOARD_EXPORT = "results/load-report.html";   k6 run --summary-export results/load-summary.json   load.js
$env:K6_WEB_DASHBOARD_EXPORT = "results/stress-report.html"; k6 run --summary-export results/stress-summary.json stress.js
$env:K6_WEB_DASHBOARD_EXPORT = "results/spike-report.html";  k6 run --summary-export results/spike-summary.json  spike.js
```
Git Bash / Linux:
```bash
cd tests/performance/k6
./run.sh smoke     # one test: smoke | load | stress | spike
./run.sh all       # all four in order (stops if smoke fails)
```
`run.sh` writes `results/<test>-report.html` and `results/<test>-summary.json`.

**Always run smoke first.** If smoke fails, the scripts or environment are wrong, so don't run load yet.

While a test runs you can watch it live at **http://localhost:5665**, the k6 web dashboard.

---

## 4. Evidence to collect

| Evidence | How | Use in report |
|---|---|---|
| Terminal summary of each run (THRESHOLDS block with ✓/✗) | Screenshot the end of the terminal output | One figure per test |
| HTML dashboard report per test | `results/*-report.html`. Open it and screenshot the response-time and VU graphs | Main graphs, especially the stress breaking point |
| JSON summaries | `results/*-summary.json` | Numbers for the results table; attach as tool evidence |
| Machine specs | Settings → System → About | Test environment table |

Copy the final `results/` files to `docs/testing/evidence/performance/` before committing, so they are in the repo as evidence.

---

## 5. Interpreting the results

For each test, write down:
- **p95 response time** (95% of requests were faster than this) for reads and for login
- **error rate** (`http_req_failed`)
- **requests per second** (`http_reqs`)
- for stress: **the user count at which p95 goes above 2 s or errors above 5%**, and whether
  it recovered when load dropped
- for spike: **errors during the spike**, and whether response times returned to normal afterwards

Reference: our smoke run on a developer laptop gave reads p95 ≈ 11 ms, login p95 ≈ 225 ms, 0 errors.
Login is much slower than reads because passwords are hashed with BCrypt. That is deliberate
(it slows down password guessing), and worth explaining in the viva.

---

## 6. Defects

If a **load** threshold fails (TC-PERF-002), or the system breaks too early in stress:
1. Open the HTML report and find the **slowest endpoint**: k6 tags every request with its name.
2. Log it as **DEF-PERF-01** in the group defect report: endpoint, users, p95, error rate, screenshot.
3. Find the cause with the owner of that component, e.g. a query loading too much data,
   a missing database index, or no paging.
4. Fix it in a separate commit: `fix(perf): DEF-PERF-01 ...`.
5. **Re-run the same test** and record before/after numbers. This is the retest evidence.

If every threshold passes, say so in the report. That is a valid result. The stress
test's breaking point is still a finding to report.

---

## 7. Commit your work

```bash
git add tests/performance docs/testing/evidence/performance
git commit -m "test(perf): add k6 smoke, load, stress and spike tests (G2)"
git push origin feature/g2-performance-testing
```
Then open a PR into `develop`. Commit in your own name, because the commits are part of the individual marks.

---

## 8. Viva preparation — be ready to answer

- Why k6, and what is a virtual user (VU)?
- What do `stages`, `thresholds`, `checks` and `setup()` do in your scripts?
- What does p95 mean, and why use it instead of the average?
- Difference between load, stress and spike testing.
- Why login is slower than the other requests (BCrypt).
- Why the real AI agents were not load-tested.
- At how many users did the system degrade, and what was the likely bottleneck?
- Live task: change the load test to 80 users, re-run smoke, and explain the output.

---

## 9. Report section

Fill in `report-section-6.1-template.md` and paste it into section 6.1 of the group report
(`docs/testing/SE3110-Testing-Report-Draft.md`).
