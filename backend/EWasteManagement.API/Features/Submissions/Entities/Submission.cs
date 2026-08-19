namespace EWasteManagement.Api.Entities
{
    public class Submission
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid UserId { get; set; }
        public string UserType { get; set; } = "Household";
        public string Status { get; set; } = "Pending_AI_Analysis";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public List<SubmissionItem> Items { get; set; } = new();
        public AIAnalysisResult? AIAnalysis { get; set; }
    }
}