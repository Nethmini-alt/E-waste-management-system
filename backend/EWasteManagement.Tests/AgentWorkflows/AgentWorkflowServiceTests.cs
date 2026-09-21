using System.Text.Json;
using EWasteManagement.Api.Entities;
using EWasteManagement.API.Features.AgentWorkflows.DTOs;
using EWasteManagement.API.Features.AgentWorkflows.Entities;
using EWasteManagement.API.Features.AgentWorkflows.Services;
using EWasteManagement.API.Features.Collection.DTOs;
using EWasteManagement.API.Features.Collection.Entities;
using EWasteManagement.API.Features.Collection.Services;
using EWasteManagement.API.Infrastructure.ExternalServices;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.Tests.TestHelpers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EWasteManagement.Tests.AgentWorkflows;

public class AgentWorkflowServiceTests : IAsyncLifetime
{
    private static readonly Guid CollectorId = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");
    private static readonly Guid StaffId = Guid.Parse("bbbbbbbb-0000-0000-0000-000000000001");

    private SqliteConnection _connection = null!;
    private ApplicationDbContext _db = null!;
    private FakeJobService _jobs = null!;
    private FakeAgenticAiClient _agent = null!;
    private AgentWorkflowService _service = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();

        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options;
        _db = new ApplicationDbContext(options, new NoOpDomainEventDispatcher());
        await _db.Database.EnsureCreatedAsync();

        _jobs = new FakeJobService();
        _agent = new FakeAgenticAiClient();
        _service = new AgentWorkflowService(_db, _jobs, _agent, NullLogger<AgentWorkflowService>.Instance);
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    // ----------------------------------------------------------------- seeding / helpers

    private static JsonElement Json(string json) => JsonSerializer.Deserialize<JsonElement>(json);

    private const string ProposalJson = """
        {"outcome":"PendingApproval","handling_path":"LocalRecycle",
         "recommended_collector_id":"aaaaaaaa-0000-0000-0000-000000000001",
         "pickup_window_start":"2026-09-25T04:00:00Z","pickup_window_end":"2026-09-25T10:00:00Z"}
        """;
    private const string AnalysisJson = """{"estimated_volume_kg":42.5,"hazard_level":"Low"}""";
    private const string MatchJson = """{"pickup_latitude":6.93,"pickup_longitude":79.85}""";
    private const string PlanJson = """{"steps":[{"id":"s1","agent":"analyzer"}],"flags":[]}""";

    /// <summary>A submission with two items and a workflow in the given state (with the agents' results stored).</summary>
    private async Task<AgentWorkflow> SeedAsync(
        AgentWorkflowStatus status = AgentWorkflowStatus.PendingApproval, bool withResults = true)
    {
        var submission = new Submission
        {
            UserId = Guid.NewGuid(),
            UserType = "Generator",
            PickupAddress = "45 Galle Road, Colombo 03",
            Items =
            {
                new SubmissionItem { ItemName = "Laptop", Description = "Old Dell", ImageUrl = "/uploads/a.jpg" },
                new SubmissionItem { ItemName = "Phone", Description = "Cracked", ImageUrl = "" }
            }
        };
        var workflow = new AgentWorkflow { SubmissionId = submission.Id, Status = status };
        if (withResults)
        {
            workflow.Outcome = "PendingApproval";
            workflow.Proposal = ProposalJson;
            workflow.Analysis = AnalysisJson;
            workflow.Match = MatchJson;
            workflow.Plan = PlanJson;
        }

        _db.Submissions.Add(submission);
        _db.AgentWorkflows.Add(workflow);
        await _db.SaveChangesAsync();
        return workflow;
    }

    private async Task<AgentWorkflow> ReloadAsync(Guid id)
    {
        _db.ChangeTracker.Clear();
        return await _db.AgentWorkflows.SingleAsync(w => w.Id == id);
    }

    private async Task<string> SubmissionStatusAsync(Guid submissionId)
    {
        _db.ChangeTracker.Clear();
        return (await _db.Submissions.SingleAsync(s => s.Id == submissionId)).Status;
    }

    private static AgentStepReport Step(string agent, string name, DateTime startedAt, string status = "succeeded") => new()
    {
        Agent = agent,
        StepName = name,
        Status = status,
        StartedAt = startedAt,
        DurationMs = 120,
        Retries = 0,
        Output = Json("""{"ok":true}"""),
        Checks = Json("""[{"code":"hazard_level","passed":true}]""")
    };

