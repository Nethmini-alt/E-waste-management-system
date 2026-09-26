namespace EWasteManagement.Api.Entities
{
    /// <summary>
    /// Central list of allowed Submission.Status values. Used by the
    /// validators and the controller so "Approved"/"Pending_Approval"/etc.
    /// only ever get typed out in one place.
    /// </summary>
    public static class SubmissionStatuses
    {
        public const string PendingAiAnalysis = "Pending_AI_Analysis";
        public const string PendingApproval = "Pending_Approval";
        public const string Approved = "Approved";
        public const string Rejected = "Rejected";

        public static readonly string[] All =
        {
            PendingAiAnalysis,
            PendingApproval,
            Approved,
            Rejected
        };
    }
}