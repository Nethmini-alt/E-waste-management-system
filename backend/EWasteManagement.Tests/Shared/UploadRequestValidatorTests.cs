using EWasteManagement.API.Shared.Storage;
using FluentValidation.TestHelper;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace EWasteManagement.Tests.Shared;

public class UploadRequestValidatorTests
{
    private readonly UploadRequestValidator _validator = new();

    // FormFile.Length is just this constructor argument — it isn't derived
    // from the stream — so a tiny stream is enough even for the "5 MB" cases.
    private static FormFile MakeFile(string contentType, long length, string fileName = "photo.jpg")
    {
        var stream = new MemoryStream(new byte[] { 1 });
        return new FormFile(stream, 0, length, "file", fileName) { Headers = new HeaderDictionary(), ContentType = contentType };
    }

    [Theory]
    [InlineData("image/jpeg")]
    [InlineData("image/png")]
    [InlineData("image/webp")]
    [InlineData("IMAGE/JPEG")] // content type matching is case-insensitive
    public void Allowed_content_type_within_the_size_limit_is_valid(string contentType)
    {
        var request = new UploadRequestDto { File = MakeFile(contentType, 1024) };

        _validator.TestValidate(request).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Missing_file_is_rejected()
    {
        var request = new UploadRequestDto { File = null };

        _validator.TestValidate(request).ShouldHaveValidationErrorFor(x => x.File)
            .WithErrorMessage("An image file is required.");
    }

    [Theory]
    [InlineData("application/pdf")]
    [InlineData("image/gif")]
    [InlineData("text/plain")]
    [InlineData("")]
    public void Disallowed_content_type_is_rejected(string contentType)
    {
        var request = new UploadRequestDto { File = MakeFile(contentType, 1024) };

        _validator.TestValidate(request).ShouldHaveValidationErrorFor(x => x.File)
            .WithErrorMessage("Content type must be one of: image/jpeg, image/png, image/webp.");
    }

    [Fact]
    public void Empty_file_is_rejected()
    {
        var request = new UploadRequestDto { File = MakeFile("image/jpeg", 0) };

        _validator.TestValidate(request).ShouldHaveValidationErrorFor(x => x.File)
            .WithErrorMessage("The file is empty.");
    }

    [Fact]
    public void File_at_exactly_the_5MB_limit_is_valid()
    {
        var request = new UploadRequestDto { File = MakeFile("image/png", UploadRequestValidator.MaxFileSizeBytes) };

        _validator.TestValidate(request).ShouldNotHaveValidationErrorFor(x => x.File);
    }

    [Fact]
    public void File_over_5MB_is_rejected()
    {
        var request = new UploadRequestDto { File = MakeFile("image/png", UploadRequestValidator.MaxFileSizeBytes + 1) };

        _validator.TestValidate(request).ShouldHaveValidationErrorFor(x => x.File)
            .WithErrorMessage("File size must not exceed 5 MB.");
    }
}
