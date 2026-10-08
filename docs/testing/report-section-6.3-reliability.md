### 6.3.x Reliability and recovery testing (G4 — Nethmini)

#### Justification
Reliability and recovery testing was selected because the intake workflow runs in the background
from an **in-memory queue**. A crash or restart of the API would lose every workflow in progress.
The household would then wait forever for a collector, and staff would not know anything had
gone wrong. The system relies on `WorkflowStartupRecovery` to put interrupted workflows back on
the queue, so this behaviour carries a high business risk and needs to be tested against the
real system.

#### Tools
- **Playwright (API testing)**, reusing the G0 environment: the stub agents, an isolated
  PostgreSQL database, and the real API process. A helper (`e2e/support/api-process.ts`) starts
  the API, **hard-kills** it (SIGKILL, like a power cut), and starts it again on the same database.
- **xUnit**: the existing unit tests `WorkflowStartupRecoveryTests` cover the recovery rules in isolation.

#### Environment
Same machine as section 6.1. API on port 5181, database `SmartEWasteDB_E2E_Reliability`, stub agents.

#### Test cases and results
| ID | Scenario | Expected | Actual | Status |
|---|---|---|---|---|
| TC-REL-001 | API crashes while the Analyzer call is in flight (workflow `Analyzing`) | After restart the workflow resumes and reaches `PendingApproval`. Planner is not re-run, and only the interrupted Analyzer call is repeated. Exactly one job after approval. | Resumed to `PendingApproval`. Calls: planner ×1, analyzer ×2 (interrupted + retry), validator ×1. One job assigned. | Pass |
| TC-REL-002 | API crashes while the workflow waits for human approval | Still `PendingApproval`, no new agent calls, submission still visible, approval after restart creates one job | As expected | Pass |
| TC-REL-003 | API crashes after the job was created | Workflow stays `Completed` with the same job, no agent calls, one job in DB, collector can accept it | As expected; collector accepted the job after restart | Pass |
| TC-REL-004 | Analyzer agent hangs (never answers), no crash | Timeout ends the call. Workflow `Failed`, failure logged, no job, API still processes new submissions. | Failed safely after **61 s** (60 s client timeout). New submission reached `PendingApproval`. | Pass |
| TC-REL-005 | Backend unit level: `WorkflowStartupRecoveryTests` (xUnit, 12 tests) | Every in-progress status is re-queued once, oldest first. `PendingApproval` is not re-queued. A DB failure does not block startup. Disabled recovery re-queues nothing. | 12 / 12 passed | Pass |

**Negative control.** To show TC-REL-001 really detects a broken recovery, it was re-run with
recovery turned off (`Workflow__RecoverOnStartup=false`). The test **failed** as expected: after
the restart the workflow stayed in `Analyzing` (*Expected: "PendingApproval", Received: "Analyzing"*).
Without startup recovery, a crash leaves submissions stuck forever. With recovery on, the same
test passes.

> 📷 Figure 6.x — Playwright terminal: 4 reliability tests passed
> 📷 Figure 6.x — HTML report, TC-REL-001 steps (crash → restart → resumed)
> 📷 Figure 6.x — Negative control: TC-REL-001 failing with recovery disabled
> 📷 Figure 6.x — xUnit: 12 WorkflowStartupRecoveryTests passed

#### Interpretation
- The workflow survives a hard crash at any point tested: during an agent call, while waiting
  for approval, and after the job is created. No data is lost, and no step or job is duplicated.
- Recovery repeats **only the interrupted step**, not the whole chain, because each step's result
  is saved to PostgreSQL before moving on. The Finalize step also checks for an existing job
  before creating one, so a crash between "job created" and "workflow completed" cannot create
  a second job.
- A hung agent cannot block a workflow forever: the HttpClient timeout (60 s for the Analyzer)
  turns it into a logged, safe failure.
- **Observation (not fixed):** a workflow that fails because an agent was temporarily down stays
  `Failed`. There is no automatic retry and no "retry" action for staff, so the household has to
  submit again. Recommended improvement: a retry endpoint or button for failed workflows.

#### Defects
No reliability defects were found. All tests passed. The negative control confirms the tests
are able to detect a recovery failure.

Evidence: `docs/testing/evidence/reliability/` (terminal output, HTML report with traces,
`junit.xml`, negative-control output, xUnit output). Test code: `frontend-react/project/e2e/reliability/`.
