namespace EWasteManagement.Api.Entities
{
    public class Submission
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid UserId { get; set; }
        public string UserType { get; set; } = "Household";
        public string Status { get; set; } = "Pending_AI_Analysis";
        public string Category { get; set; } = string.Empty;
        public decimal EstimatedWeight { get; set; }
        public string PickupAddress { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<SubmissionItem> Items { get; set; } = new List<SubmissionItem>();
        public AIAnalysisResult? AIAnalysis { get; set; }
    }
}