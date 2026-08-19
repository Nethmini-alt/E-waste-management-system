namespace EWasteManagement.Api.Dtos
{
    public class AIAnalysisDto
    {
        public string WasteCategory { get; set; } = string.Empty;
        public decimal EstimatedVolumeKg { get; set; }
        public decimal EstimatedValueUsd { get; set; }
        public string HazardLevel { get; set; } = "Low";
        public bool RequiresHumanApproval { get; set; }
    }
}