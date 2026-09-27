using FluentValidation;

namespace EWasteManagement.API.Shared.Storage;

public class UploadRequestValidator : AbstractValidator<UploadRequestDto>
{
    public const long MaxFileSizeBytes = 5 * 1024 * 1024; // 5 MB

    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp",
    };

    public UploadRequestValidator()
    {
        RuleFor(x => x.File)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("An image file is required.")
            .Must(f => AllowedContentTypes.Contains(f!.ContentType))
            .WithMessage($"Content type must be one of: {string.Join(", ", AllowedContentTypes)}.")
            .Must(f => f!.Length > 0)
            .WithMessage("The file is empty.")
            .Must(f => f!.Length <= MaxFileSizeBytes)
            .WithMessage($"File size must not exceed {MaxFileSizeBytes / (1024 * 1024)} MB.");
    }
}