    private static AgentResultReport Result(
        AgentWorkflow w, string outcome, int revisionCount = 0, string? analysis = null, string? proposal = null) => new()
    {
        WorkflowId = w.WorkflowId,
        SubmissionId = w.SubmissionId,
        Outcome = outcome,
        RevisionCount = revisionCount,
        Plan = Json(PlanJson),
        Analysis = Json(analysis ?? AnalysisJson),
        Validation = Json("""{"decision":"approved"}"""),
        Match = Json(MatchJson),
        Proposal = Json(proposal ?? ProposalJson)
    };

    // A complete analysis, as the Analyzer reports it (snake_case, LKR).
    private const string FullAnalysisJson = """
        {"waste_categories":["Laptops","Batteries"],"hazard_level":"High","estimated_volume_kg":42.5,
         "estimated_value_lkr":18500.75,"analyzer_requested_approval":true}
        """;

    // ----------------------------------------------------------------- steps

    [Fact]
    public async Task RecordStep_StoresTheStepWithItsJson()
    {
        var wf = await SeedAsync(AgentWorkflowStatus.Planning, withResults: false);

        await _service.RecordStepAsync(wf.WorkflowId, Step("analyzer", "analyze_submission", new DateTime(2026, 9, 21, 6, 0, 0, DateTimeKind.Utc)));

        var step = await _db.AgentSteps.SingleAsync();
        Assert.Equal("analyzer", step.Agent);
        Assert.Equal("succeeded", step.Status);
        Assert.Equal(120, step.DurationMs);
        Assert.Contains("\"ok\":true", step.Output);
        Assert.Null(step.ToolCalls);
    }

    [Fact]
    public async Task RecordStep_SameStepReportedTwice_IsStoredOnce()
    {
        var wf = await SeedAsync(AgentWorkflowStatus.Planning, withResults: false);
        var startedAt = new DateTime(2026, 9, 21, 6, 0, 0, DateTimeKind.Utc);

        await _service.RecordStepAsync(wf.WorkflowId, Step("analyzer", "analyze_submission", startedAt));
        var retry = Step("analyzer", "analyze_submission", startedAt);
        retry.DurationMs = 999;   // the retry carries the same step, so it updates rather than duplicates
        await _service.RecordStepAsync(wf.WorkflowId, retry);

        var step = await _db.AgentSteps.SingleAsync();
        Assert.Equal(999, step.DurationMs);
    }

    [Fact]
    public async Task RecordStep_SameStepRerunAfterARevision_KeepsBothRunsInTheHistory()
    {
        var wf = await SeedAsync(AgentWorkflowStatus.Planning, withResults: false);

        await _service.RecordStepAsync(wf.WorkflowId, Step("matcher", "match_collectors", new DateTime(2026, 9, 21, 6, 0, 0, DateTimeKind.Utc)));

        wf.RevisionCount = 1;   // a revision was requested in between
        await _db.SaveChangesAsync();
        await _service.RecordStepAsync(wf.WorkflowId, Step("matcher", "match_collectors", new DateTime(2026, 9, 21, 6, 5, 0, DateTimeKind.Utc)));

        var steps = await _db.AgentSteps.OrderBy(s => s.StartedAt).ToListAsync();
        Assert.Equal(2, steps.Count);
        Assert.Equal(new[] { 0, 1 }, steps.Select(s => s.Revision));
    }

