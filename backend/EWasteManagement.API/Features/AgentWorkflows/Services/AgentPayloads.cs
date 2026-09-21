using EWasteManagement.Api.Entities;

namespace EWasteManagement.API.Features.AgentWorkflows.Services;

/// <summary>Builds the pieces of the agent service's request bodies that more than one caller needs.</summary>
public static class AgentPayloads
{
    /// <summary>The agent only knows Household and Corporate; the web form sends "Generator".</summary>
    public static string SubmissionType(string? userType)
        => string.Equals(userType, "Corporate", StringComparison.OrdinalIgnoreCase) ? "Corporate" : "Household";

    public static object Item(SubmissionItem i) => new
    {
        itemName = i.ItemName,
        description = i.Description ?? string.Empty,
        imageUrl = string.IsNullOrWhiteSpace(i.ImageUrl) ? null : i.ImageUrl
    };

    /// <summary>The body of POST /workflows for a new submission.</summary>
    public static object StartRequest(Guid workflowId, Submission submission) => new
    {
        workflowId,
        submissionId = submission.Id,
        submissionType = SubmissionType(submission.UserType),
        pickupAddress = submission.PickupAddress,
        items = submission.Items.Select(Item).ToList()
    };
}
