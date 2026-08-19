namespace EWasteManagement.Api.Entities
{
    public class SubmissionItem
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid SubmissionId { get; set; }
        public string ItemName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string ImageUrl { get; set; } = string.Empty;
    }
}