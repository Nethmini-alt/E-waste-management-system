# G4 — Reliability and recovery tests

**Owner:** Nethmini · **Tool:** Playwright (API testing) + xUnit · **Run:** `npm run reliability`

## What is tested and why

The intake workflow (Planner → Analyzer → Validator → Matcher → Finalize) runs in the
background from an **in-memory queue**. If the API crashes, everything in that queue is lost.
`WorkflowStartupRecovery` re-queues interrupted workflows when the API starts again, and
`RunChainAsync` continues from the status stored in PostgreSQL.

These tests check that this works against the **real system**. A real API process is
**hard-killed** (SIGKILL on Linux, `taskkill /F` on Windows, like a power cut) in the middle of
a workflow, then started again on the same database.

| ID | Scenario | Checks |
|---|---|---|
| TC-REL-001 | Crash while an agent call is in flight (workflow in `Analyzing`) | Resumes after restart and reaches `PendingApproval`. Planner **not** re-run, only the interrupted Analyzer call repeated. Completes with exactly one job. |
| TC-REL-002 | Crash while waiting for human approval | Still `PendingApproval` after restart, no new agent calls, submission still there, approving after restart creates one job |
| TC-REL-003 | Crash after the job was created | Workflow stays `Completed`, nothing re-runs, still one job in the DB, the collector can accept it after restart |
| TC-REL-004 | An agent hangs (no crash) | The 60 s HttpClient timeout ends the call. The workflow becomes `Failed`, the failure is logged, no job is created, and the API keeps working for new submissions. |

The existing xUnit tests `WorkflowStartupRecoveryTests` (12 tests) cover the same recovery
rules at unit level.

## How it works

- `playwright.reliability.config.ts` starts only the stub agents. The test owns the API process.
- `e2e/support/api-process.ts` starts the API with the G0 launcher (`scripts/start-api.mjs`),
  hard-kills it, and starts it again.
- The tests use their own port **5181** and database **`SmartEWasteDB_E2E_Reliability`**, so they
  never touch the dev API, the E2E API on 5180, or a k6 run.
- The stub Analyzer has a `hang` mode (never answers), which keeps a workflow mid-chain long
  enough to crash the API during it.
- The stub call log and a direct `SELECT count(*) FROM jobs` check for repeated steps and
  duplicate jobs.

## Run

Needs the same setup as the E2E suite (Node, .NET 8, PostgreSQL running, `npm install` done).
Stop any API already running on port 5181.

```bash
cd frontend-react/project
npm run reliability          # about 2 minutes (the first run builds the API)
npm run reliability:report   # opens the HTML report
```

**Negative control:** to show the test really detects a broken recovery, turn recovery off. TC-REL-001 then fails, because the workflow stays stuck in `Analyzing`.

Bash:
```bash
Workflow__RecoverOnStartup=false npx playwright test -c playwright.reliability.config.ts -g "TC-REL-001"
```
PowerShell:
```powershell
$env:Workflow__RecoverOnStartup = "false"; npx playwright test -c playwright.reliability.config.ts -g "TC-REL-001"; Remove-Item Env:Workflow__RecoverOnStartup
```

Backend unit-level recovery tests:
```bash
cd backend
dotnet test EWasteManagement.Tests --filter "FullyQualifiedName~WorkflowStartupRecovery"
```

## Evidence

Saved in `docs/testing/evidence/reliability/`: the terminal output, the HTML report (with
traces), `junit.xml`, the negative-control output, and the xUnit output.
