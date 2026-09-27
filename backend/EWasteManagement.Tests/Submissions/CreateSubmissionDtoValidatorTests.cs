using EWasteManagement.Api.Dtos;
using EWasteManagement.Api.Validators;
using FluentValidation.TestHelper;
using Xunit;

namespace EWasteManagement.Tests.Submissions;

/// <summary>
/// One valid and at least one invalid case per rule. Each test starts from a
/// fully valid DTO and changes only the field under test.
/// </summary>
public class CreateSubmissionDtoValidatorTests
{
    private readonly CreateSubmissionDtoValidator _validator = new();

    private static CreateSubmissionDto Valid() => new()
    {
        Category = SubmissionCategories.ITEquipment,
        EstimatedWeight = 2.5m,
        PickupAddress = "123 Galle Road, Colombo 03",
        PhoneNumber = "0771234567",
        Items = new()
        {
            new CreateSubmissionItemDto { ItemName = "Laptop", Description = "Old laptop", ImageUrl = "https://example.com/a.jpg" },
        },
    };

    [Fact]
    public void A_fully_valid_submission_passes()
    {
        _validator.TestValidate(Valid()).ShouldNotHaveAnyValidationErrors();
    }

    // ---------- PickupAddress ----------

    [Fact]
    public void Address_at_the_300_character_limit_is_valid()
    {
        var dto = Valid();
        dto.PickupAddress = new string('a', 300);
        _validator.TestValidate(dto).ShouldNotHaveValidationErrorFor(x => x.PickupAddress);
    }

    [Theory]
    [InlineData("", "Pickup address is required.")]
    [InlineData("   ", "Pickup address is required.")]
    public void Missing_address_is_rejected(string address, string message)
    {
        var dto = Valid();
        dto.PickupAddress = address;
        _validator.TestValidate(dto).ShouldHaveValidationErrorFor(x => x.PickupAddress).WithErrorMessage(message);
    }

    [Fact]
    public void Address_over_300_characters_is_rejected()
    {
        var dto = Valid();
        dto.PickupAddress = new string('a', 301);
        _validator.TestValidate(dto).ShouldHaveValidationErrorFor(x => x.PickupAddress)
            .WithErrorMessage("Pickup address must be 300 characters or fewer.");
    }

    // ---------- PhoneNumber ----------

    [Theory]
    [InlineData("0771234567")]
    [InlineData("+94771234567")]
    public void Sri_Lankan_mobile_formats_are_valid(string phone)
    {
        var dto = Valid();
        dto.PhoneNumber = phone;
        _validator.TestValidate(dto).ShouldNotHaveValidationErrorFor(x => x.PhoneNumber);
    }

    [Fact]
    public void Missing_phone_is_rejected_with_only_the_required_message()
    {
        var dto = Valid();
        dto.PhoneNumber = "";
        var result = _validator.TestValidate(dto);
        result.ShouldHaveValidationErrorFor(x => x.PhoneNumber).WithErrorMessage("Phone number is required.");
        Assert.Single(result.Errors, e => e.PropertyName == nameof(CreateSubmissionDto.PhoneNumber));
    }

    [Theory]
    [InlineData("077123456")]       // too short
    [InlineData("07712345678")]     // too long
    [InlineData("0112345678")]      // landline prefix, not 07
    [InlineData("+94112345678")]    // +94 but not a 7 mobile prefix
    [InlineData("771234567")]       // missing leading 0
    [InlineData("077 123 4567")]    // spaces
    [InlineData("077-1234567")]     // dash
    public void Other_phone_formats_are_rejected(string phone)
    {
        var dto = Valid();
        dto.PhoneNumber = phone;
        _validator.TestValidate(dto).ShouldHaveValidationErrorFor(x => x.PhoneNumber)
            .WithErrorMessage("Phone number must be a Sri Lankan number in the format 07XXXXXXXX or +947XXXXXXXX.");
    }

    // ---------- Category ----------

    [Theory]
    [MemberData(nameof(AllCategories))]
    public void Every_listed_category_is_valid(string category)
    {
        var dto = Valid();
        dto.Category = category;
        _validator.TestValidate(dto).ShouldNotHaveValidationErrorFor(x => x.Category);
    }

    public static IEnumerable<object[]> AllCategories() => SubmissionCategories.All.Select(c => new object[] { c });

    [Theory]
    [InlineData("")]
    [InlineData("Phones")]
    [InlineData("it equipment")]   // matching is exact, so the stored values stay consistent
    public void Unlisted_category_is_rejected(string category)
    {
        var dto = Valid();
        dto.Category = category;
        _validator.TestValidate(dto).ShouldHaveValidationErrorFor(x => x.Category)
            .WithErrorMessage("Category must be one of: Household Electronics, IT Equipment, Batteries, Heavy Appliances, Other.");
    }

