using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;
using EWasteManagement.Api.Dtos;

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

        // Backing column for the mandatory pre-submit AI assessment answers
        // (see AIAssessmentModal.tsx). This is the actual mapped/stored
        // column — a plain string so no DbContext/OnModelCreating changes
        // are needed. Requires a migration:
        //   dotnet ef migrations add AddAssessmentAnswersToSubmission
        //   dotnet ef database update
        public string AssessmentAnswersJson { get; set; } = "[]";

        // Convenience property so the rest of the codebase (SubmissionService,
        // the controller's JSON response, etc.) can just read/write a
        // List<AssessmentAnswerDto> instead of dealing with JSON directly.
        // [NotMapped] means EF Core ignores this one and only persists
        // AssessmentAnswersJson above.
        [NotMapped]
        public List<AssessmentAnswerDto> AssessmentAnswers
        {
            get => string.IsNullOrWhiteSpace(AssessmentAnswersJson)
                ? new List<AssessmentAnswerDto>()
                : JsonSerializer.Deserialize<List<AssessmentAnswerDto>>(AssessmentAnswersJson) ?? new List<AssessmentAnswerDto>();
            set => AssessmentAnswersJson = JsonSerializer.Serialize(value);
        }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<SubmissionItem> Items { get; set; } = new List<SubmissionItem>();
        public AIAnalysisResult? AIAnalysis { get; set; }
    }
}