    [Fact]
    public async Task RecordStep_RejectsUnknownWorkflowBadStatusAndMismatchedId()
    {
        var wf = await SeedAsync(AgentWorkflowStatus.Planning, withResults: false);
        var at = new DateTime(2026, 9, 21, 6, 0, 0, DateTimeKind.Utc);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            _service.RecordStepAsync(Guid.NewGuid(), Step("analyzer", "x", at)));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _service.RecordStepAsync(wf.WorkflowId, Step("analyzer", "x", at, status: "weird")));

        var mismatched = Step("analyzer", "x", at);
        mismatched.WorkflowId = Guid.NewGuid();
        await Assert.ThrowsAsync<ArgumentException>(() => _service.RecordStepAsync(wf.WorkflowId, mismatched));
    }

    // ----------------------------------------------------------------- results

    [Fact]
    public async Task RecordResult_PendingApproval_StoresResultsAndWaitsForStaff()
    {
        var wf = await SeedAsync(AgentWorkflowStatus.Planning, withResults: false);

        await _service.RecordResultAsync(wf.WorkflowId, Result(wf, "PendingApproval"));

        var saved = await ReloadAsync(wf.WorkflowId);
        Assert.Equal(AgentWorkflowStatus.PendingApproval, saved.Status);
        Assert.Equal("PendingApproval", saved.Outcome);
        Assert.Contains("recommended_collector_id", saved.Proposal);
        Assert.Contains("estimated_volume_kg", saved.Analysis);
        Assert.Equal("Pending_Approval", await SubmissionStatusAsync(wf.SubmissionId));
        Assert.Empty(_jobs.Created);
    }

    [Fact]
    public async Task RecordResult_StoresTheAnalysisSummaryInLkr_ForTheExistingScreens()
    {
        var wf = await SeedAsync(AgentWorkflowStatus.Planning, withResults: false);

        await _service.RecordResultAsync(wf.WorkflowId, Result(wf, "PendingApproval", analysis: FullAnalysisJson,
            proposal: """{"approval_required":true,"recommended_collector_id":null}"""));

        var row = await _db.AIAnalysisResults.AsNoTracking().SingleAsync();
        Assert.Equal(wf.SubmissionId, row.SubmissionId);
        Assert.Equal("Laptops, Batteries", row.WasteCategory);
        Assert.Equal("High", row.HazardLevel);
        Assert.Equal(42.5m, row.EstimatedVolumeKg);
        Assert.Equal(18500.75m, row.EstimatedValueLkr);
        Assert.True(row.RequiresHumanApproval);
    }

    [Fact]
    public async Task RecordResult_ASecondResult_UpdatesTheSameAnalysisRow()
    {
        var wf = await SeedAsync(AgentWorkflowStatus.Planning, withResults: false);
        await _service.RecordResultAsync(wf.WorkflowId, Result(wf, "PendingApproval", analysis: FullAnalysisJson,
            proposal: """{"approval_required":true}"""));
        var firstAnalyzedAt = (await _db.AIAnalysisResults.AsNoTracking().SingleAsync()).AnalyzedAt;

        // A revision re-runs the plan, and this time the agents no longer need a person.
        var stored = await _db.AgentWorkflows.SingleAsync();
        stored.Status = AgentWorkflowStatus.RevisionInProgress;
        stored.RevisionCount = 1;
        await _db.SaveChangesAsync();
        await _service.RecordResultAsync(wf.WorkflowId, Result(wf, "PendingApproval", revisionCount: 1,
            analysis: FullAnalysisJson, proposal: """{"approval_required":false}"""));

        var row = await _db.AIAnalysisResults.AsNoTracking().SingleAsync();   // still exactly one row
        Assert.False(row.RequiresHumanApproval);
        Assert.Equal(firstAnalyzedAt, row.AnalyzedAt);   // the analysis itself was not re-run
    }

    [Fact]
    public async Task RecordResult_WithoutACompleteAnalysis_StoresNoSummary()
    {
        var wf = await SeedAsync(AgentWorkflowStatus.Planning, withResults: false);

        // The default test analysis has no categories or LKR value: the Analyzer did not finish.
        await _service.RecordResultAsync(wf.WorkflowId, Result(wf, "SafeFailure"));

        Assert.Empty(await _db.AIAnalysisResults.ToListAsync());
    }

    [Fact]
    public async Task RecordResult_AutoAssignment_RecordsThatNoApprovalWasNeeded_WhenThePlanSaysNothing()
    {
        var wf = await SeedAsync(AgentWorkflowStatus.Planning, withResults: false);

        await _service.RecordResultAsync(wf.WorkflowId, Result(wf, "ReadyForAutoAssignment", analysis: FullAnalysisJson));

        Assert.False((await _db.AIAnalysisResults.AsNoTracking().SingleAsync()).RequiresHumanApproval);
    }

    [Fact]
    public async Task RecordResult_SafeFailure_HandsTheSubmissionToStaff()
    {
        var wf = await SeedAsync(AgentWorkflowStatus.Planning, withResults: false);
        var report = Result(wf, "SafeFailure");
        report.FailureReason = "No language model is configured.";

        await _service.RecordResultAsync(wf.WorkflowId, report);

        var saved = await ReloadAsync(wf.WorkflowId);
        Assert.Equal(AgentWorkflowStatus.NeedsManualReview, saved.Status);
        Assert.Equal("No language model is configured.", saved.FailureReason);
        Assert.Equal("Needs_Review", await SubmissionStatusAsync(wf.SubmissionId));
        Assert.Empty(_jobs.Created);
    }

    [Fact]
    public async Task RecordResult_ReadyForAutoAssignment_CreatesTheJobAsTheSystem()
    {
        var wf = await SeedAsync(AgentWorkflowStatus.Planning, withResults: false);

        await _service.RecordResultAsync(wf.WorkflowId, Result(wf, "ReadyForAutoAssignment"));

        var saved = await ReloadAsync(wf.WorkflowId);
        Assert.Equal(AgentWorkflowStatus.Completed, saved.Status);
        Assert.Equal("AutoApproved", saved.Decision);
        Assert.Null(saved.DecidedByUserId);
        Assert.NotNull(saved.JobId);
        Assert.Equal("Approved", await SubmissionStatusAsync(wf.SubmissionId));

        var job = Assert.Single(_jobs.Created);
        Assert.Equal(CollectorId, job.PreferredCollectorId);
    }

    [Fact]
    public async Task RecordResult_AutoAssignment_WhenTheCollectorIsGone_FallsBackToStaff_AndKeepsTheResults()
    {
        var wf = await SeedAsync(AgentWorkflowStatus.Planning, withResults: false);
        _jobs.Failure = new PreferredCollectorUnavailableException(CollectorId);

        await _service.RecordResultAsync(wf.WorkflowId, Result(wf, "ReadyForAutoAssignment"));

        var saved = await ReloadAsync(wf.WorkflowId);
        Assert.Equal(AgentWorkflowStatus.NeedsManualReview, saved.Status);
        Assert.Contains("no longer available", saved.FailureReason);
        Assert.Null(saved.JobId);
        Assert.Contains("recommended_collector_id", saved.Proposal);   // the agents' work is not lost
        Assert.Equal("Needs_Review", await SubmissionStatusAsync(wf.SubmissionId));
    }

    [Fact]
    public async Task RecordResult_AfterTheWorkflowIsSettled_ChangesNothing()
    {
        var wf = await SeedAsync(AgentWorkflowStatus.Rejected);

        await _service.RecordResultAsync(wf.WorkflowId, Result(wf, "ReadyForAutoAssignment"));

        Assert.Equal(AgentWorkflowStatus.Rejected, (await ReloadAsync(wf.WorkflowId)).Status);
        Assert.Empty(_jobs.Created);
    }

    [Fact]
    public async Task RecordResult_FromAnEarlierRun_IsIgnoredOnceARevisionIsUnderway()
    {
        var wf = await SeedAsync(AgentWorkflowStatus.RevisionInProgress);
        wf.RevisionCount = 1;
        await _db.SaveChangesAsync();

        await _service.RecordResultAsync(wf.WorkflowId, Result(wf, "PendingApproval", revisionCount: 0));

        Assert.Equal(AgentWorkflowStatus.RevisionInProgress, (await ReloadAsync(wf.WorkflowId)).Status);
    }

    [Fact]
    public async Task RecordResult_RejectsUnknownOutcomeAndForeignSubmission()
    {
        var wf = await SeedAsync(AgentWorkflowStatus.Planning, withResults: false);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            _service.RecordResultAsync(wf.WorkflowId, Result(wf, "Whatever")));

        var foreign = Result(wf, "PendingApproval");
        foreign.SubmissionId = Guid.NewGuid();
        await Assert.ThrowsAsync<ArgumentException>(() => _service.RecordResultAsync(wf.WorkflowId, foreign));
    }

    // ----------------------------------------------------------------- approve

    [Fact]
    public async Task Approve_CreatesTheJobFromThePlan_AndCompletesTheWorkflow()
    {
        var wf = await SeedAsync();

        var response = await _service.ApproveAsync(wf.WorkflowId, StaffId, new ApproveWorkflowRequest { Comments = " looks good " });

        var job = Assert.Single(_jobs.Created);
        Assert.Equal(wf.SubmissionId, job.SubmissionId);
        Assert.Equal("45 Galle Road, Colombo 03", job.PickupAddress);
        Assert.Equal(CollectorId, job.PreferredCollectorId);
        Assert.Equal(42.5m, job.RequiredCapacityKg);
        Assert.Equal(new DateTime(2026, 9, 25, 4, 0, 0), job.ScheduledWindowStart);
        Assert.Equal(new DateTime(2026, 9, 25, 10, 0, 0), job.ScheduledWindowEnd);
        Assert.Equal(6.93m, job.PickupLatitude);     // reused from the Matcher, not geocoded again
        Assert.Equal(79.85m, job.PickupLongitude);

        Assert.Equal("Completed", response.Status);
        Assert.Equal("Approved", response.Decision);
        Assert.Equal(StaffId, response.DecidedByUserId);
        Assert.Equal("looks good", response.DecisionComments);
        Assert.NotNull(response.JobId);
        Assert.Equal("Approved", await SubmissionStatusAsync(wf.SubmissionId));
    }

    [Fact]
    public async Task Approve_WhenNotPendingApproval_IsAConflict()
    {
        var wf = await SeedAsync(AgentWorkflowStatus.Completed);

        await Assert.ThrowsAsync<WorkflowConflictException>(() =>
            _service.ApproveAsync(wf.WorkflowId, StaffId, new ApproveWorkflowRequest()));
        Assert.Empty(_jobs.Created);
    }

    [Fact]
    public async Task Approve_WhenTheCollectorIsNoLongerAvailable_CreatesNothingAndStaysPending()
    {
        var wf = await SeedAsync();
        _jobs.Failure = new PreferredCollectorUnavailableException(CollectorId);

        await Assert.ThrowsAsync<PreferredCollectorUnavailableException>(() =>
            _service.ApproveAsync(wf.WorkflowId, StaffId, new ApproveWorkflowRequest()));

        var saved = await ReloadAsync(wf.WorkflowId);
        Assert.Equal(AgentWorkflowStatus.PendingApproval, saved.Status);
        Assert.Null(saved.JobId);
        Assert.Null(saved.Decision);
        Assert.NotEqual("Approved", await SubmissionStatusAsync(wf.SubmissionId));
    }

    [Fact]
    public async Task Approve_WhenThePlanNamesNoCollector_LetsTheJobServicePickTheBestOne()
    {
        var wf = await SeedAsync();
        wf.Proposal = """{"outcome":"PendingApproval","recommended_collector_id":null}""";
        await _db.SaveChangesAsync();

        await _service.ApproveAsync(wf.WorkflowId, StaffId, new ApproveWorkflowRequest());

        Assert.Null(Assert.Single(_jobs.Created).PreferredCollectorId);
    }

    // ----------------------------------------------------------------- reject

    [Fact]
    public async Task Reject_RecordsTheReason_AndRejectsTheSubmission()
    {
        var wf = await SeedAsync();

        var response = await _service.RejectAsync(wf.WorkflowId, StaffId, new RejectWorkflowRequest { Reason = "  Not e-waste  " });

        Assert.Equal("Rejected", response.Status);
        Assert.Equal("Rejected", response.Decision);
        Assert.Equal("Not e-waste", response.DecisionComments);
        Assert.Equal(StaffId, response.DecidedByUserId);
        Assert.Equal("Rejected", await SubmissionStatusAsync(wf.SubmissionId));
        Assert.Empty(_jobs.Created);
    }

    [Fact]
    public async Task Reject_CannotBeDoneTwice()
    {
        var wf = await SeedAsync();
        await _service.RejectAsync(wf.WorkflowId, StaffId, new RejectWorkflowRequest { Reason = "Not e-waste" });

        await Assert.ThrowsAsync<WorkflowConflictException>(() =>
            _service.RejectAsync(wf.WorkflowId, StaffId, new RejectWorkflowRequest { Reason = "again" }));
    }

    // ----------------------------------------------------------------- revise

    [Fact]
    public async Task Revise_SendsFeedbackAndThePreviousState_AndMarksTheRevision()
    {
        var wf = await SeedAsync();
        var excluded = Guid.NewGuid();

        var response = await _service.ReviseAsync(wf.WorkflowId, StaffId, new ReviseWorkflowRequest
        {
            ExcludeCollectorIds = { excluded },
            PreferredWindowStart = new DateTime(2026, 9, 26, 4, 0, 0, DateTimeKind.Utc),
            PreferredWindowEnd = new DateTime(2026, 9, 26, 10, 0, 0, DateTimeKind.Utc),
            Notes = "customer away on the 25th"
        });

        Assert.Equal("RevisionInProgress", response.Status);
        Assert.Equal(1, response.RevisionCount);

        var call = Assert.Single(_agent.Revisions);
        Assert.Equal(wf.WorkflowId, call.WorkflowId);
        var body = Json(JsonSerializer.Serialize(call.Payload, new JsonSerializerOptions(JsonSerializerDefaults.Web)));

        var feedback = body.GetProperty("feedback");
        Assert.Equal(excluded, feedback.GetProperty("excludeCollectorIds")[0].GetGuid());
        Assert.Equal("customer away on the 25th", feedback.GetProperty("notes").GetString());

        // Enough state for the agent service to carry on even if it was restarted meanwhile.
        var previous = body.GetProperty("previousState");
        Assert.Equal(0, previous.GetProperty("revision_count").GetInt32());      // the run being revised
        Assert.Equal("Household", previous.GetProperty("submission_type").GetString());   // "Generator" is mapped
        Assert.Equal("45 Galle Road, Colombo 03", previous.GetProperty("pickup_address").GetString());
        Assert.Equal(2, previous.GetProperty("items").GetArrayLength());
        // Items have no defined order, so find each by name. A blank image url is sent as null.
        var items = previous.GetProperty("items").EnumerateArray().ToDictionary(i => i.GetProperty("item_name").GetString()!);
        Assert.Equal(JsonValueKind.Null, items["Phone"].GetProperty("image_url").ValueKind);
        Assert.Equal("/uploads/a.jpg", items["Laptop"].GetProperty("image_url").GetString());
        Assert.Contains("Laptop: Old Dell", previous.GetProperty("description").GetString());
        Assert.Equal(42.5, previous.GetProperty("analysis").GetProperty("estimated_volume_kg").GetDouble());
        Assert.Equal("s1", previous.GetProperty("plan").GetProperty("steps")[0].GetProperty("id").GetString());
        Assert.Equal(0, previous.GetProperty("exclude_collector_ids").GetArrayLength());   // earlier exclusions only

        var saved = await ReloadAsync(wf.WorkflowId);
        Assert.Equal(AgentWorkflowStatus.RevisionInProgress, saved.Status);
        Assert.Contains(excluded.ToString(), saved.ExcludedCollectorIds);
    }

    [Fact]
    public async Task Revise_AccumulatesExcludedCollectorsAcrossRevisions()
    {
        var wf = await SeedAsync();
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();
        await _service.ReviseAsync(wf.WorkflowId, StaffId, new ReviseWorkflowRequest { ExcludeCollectorIds = { first } });

        // The agents answered the first revision, so the plan is waiting for staff again.
        var again = await ReloadAsync(wf.WorkflowId);
        again.Status = AgentWorkflowStatus.PendingApproval;
        await _db.SaveChangesAsync();

        await _service.ReviseAsync(wf.WorkflowId, StaffId, new ReviseWorkflowRequest { ExcludeCollectorIds = { second, first } });

        var saved = await ReloadAsync(wf.WorkflowId);
        Assert.Equal(2, saved.RevisionCount);
        var ids = JsonSerializer.Deserialize<List<Guid>>(saved.ExcludedCollectorIds!)!;
        Assert.Equal(new[] { first, second }, ids);

        var secondBody = Json(JsonSerializer.Serialize(_agent.Revisions[1].Payload, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
        var previousExcluded = secondBody.GetProperty("previousState").GetProperty("exclude_collector_ids");
        Assert.Equal(first, previousExcluded[0].GetGuid());
        Assert.Equal(1, secondBody.GetProperty("previousState").GetProperty("revision_count").GetInt32());
    }

    [Fact]
    public async Task Revise_WhenTheAgentRefusesBecauseOfTheRevisionLimit_RestoresTheWorkflow()
    {
        var wf = await SeedAsync();
        _agent.Result = new AgenticAiCallResult(false, 409, "Revision limit of 3 reached.");

        var ex = await Assert.ThrowsAsync<WorkflowConflictException>(() =>
            _service.ReviseAsync(wf.WorkflowId, StaffId, new ReviseWorkflowRequest { ExcludeCollectorIds = { Guid.NewGuid() } }));

        Assert.Contains("Revision limit", ex.Message);
        var saved = await ReloadAsync(wf.WorkflowId);
        Assert.Equal(AgentWorkflowStatus.PendingApproval, saved.Status);
        Assert.Equal(0, saved.RevisionCount);
        Assert.Null(saved.ExcludedCollectorIds);
    }

    [Fact]
    public async Task Revise_WhenTheAgentServiceIsDown_RestoresTheWorkflow()
    {
        var wf = await SeedAsync();
        _agent.Result = new AgenticAiCallResult(false, null, "The agent service could not be reached.");

        await Assert.ThrowsAsync<AgentServiceUnavailableException>(() =>
            _service.ReviseAsync(wf.WorkflowId, StaffId, new ReviseWorkflowRequest { ExcludeCollectorIds = { Guid.NewGuid() } }));

        var saved = await ReloadAsync(wf.WorkflowId);
        Assert.Equal(AgentWorkflowStatus.PendingApproval, saved.Status);
        Assert.Equal(0, saved.RevisionCount);
    }

    [Fact]
    public async Task Revise_WhenNotPendingApproval_IsAConflict_AndTheAgentIsNotCalled()
    {
        var wf = await SeedAsync(AgentWorkflowStatus.RevisionInProgress);

        await Assert.ThrowsAsync<WorkflowConflictException>(() =>
            _service.ReviseAsync(wf.WorkflowId, StaffId, new ReviseWorkflowRequest { ExcludeCollectorIds = { Guid.NewGuid() } }));
        Assert.Empty(_agent.Revisions);
    }

    [Fact]
    public void ReviseRequest_NeedsFeedbackThatChangesThePlan_AndACompleteWindow()
    {
        static List<string> Errors(ReviseWorkflowRequest r)
        {
            var results = new List<System.ComponentModel.DataAnnotations.ValidationResult>();
            System.ComponentModel.DataAnnotations.Validator.TryValidateObject(
                r, new System.ComponentModel.DataAnnotations.ValidationContext(r), results, validateAllProperties: true);
            return results.Select(x => x.ErrorMessage ?? "").ToList();
        }

        Assert.NotEmpty(Errors(new ReviseWorkflowRequest { Notes = "only a note" }));
        Assert.NotEmpty(Errors(new ReviseWorkflowRequest { PreferredWindowStart = DateTime.UtcNow }));
        Assert.NotEmpty(Errors(new ReviseWorkflowRequest
        {
            PreferredWindowStart = DateTime.UtcNow.AddHours(2),
            PreferredWindowEnd = DateTime.UtcNow
        }));
        Assert.Empty(Errors(new ReviseWorkflowRequest { ExcludeCollectorIds = { Guid.NewGuid() } }));
        Assert.Empty(Errors(new ReviseWorkflowRequest
        {
            PreferredWindowStart = DateTime.UtcNow,
            PreferredWindowEnd = DateTime.UtcNow.AddHours(6)
        }));
    }

    // ----------------------------------------------------------------- reads

    [Fact]
    public async Task GetAll_FiltersByStatus_AndDoesNotIncludeSteps()
    {
        await SeedAsync(AgentWorkflowStatus.PendingApproval);
        await SeedAsync(AgentWorkflowStatus.Rejected);

        var pending = await _service.GetAllAsync("pendingapproval");
        Assert.Equal("PendingApproval", Assert.Single(pending).Status);
        Assert.Null(pending[0].Steps);
        Assert.Equal(2, (await _service.GetAllAsync(null)).Count);
        await Assert.ThrowsAsync<ArgumentException>(() => _service.GetAllAsync("nope"));
    }

    [Fact]
    public async Task GetById_ReturnsTheStepsInOrderWithTheirJson()
    {
        var wf = await SeedAsync();
        await _service.RecordStepAsync(wf.WorkflowId, Step("planner", "plan", new DateTime(2026, 9, 21, 6, 3, 0, DateTimeKind.Utc)));
        await _service.RecordStepAsync(wf.WorkflowId, Step("analyzer", "analyze", new DateTime(2026, 9, 21, 6, 0, 0, DateTimeKind.Utc)));

        var detail = await _service.GetByIdAsync(wf.WorkflowId);

        Assert.Equal(new[] { "analyze", "plan" }, detail.Steps!.Select(s => s.StepName));
        Assert.True(detail.Steps![0].Output!.Value.GetProperty("ok").GetBoolean());
        Assert.NotNull(detail.Plan);
        Assert.NotNull(detail.Match);
        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.GetByIdAsync(Guid.NewGuid()));
    }

    // ----------------------------------------------------------------- job service: the preferred collector

    [Fact]
    public async Task JobService_AssignsThePreferredCollector_WhenStillAvailable_AndSkipsGeocoding()
    {
        var (jobService, geo) = await JobServiceWithCollectorAsync(candidates: new[] { Candidate(Guid.NewGuid()), Candidate(CollectorId) });

        var job = await jobService.CreateAndAssignAsync(new CreateJobDto
        {
            SubmissionId = Guid.NewGuid(),
            PickupAddress = "45 Galle Road, Colombo 03",
            PreferredCollectorId = CollectorId,
            PickupLatitude = 6.93m,
            PickupLongitude = 79.85m
        });

        Assert.Equal(CollectorId, job.CollectorId);
        Assert.Equal("Assigned", job.Status);
        Assert.Equal(6.93m, job.PickupLatitude);
        Assert.Equal(0, geo.GeocodeCalls);
    }

    [Fact]
    public async Task JobService_RefusesToAssignSomeoneElse_WhenThePreferredCollectorIsGone()
    {
        var (jobService, _) = await JobServiceWithCollectorAsync(candidates: new[] { Candidate(Guid.NewGuid()) });

        await Assert.ThrowsAsync<PreferredCollectorUnavailableException>(() => jobService.CreateAndAssignAsync(new CreateJobDto
        {
            SubmissionId = Guid.NewGuid(),
            PickupAddress = "45 Galle Road, Colombo 03",
            PreferredCollectorId = CollectorId,
            PickupLatitude = 6.93m,
            PickupLongitude = 79.85m
        }));

        Assert.Empty(await _db.Jobs.ToListAsync());   // no job was created
    }

    [Fact]
    public async Task JobService_WithoutAPreferredCollector_StillPicksTheBestOne_AndGeocodesWhenNoCoordinates()
    {
        var (jobService, geo) = await JobServiceWithCollectorAsync(candidates: new[] { Candidate(CollectorId) });

        var job = await jobService.CreateAndAssignAsync(new CreateJobDto
        {
            SubmissionId = Guid.NewGuid(),
            PickupAddress = "45 Galle Road, Colombo 03"
        });

        Assert.Equal(CollectorId, job.CollectorId);
        Assert.Equal(1, geo.GeocodeCalls);
    }

    private static CollectorMatchDto Candidate(Guid id) => new()
    {
        CollectorId = id, VehicleType = "Van", CapacityKg = 500, Rating = 4.5m, ActiveJobCount = 0, DistanceKm = 3m, EtaMinutes = 12
    };

    private async Task<(JobService, FakeGeoService)> JobServiceWithCollectorAsync(CollectorMatchDto[] candidates)
    {
        // The job history row has a foreign key to the collector, so the collector has to exist.
        var user = new EWasteManagement.API.Features.Auth.Entities.User
        {
            Email = $"{Guid.NewGuid()}@test.com", FullName = "Test Collector", PasswordHash = "x",
            Role = EWasteManagement.API.Features.Auth.Entities.UserRole.Collector
        };
        _db.Users.Add(user);
        _db.Collectors.Add(new Collector { CollectorId = CollectorId, UserId = user.UserId, VehicleType = "Van", CapacityKg = 500 });
        await _db.SaveChangesAsync();

        var geo = new FakeGeoService();
        return (new JobService(_db, geo, new FakeMatchingService(candidates)), geo);
    }

    // ----------------------------------------------------------------- fakes

    private sealed class FakeJobService : IJobService
    {
        public List<CreateJobDto> Created { get; } = new();
        public Exception? Failure { get; set; }

        public Task<JobResponseDto> CreateAndAssignAsync(CreateJobDto dto)
        {
            if (Failure is not null) throw Failure;
            Created.Add(dto);
            return Task.FromResult(new JobResponseDto { JobId = Guid.NewGuid(), SubmissionId = dto.SubmissionId, Status = "Assigned" });
        }

        public Task<JobResponseDto> AcceptAsync(Guid jobId, Guid requestingUserId) => throw new NotImplementedException();
        public Task<JobResponseDto> RejectAsync(Guid jobId, Guid requestingUserId, RejectJobDto dto) => throw new NotImplementedException();
        public Task<JobResponseDto> CompleteAsync(Guid jobId, Guid requestingUserId, CompleteJobDto dto) => throw new NotImplementedException();
        public Task<List<JobResponseDto>> GetMyJobsAsync(Guid requestingUserId, JobStatus? status) => throw new NotImplementedException();
        public Task<JobResponseDto?> GetByIdAsync(Guid jobId, Guid requestingUserId, bool isPrivileged) => throw new NotImplementedException();
        public Task<List<JobResponseDto>> GetAllAsync(JobStatus? status) => throw new NotImplementedException();
    }

    private sealed class FakeAgenticAiClient : IAgenticAiClient
    {
        public List<(Guid WorkflowId, object Payload)> Revisions { get; } = new();
        public AgenticAiCallResult Result { get; set; } = AgenticAiCallResult.Ok();

        public Task<AgenticAiCallResult> StartWorkflowAsync(object payload, CancellationToken ct = default)
            => Task.FromResult(Result);

        public Task<AgenticAiCallResult> ReviseWorkflowAsync(Guid workflowId, object payload, CancellationToken ct = default)
        {
            Revisions.Add((workflowId, payload));
            return Task.FromResult(Result);
        }
    }

    private sealed class FakeMatchingService : IMatchingService
    {
        private readonly CollectorMatchDto[] _candidates;
        public FakeMatchingService(CollectorMatchDto[] candidates) => _candidates = candidates;
        public Task<List<CollectorMatchDto>> FindCandidatesAsync(MatchRequestDto request)
            => Task.FromResult(_candidates.ToList());
    }

    private sealed class FakeGeoService : IGeoService
    {
        public int GeocodeCalls { get; private set; }

        public Task<(decimal Latitude, decimal Longitude)?> GeocodeAsync(string address)
        {
            GeocodeCalls++;
            return Task.FromResult<(decimal Latitude, decimal Longitude)?>((6.9m, 79.8m));
        }

        public Task<(decimal DistanceKm, int DurationMinutes)?> GetDistanceAsync(
            decimal originLat, decimal originLng, decimal destLat, decimal destLng)
            => Task.FromResult<(decimal DistanceKm, int DurationMinutes)?>(null);
    }
}
