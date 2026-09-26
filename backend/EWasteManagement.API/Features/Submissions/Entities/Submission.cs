namespace EWasteManagement.Api.Entities
{
    public class Submission
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid UserId { get; set; }
        public string UserType { get; set; } = "Household";

        // Deprecated: no longer read or written. The user-facing status is
        // derived from the workflow/job (SubmissionStatusResolver). Column is
        // dropped in the Phase 7 migration.
        public string Status { get; set; } = "Pending_AI_Analysis";
        public string Category { get; set; } = string.Empty;
        public decimal EstimatedWeight { get; set; }
        public string PickupAddress { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<SubmissionItem> Items { get; set; } = new List<SubmissionItem>();
        // Deprecated: analysis now lives in CollectionWorkflow.AnalyzerResultJson.
        // Table is dropped in the Phase 7 migration.
        public AIAnalysisResult? AIAnalysis { get; set; }
    }
}