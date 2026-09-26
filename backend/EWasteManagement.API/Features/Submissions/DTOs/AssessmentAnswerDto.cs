namespace EWasteManagement.Api.Dtos
{
    /// <summary>
    /// One answered question from the mandatory pre-submit AI assessment
    /// (the modal shown in IndividualSubmissionPage / CooperativeSubmissionPage).
    /// A full CreateSubmissionDto carries a List&lt;AssessmentAnswerDto&gt;.
    /// </summary>
    public class AssessmentAnswerDto
    {
        public string Question { get; set; } = string.Empty;

        // Expected to be "Yes" / "No" / "Unsure" — enforced by
        // AssessmentAnswerDtoValidator, not just trusted from the client.
        public string Answer { get; set; } = string.Empty;
    }
}