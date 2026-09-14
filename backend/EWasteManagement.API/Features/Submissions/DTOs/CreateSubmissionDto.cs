namespace EWasteManagement.Api.Dtos
{
    public class CreateSubmissionDto
    {
        public Guid UserId { get; set; }
        public string UserType { get; set; } = "Household";
        public string PickupAddress { get; set; } = string.Empty; // <-- Pickup Address එකතු කර ඇත
        public List<CreateSubmissionItemDto> Items { get; set; } = new();
    }

    public class CreateSubmissionItemDto
    {
        public string ItemName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string ImageUrl { get; set; } = string.Empty;
    }
}