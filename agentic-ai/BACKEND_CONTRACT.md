# BACKEND_CONTRACT - what ASP.NET Core must do for the agentic-ai service

**Status: items 1-7 below are now built on the .NET side** (the C# sketches in sections 1, 2 and 5 are superseded by the
real code: `SubmissionService`, `AgentReportingController`, `AgentWorkflowsController`, `AgentKeyAttribute`, `CollectorsController`).
Still to do: apply the migrations (`dotnet ef database update`), set `REPORT_TO_BACKEND=true`, switch the React approve/reject
buttons to the new `api/v1/agent-workflows/{id}/approve|reject|revise` endpoints, and notifications (not built).

## 0. Priority list  (all built)

| # | Change | Why |
|---|---|---|
| 1 | Replace `TriggerAIAgentAsync` so it calls `POST http://localhost:8000/workflows` | new entry point |
| 2 | Add `AgentKeyAttribute` and put it on the agent-facing endpoints | they are `[AllowAnonymous]` today |
| 3 | `POST /api/agent/workflows/{id}/steps` and `/result` + two tables | persistence + observability (spec requirement) |
| 4 | Approve / Reject / Request-revision endpoints for Staff | the human approval gate |
| 5 | `POST /api/v1/collectors/geocode` and `PreferredCollectorId` on job creation | Matcher needs coordinates; job uses the chosen collector |
| 6 | Currency: store `estimated_value_lkr` (not USD) | pricing in your DB is LKR |
| 7 | Remove `POST /submissions/{id}/ai-callback` | unauthenticated write path, replaced by #3 |

## 1. Start a workflow  (.NET -> Python)

`POST http://localhost:8000/workflows`, header `X-Agent-Key: <Agent:ApiKey>`. camelCase or snake_case both accepted.
.NET creates the `WorkflowId` (a new Guid) and the `AgentWorkflows` row (`Status = "Planning"`) **before** calling.
```json
{ "workflowId": "guid", "submissionId": "guid", "submissionType": "Household",
  "objective": "optional text", "pickupAddress": "45 Galle Road, Colombo 03",
  "pickupLatitude": 6.9, "pickupLongitude": 79.85,
  "items": [ { "itemName": "Laptop", "description": "Old Dell", "imageUrl": "/uploads/abc.jpg" } ],
  "csvItems": [ { "itemType": "Laptop", "quantity": 10, "weightKg": 30, "condition": "Used" } ],
  "preferredWindowStart": "2026-09-25T04:00:00Z", "preferredWindowEnd": "2026-09-25T10:00:00Z" }
```
Limits: 1-20 items, up to 200 CSV rows, description <= 2000 chars. `202 {"workflow_id", "status":"Running"}`; a repeated
`workflowId` is idempotent (safe to retry). Send **all** items, not just the first. Household needs `items`; corporate
needs `csvItems` (validated/parsed by .NET first). **Image URLs** must be reachable from the Python service and be on
the API host (relative `/uploads/..` paths are resolved against `API_BASE_URL`) or in `IMAGE_HOST_ALLOWLIST`.

```csharp
// SubmissionService: replace TriggerAIAgentAsync (fire-and-forget is fine; the result comes back via section 2)
var payload = new { workflowId, submissionId = submission.Id, submissionType = submission.UserType,
    pickupAddress = submission.PickupAddress,
    items = submission.Items.Select(i => new { itemName = i.ItemName, description = i.Description, imageUrl = i.ImageUrl }) };
var req = new HttpRequestMessage(HttpMethod.Post, $"{_config["AgenticAi:BaseUrl"]}/workflows") { Content = JsonContent.Create(payload) };
req.Headers.Add("X-Agent-Key", _config["Agent:ApiKey"]);
await _httpClient.SendAsync(req);
```

## 2. Progress reporting  (Python -> .NET), enabled with `REPORT_TO_BACKEND=true`

Both endpoints require `X-Agent-Key`. Bodies are **snake_case**: configure `JsonNamingPolicy.SnakeCaseLower` (.NET 8) on
these DTOs. Persist as-is (jsonb columns). Make both **idempotent** (upsert by workflow_id + step key), the service retries.

`POST /api/agent/workflows/{workflowId}/steps` - one per finished agent step:
```json
{ "workflow_id": "guid", "agent": "analyzer", "step_name": "analyze_submission", "status": "succeeded",
  "started_at": "2026-09-21T06:00:00Z", "duration_ms": 1840, "retries": 0, "error": null,
  "input_summary": {}, "output": {}, "checks": [ { "code": "hazard_level", "passed": true, "message": "..." } ],
  "tool_calls": [ { "tool": "get_approved_pricing", "agent": "analyzer", "ok": true, "attempts": 1,
                    "status_code": 200, "duration_ms": 35, "input_summary": {}, "error": null } ] }
```
`POST /api/agent/workflows/{workflowId}/result` - once per run (again after each revision):
```json
{ "workflow_id": "guid", "submission_id": "guid",
  "outcome": "PendingApproval | ReadyForAutoAssignment | SafeFailure", "failure_reason": null, "revision_count": 0,
  "plan": {}, "analysis": {}, "validation": {}, "match": {}, "proposal": {}, "errors": [], "step_count": 5 }
```
`proposal` (when present): `handling_path` (LocalReuse/LocalRecycle/Export/ManualDecision), `gross_value_lkr`,
`estimated_costs_lkr`, `estimated_net_value_lkr`, `recommended_collector_id`, `eta_minutes`, `pickup_window_start/end`,
`approval_required`, `approval_reasons[]`, `risk_flags[]`, `summary`.

