namespace EWasteManagement.Api.Dtos
{
    // The only accepted values for CreateSubmissionDto.Category. Kept here,
    // not inside the validator, so the frontend's category dropdown can be
    // driven from the same list later instead of a second hardcoded copy.
    public static class SubmissionCategories
    {
        public const string HouseholdElectronics = "Household Electronics";
        public const string ITEquipment = "IT Equipment";
        public const string Batteries = "Batteries";
        public const string HeavyAppliances = "Heavy Appliances";
        public const string Other = "Other";

        public static readonly IReadOnlyList<string> All = new[]
        {
            HouseholdElectronics, ITEquipment, Batteries, HeavyAppliances, Other,
        };
    }
}