    // ---------- EstimatedWeight ----------

    [Theory]
    [InlineData(0.1)]
    [InlineData(1000)]
    public void Weight_above_zero_up_to_1000_kg_is_valid(decimal weight)
    {
        var dto = Valid();
        dto.EstimatedWeight = weight;
        _validator.TestValidate(dto).ShouldNotHaveValidationErrorFor(x => x.EstimatedWeight);
    }

    [Theory]
    [InlineData(0, "Estimated weight must be greater than 0 kg.")]
    [InlineData(-5, "Estimated weight must be greater than 0 kg.")]
    [InlineData(1000.01, "Estimated weight must be at most 1000 kg.")]
    public void Weight_out_of_range_is_rejected(decimal weight, string message)
    {
        var dto = Valid();
        dto.EstimatedWeight = weight;
        _validator.TestValidate(dto).ShouldHaveValidationErrorFor(x => x.EstimatedWeight).WithErrorMessage(message);
    }

    // ---------- Items count ----------

    [Theory]
    [InlineData(1)]
    [InlineData(10)]
    public void One_to_ten_items_is_valid(int count)
    {
        var dto = Valid();
        dto.Items = Items(count);
        _validator.TestValidate(dto).ShouldNotHaveValidationErrorFor(x => x.Items);
    }

    [Fact]
    public void No_items_is_rejected()
    {
        var dto = Valid();
        dto.Items = new();
        _validator.TestValidate(dto).ShouldHaveValidationErrorFor(x => x.Items)
            .WithErrorMessage("At least one item is required.");
    }

    [Fact]
    public void Null_items_is_rejected()
    {
        var dto = Valid();
        dto.Items = null!;
        _validator.TestValidate(dto).ShouldHaveValidationErrorFor(x => x.Items)
            .WithErrorMessage("At least one item is required.");
    }

    [Fact]
    public void More_than_ten_items_is_rejected()
    {
        var dto = Valid();
        dto.Items = Items(11);
        _validator.TestValidate(dto).ShouldHaveValidationErrorFor(x => x.Items)
            .WithErrorMessage("A submission can have at most 10 items.");
    }

    // ---------- Item fields ----------

    [Theory]
    [InlineData("", "Old laptop", "Items[0].ItemName", "Item name is required.")]
    [InlineData("  ", "Old laptop", "Items[0].ItemName", "Item name is required.")]
    [InlineData("Laptop", "", "Items[0].Description", "Item description is required.")]
    [InlineData("Laptop", "  ", "Items[0].Description", "Item description is required.")]
    public void Item_without_name_or_description_is_rejected(string name, string description, string field, string message)
    {
        var dto = Valid();
        dto.Items[0].ItemName = name;
        dto.Items[0].Description = description;
        _validator.TestValidate(dto).ShouldHaveValidationErrorFor(field).WithErrorMessage(message);
    }

    [Fact]
    public void Errors_point_at_the_offending_item()
    {
        var dto = Valid();
        dto.Items = Items(3);
        dto.Items[2].ItemName = "";

        var result = _validator.TestValidate(dto);

        result.ShouldHaveValidationErrorFor("Items[2].ItemName");
        result.ShouldNotHaveValidationErrorFor("Items[0].ItemName");
        result.ShouldNotHaveValidationErrorFor("Items[1].ItemName");
    }

    // ---------- Item ImageUrl ----------

    [Theory]
    [InlineData("https://example.com/a.jpg")]
    [InlineData("http://example.com/a.jpg")]
    [InlineData("")]      // optional
    [InlineData("   ")]   // treated as not provided
    public void Image_url_that_is_http_https_or_absent_is_valid(string url)
    {
        var dto = Valid();
        dto.Items[0].ImageUrl = url;
        _validator.TestValidate(dto).ShouldNotHaveValidationErrorFor("Items[0].ImageUrl");
    }

    [Theory]
    [InlineData("example.com/a.jpg")]          // not absolute
    [InlineData("/uploads/a.jpg")]             // relative
    [InlineData("ftp://example.com/a.jpg")]    // wrong scheme
    [InlineData("file:///etc/passwd")]         // wrong scheme
    [InlineData("javascript:alert(1)")]        // wrong scheme
    [InlineData("not a url")]
    public void Image_url_that_is_not_absolute_http_or_https_is_rejected(string url)
    {
        var dto = Valid();
        dto.Items[0].ImageUrl = url;
        _validator.TestValidate(dto).ShouldHaveValidationErrorFor("Items[0].ImageUrl")
            .WithErrorMessage("Image URL must be an absolute http or https URL.");
    }

    private static List<CreateSubmissionItemDto> Items(int count) =>
        Enumerable.Range(1, count)
            .Select(i => new CreateSubmissionItemDto { ItemName = $"Item {i}", Description = "desc", ImageUrl = "" })
            .ToList();
}