Suggested tables: `AgentWorkflows(WorkflowId PK, SubmissionId, Status, Outcome, FailureReason, RevisionCount, Plan jsonb,
Analysis jsonb, Validation jsonb, Match jsonb, Proposal jsonb, CreatedAt, UpdatedAt)` and `AgentSteps(Id, WorkflowId FK,
Agent, StepName, Status, StartedAt, DurationMs, Retries, Error, InputSummary jsonb, Output jsonb, Checks jsonb,
ToolCalls jsonb)`. React and Flutter render the execution summary from these.

### Outcome -> statuses

| outcome | AgentWorkflows.Status | Submission.Status | What happens |
|---|---|---|---|
| `PendingApproval` | Pending Approval | Pending_Approval | staff decide in React (section 3) |
| `ReadyForAutoAssignment` | Completed - Plan Accepted | Approved | create the Job immediately (same as an approval, `DecidedBy = "system"`) |
| `SafeFailure` | Failed - Needs Manual Review | Needs_Review | staff handle manually; notify generator |

## 3. Human decision  (React -> .NET, Staff/Admin only; record user id + timestamp)

* **Approve** -> create the Job from the proposal: `PickupAddress` (from the submission), `RequiredCapacityKg =
  analysis.estimated_volume_kg`, `ScheduledWindowStart/End = proposal.pickup_window_*`, and assign
  `proposal.recommended_collector_id` (add `PreferredCollectorId` to the assign call; the Matcher already checked
  capacity/availability, so re-check availability at assignment time). Notify collector + generator. Status Completed.
* **Reject** -> Status "Failed - Rejected", reason stored, notify generator.
* **Request revision** -> `POST http://localhost:8000/workflows/{id}/revise`
  `{ "feedback": { "excludeCollectorIds": ["guid"], "preferredWindowStart": "...", "preferredWindowEnd": "...", "notes": "..." },
     "previousState": { ...optional: the stored plan/analysis/description/items... } }`
  Re-runs Validator -> Matcher -> Planner (the Analyzer is not repeated), max 3 revisions (`409` beyond that),
  then a new `/result` arrives. Send `previousState` only if the Python service may have restarted (it keeps runs in memory).

## 4. Tools the agents call  (Python -> .NET)

| Tool | Endpoint | State |
|---|---|---|
| get_approved_pricing | `GET /api/agent/pricing/approved` | *(exists, X-Agent-Key)* prices are LKR/kg |
| get_eligible_buyers | `GET /api/agent/buyers/eligible` | *(exists, X-Agent-Key)* the response includes contact names/e-mails; the agent drops them at parse time, consider not returning them |
| find_collectors | `POST /api/v1/collectors/match` | *(exists)* **`[AllowAnonymous]` today: add AgentKey** |
| geocode_address | `POST /api/v1/collectors/geocode` | **to build** (wrap `IGeoService`; returns `{resolved, latitude, longitude}`) |
| validate_classification | `POST /api/v1/inventory/{id}/validate-classification` | *(exists)* facility-side gate only, not used at intake |

## 5. AgentKeyAttribute (sketch)

```csharp
public class AgentKeyAttribute : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext ctx, ActionExecutionDelegate next)
    {
        var expected = ctx.HttpContext.RequestServices.GetRequiredService<IConfiguration>()["Agent:ApiKey"];
        var ok = !string.IsNullOrWhiteSpace(expected)
              && ctx.HttpContext.Request.Headers.TryGetValue("X-Agent-Key", out var provided)
              && CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(provided.ToString()), Encoding.UTF8.GetBytes(expected));
        if (!ok) { ctx.Result = new UnauthorizedObjectResult(new { message = "Invalid agent API key." }); return; }
        await next();
    }
}
```
Use the same secret as `AGENT_API_KEY` in the Python `.env`; keep it out of git (user-secrets / environment variable).

## 6. Other gaps found while reading the code

* `Submission` has no coordinates; the Matcher geocodes the address. Storing lat/lng at submission time makes matching faster.
* `SubmissionsController` has no `[Authorize]`; anyone can create or read submissions.
* ~~Component A stores `EstimatedValueUsd`~~ Renamed to `EstimatedValueLkr` (migration `RenameAIAnalysisValueToLkr`); the
  agents' result now fills the `AIAnalysisResults` row that the submit and admin-review pages read.
