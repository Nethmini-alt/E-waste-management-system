using EWasteManagement.API.Features.Collection.Entities;
using EWasteManagement.API.Features.Workflow.Entities;

namespace EWasteManagement.Api.Services
{
    /// <summary>
    /// Derives the user-facing submission status. Once a Job exists it is the
    /// source of truth; before that, the CollectionWorkflow is.
    /// </summary>
    public static class SubmissionStatusResolver
    {
        public static (string Code, string Label) Resolve(WorkflowStatus? workflowStatus, JobStatus? jobStatus)
        {
            if (jobStatus is JobStatus job)
            {
                return job switch
                {
                    JobStatus.Assigned or JobStatus.Accepted or JobStatus.InProgress
                        => ("CollectorAssigned", "Collector assigned"),
                    // Rejected is transient: JobService.RejectAsync immediately
                    // re-matches the job to Assigned or NoCollectorAvailable.
                    JobStatus.NoCollectorAvailable or JobStatus.PickupLocationUnresolved or JobStatus.Rejected
                        => ("AwaitingCollector", "Awaiting collector"),
                    JobStatus.Completed => ("Collected", "Collected"),
                    JobStatus.Cancelled => ("Cancelled", "Cancelled"),
                    _ => throw new InvalidOperationException($"Unhandled job status: {job}")
                };
            }

            return workflowStatus switch
            {
                // Submissions created before the orchestrated workflow existed.
                null => ("NotProcessed", "Not processed"),
                WorkflowStatus.Planning or WorkflowStatus.Analyzing or WorkflowStatus.Validating
                    => ("Analyzing", "Analyzing"),
                WorkflowStatus.PendingApproval => ("AwaitingReview", "Awaiting review"),
                WorkflowStatus.Matching or WorkflowStatus.Finalizing => ("Scheduling", "Scheduling"),
                // Completed with no job: the chain finished without creating one.
                WorkflowStatus.Completed => ("Closed", "Closed"),
                WorkflowStatus.Rejected => ("Rejected", "Rejected"),
                WorkflowStatus.Failed => ("Failed", "Failed"),
                _ => throw new InvalidOperationException($"Unhandled workflow status: {workflowStatus}")
            };
        }
    }
}
