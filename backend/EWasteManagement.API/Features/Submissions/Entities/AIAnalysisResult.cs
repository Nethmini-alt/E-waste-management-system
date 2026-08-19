namespace EWasteManagement.Api.Entities
{
    public class AIAnalysisResult
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid SubmissionId { get; set; }
        public string WasteCategory { get; set; } = string.Empty;
        public decimal EstimatedVolumeKg { get; set; }
        public decimal EstimatedValueUsd { get; set; }
        public string HazardLevel { get; set; } = "Low";
        public bool RequiresHumanApproval { get; set; }
        public DateTime AnalyzedAt { get; set; } = DateTime.UtcNow;
    }
}