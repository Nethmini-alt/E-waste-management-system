using EWasteManagement.Api.Services;
using EWasteManagement.API.Features.Collection.Entities;
using EWasteManagement.API.Features.Workflow.Entities;
using Xunit;

namespace EWasteManagement.Tests.Submissions;

public class SubmissionStatusResolverTests
{
    [Theory]
    [InlineData(JobStatus.Assigned, "CollectorAssigned", "Collector assigned")]
    [InlineData(JobStatus.Accepted, "CollectorAssigned", "Collector assigned")]
    [InlineData(JobStatus.InProgress, "CollectorAssigned", "Collector assigned")]
    [InlineData(JobStatus.NoCollectorAvailable, "AwaitingCollector", "Awaiting collector")]
    [InlineData(JobStatus.PickupLocationUnresolved, "AwaitingCollector", "Awaiting collector")]
    [InlineData(JobStatus.Rejected, "AwaitingCollector", "Awaiting collector")]
    [InlineData(JobStatus.Completed, "Collected", "Collected")]
    [InlineData(JobStatus.Cancelled, "Cancelled", "Cancelled")]
    public void Job_status_wins_once_a_job_exists(JobStatus job, string code, string label)
    {
        // Workflow status is deliberately something that would map differently.
        var result = SubmissionStatusResolver.Resolve(WorkflowStatus.Failed, job);

        Assert.Equal((code, label), result);
    }

    [Theory]
    [InlineData(WorkflowStatus.Planning, "Analyzing")]
    [InlineData(WorkflowStatus.Analyzing, "Analyzing")]
    [InlineData(WorkflowStatus.Validating, "Analyzing")]
    [InlineData(WorkflowStatus.PendingApproval, "AwaitingReview")]
    [InlineData(WorkflowStatus.Matching, "Scheduling")]
    [InlineData(WorkflowStatus.Finalizing, "Scheduling")]
    [InlineData(WorkflowStatus.Completed, "Closed")]
    [InlineData(WorkflowStatus.Rejected, "Rejected")]
    [InlineData(WorkflowStatus.Failed, "Failed")]
    public void Workflow_status_is_used_when_there_is_no_job(WorkflowStatus workflow, string code)
    {
        Assert.Equal(code, SubmissionStatusResolver.Resolve(workflow, null).Code);
    }

    [Fact]
    public void No_workflow_and_no_job_is_not_processed()
    {
        Assert.Equal(("NotProcessed", "Not processed"), SubmissionStatusResolver.Resolve(null, null));
    }

    [Fact]
    public void Every_status_value_is_mapped()
    {
        foreach (var job in Enum.GetValues<JobStatus>())
            SubmissionStatusResolver.Resolve(null, job);
        foreach (var workflow in Enum.GetValues<WorkflowStatus>())
            SubmissionStatusResolver.Resolve(workflow, null);
    }
}
