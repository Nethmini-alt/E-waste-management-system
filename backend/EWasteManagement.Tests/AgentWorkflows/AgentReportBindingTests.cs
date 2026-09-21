using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using EWasteManagement.API.Features.AgentWorkflows.DTOs;
using Xunit;

namespace EWasteManagement.Tests.AgentWorkflows;

/// <summary>
/// The JSON below was produced by the real Python models (StepRecord.model_dump and build_result), so these
/// tests fail if the agent service and this API ever disagree about a field name or shape.
/// ASP.NET binds request bodies with the Web defaults, which is what is used here.
/// </summary>
public class AgentReportBindingTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    private const string StepJson = """
        {"workflow_id": "7c1f3b2a-5d4e-4f60-9a1b-2c3d4e5f6a7b", "agent": "matcher", "step_name": "match_collectors",
         "status": "succeeded", "started_at": "2026-09-21T06:00:00.123456Z", "duration_ms": 1840,
         "input_summary": {"address_redacted": true}, "output": {"status": "matched"},
         "checks": [{"code": "capacity", "passed": true, "message": "ok"}],
         "tool_calls": [{"tool": "find_collectors", "agent": "matcher", "ok": true, "attempts": 1, "status_code": 200,
                         "duration_ms": 35, "input_summary": {}, "error": null}],
         "retries": 0, "error": null}
        """;

    private const string ResultJson = """
        {"workflow_id": "7c1f3b2a-5d4e-4f60-9a1b-2c3d4e5f6a7b", "submission_id": "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
         "outcome": "PendingApproval", "failure_reason": null, "revision_count": 0, "plan": {"steps": []},
         "analysis": {"estimated_volume_kg": 42.5}, "validation": null, "match": {"pickup_latitude": 6.9},
         "proposal": {"recommended_collector_id": null, "pickup_window_start": "2026-09-25T04:00:00Z"},
         "errors": [], "step_count": 0}
        """;

    private static List<ValidationResult> Validate(object model)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(model, new ValidationContext(model), results, validateAllProperties: true);
        return results;
    }

    [Fact]
    public void AStepFromTheAgentService_BindsAndValidates()
    {
        var step = JsonSerializer.Deserialize<AgentStepReport>(StepJson, Web)!;

        Assert.Empty(Validate(step));
        Assert.Equal(Guid.Parse("7c1f3b2a-5d4e-4f60-9a1b-2c3d4e5f6a7b"), step.WorkflowId);
        Assert.Equal("matcher", step.Agent);
        Assert.Equal("match_collectors", step.StepName);
        Assert.Equal("succeeded", step.Status);
        Assert.Equal(DateTimeKind.Utc, step.StartedAt.Kind);
        Assert.Equal(new DateTime(2026, 9, 21, 6, 0, 0, DateTimeKind.Utc).AddTicks(1234560), step.StartedAt);
        Assert.Equal(1840, step.DurationMs);
        Assert.True(step.InputSummary!.Value.GetProperty("address_redacted").GetBoolean());
        Assert.Equal("matched", step.Output!.Value.GetProperty("status").GetString());
        Assert.Equal("capacity", step.Checks!.Value[0].GetProperty("code").GetString());
        Assert.Equal("find_collectors", step.ToolCalls!.Value[0].GetProperty("tool").GetString());
        Assert.Null(step.Error);
    }

    [Fact]
    public void AResultFromTheAgentService_BindsAndValidates_IgnoringFieldsItDoesNotStore()
    {
        var result = JsonSerializer.Deserialize<AgentResultReport>(ResultJson, Web)!;

        Assert.Empty(Validate(result));
        Assert.Equal("PendingApproval", result.Outcome);
        Assert.Equal(Guid.Parse("0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"), result.SubmissionId);
        Assert.Equal(0, result.RevisionCount);
        Assert.Null(result.FailureReason);
        Assert.Null(result.Validation);   // JSON null binds to "not reported", not to a JSON value
        Assert.Equal(JsonValueKind.Object, result.Plan!.Value.ValueKind);
        Assert.Equal(42.5, result.Analysis!.Value.GetProperty("estimated_volume_kg").GetDouble());
        Assert.Equal(JsonValueKind.Null, result.Proposal!.Value.GetProperty("recommended_collector_id").ValueKind);
    }

    [Fact]
    public void AStepWithoutAnAgentOrName_FailsValidation()
    {
        var step = JsonSerializer.Deserialize<AgentStepReport>("""{"status":"succeeded","duration_ms":1}""", Web)!;

        Assert.NotEmpty(Validate(step));
    }
}
