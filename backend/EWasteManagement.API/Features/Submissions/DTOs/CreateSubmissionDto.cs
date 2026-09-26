namespace EWasteManagement.Api.Dtos
{
    // UserId and UserType are not accepted from the client — the controller
    // takes them from the caller's JWT (sub claim and role).
    public class CreateSubmissionDto
    {
        public string Category { get; set; } = string.Empty;
        public decimal EstimatedWeight { get; set; }
        public string PickupAddress { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public List<CreateSubmissionItemDto> Items { get; set; } = new();
    }

    public class CreateSubmissionItemDto
    {
        public string ItemName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string ImageUrl { get; set; } = string.Empty;
    }
}
