using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Entities;
using Xunit;

namespace EWasteManagement.Tests.Processing;

public class InventoryProcessingRequestValidatorTests
{
    [Fact]
    public void TransitionStatus_UndefinedEnumValue_IsInvalid()
    {
        var result = new TransitionInventoryStatusRequestValidator()
            .Validate(new TransitionInventoryStatusRequest { NextStatus = (InventoryStatus)99 });

        Assert.False(result.IsValid);
    }

    [Fact]
    public void TransitionStatus_DefinedEnumValue_IsValid()
    {
        var result = new TransitionInventoryStatusRequestValidator()
            .Validate(new TransitionInventoryStatusRequest { NextStatus = InventoryStatus.Sorting, Notes = "ok" });

        Assert.True(result.IsValid);
    }

    [Fact]
    public void DismantleLog_ValidRequest_IsValid()
    {
        var request = new AddDismantleLogRequest
        {
            Description = "Removed casing",
            RemainingWeightKg = 8m,
            ChildItems = { new CreateChildInventoryItemRequest { ItemType = "Copper Wiring", WeightKg = 1.5m } }
        };

        Assert.True(new AddDismantleLogRequestValidator().Validate(request).IsValid);
    }

    [Fact]
    public void DismantleLog_EmptyDescription_IsInvalid()
    {
        var result = new AddDismantleLogRequestValidator().Validate(new AddDismantleLogRequest { Description = "" });

        Assert.False(result.IsValid);
    }

    [Fact]
    public void DismantleLog_NegativeRemainingWeight_IsInvalid()
    {
        var result = new AddDismantleLogRequestValidator()
            .Validate(new AddDismantleLogRequest { Description = "x", RemainingWeightKg = -5m });

        Assert.False(result.IsValid);
    }

    [Fact]
    public void DismantleLog_ZeroRemainingWeight_IsValid()
    {
        var result = new AddDismantleLogRequestValidator()
            .Validate(new AddDismantleLogRequest { Description = "Fully dismantled", RemainingWeightKg = 0m });

        Assert.True(result.IsValid);
    }

    [Fact]
    public void DismantleLog_ChildWithZeroWeightOrNoType_IsInvalid()
    {
        var zeroWeight = new AddDismantleLogRequest
        {
            Description = "x",
            ChildItems = { new CreateChildInventoryItemRequest { ItemType = "Battery", WeightKg = 0m } }
        };
        var noType = new AddDismantleLogRequest
        {
            Description = "x",
            ChildItems = { new CreateChildInventoryItemRequest { ItemType = "", WeightKg = 1m } }
        };

        var validator = new AddDismantleLogRequestValidator();
        Assert.False(validator.Validate(zeroWeight).IsValid);
        Assert.False(validator.Validate(noType).IsValid);
    }

    [Theory]
    [InlineData(-0.1)]
    [InlineData(1.1)]
    [InlineData(5.0)]
    public void Classify_ConfidenceOutsideZeroToOne_IsInvalid(double confidence)
    {
        var result = new ClassifyInventoryItemRequestValidator().Validate(new ClassifyInventoryItemRequest
        {
            Category = ClassificationCategory.LocalRecyclable,
            ConfidenceScore = (decimal)confidence
        });

        Assert.False(result.IsValid);
    }

    [Theory]
    [InlineData(0.0)]
    [InlineData(0.92)]
    [InlineData(1.0)]
    public void Classify_ConfidenceWithinZeroToOne_IsValid(double confidence)
    {
        var result = new ClassifyInventoryItemRequestValidator().Validate(new ClassifyInventoryItemRequest
        {
            Category = ClassificationCategory.LocalRecyclable,
            ConfidenceScore = (decimal)confidence
        });

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Classify_UndefinedCategoryOrSource_IsInvalid()
    {
        var validator = new ClassifyInventoryItemRequestValidator();

        Assert.False(validator.Validate(new ClassifyInventoryItemRequest { Category = (ClassificationCategory)99 }).IsValid);
        Assert.False(validator.Validate(new ClassifyInventoryItemRequest { Category = ClassificationCategory.Reusable, Source = (ClassificationSource)99 }).IsValid);
    }

    [Fact]
    public void Classify_SubCategoryOver100Chars_IsInvalid()
    {
        var result = new ClassifyInventoryItemRequestValidator().Validate(new ClassifyInventoryItemRequest
        {
            Category = ClassificationCategory.Reusable,
            SubCategory = new string('a', 101)
        });

        Assert.False(result.IsValid);
    }

    [Fact]
    public void MoveLocation_EmptyGuid_IsInvalid()
    {
        var result = new MoveInventoryLocationRequestValidator()
            .Validate(new MoveInventoryLocationRequest { NewLocationId = Guid.Empty });

        Assert.False(result.IsValid);
    }

    [Fact]
    public void ValidateClassification_UndefinedCategory_IsInvalid()
    {
        var result = new ValidateClassificationRequestValidator()
            .Validate(new ValidateClassificationRequest { ProposedCategory = (ClassificationCategory)99, ConfidenceScore = 0.9m });

        Assert.False(result.IsValid);
    }

    [Fact]
    public void ValidateClassification_ConfidenceOutOfRange_IsInvalid()
    {
        var result = new ValidateClassificationRequestValidator()
            .Validate(new ValidateClassificationRequest { ProposedCategory = ClassificationCategory.Reusable, ConfidenceScore = 1.5m });

        Assert.False(result.IsValid);
    }

    [Fact]
    public void ValidateClassification_LongSubCategory_StaysValidSoTheServiceCanAnswerInItsOwnContract()
    {
        var result = new ValidateClassificationRequestValidator().Validate(new ValidateClassificationRequest
        {
            ProposedCategory = ClassificationCategory.Reusable,
            ProposedSubCategory = new string('a', 101),
            ConfidenceScore = 0.9m
        });

        Assert.True(result.IsValid);
    }

    [Fact]
    public void InventoryListQuery_Defaults_AreValid()
    {
        Assert.True(new InventoryListQueryValidator().Validate(new InventoryListQuery()).IsValid);
    }

    [Theory]
    [InlineData(0, 20)]
    [InlineData(-1, 20)]
    [InlineData(1, 0)]
    [InlineData(1, 101)]
    public void InventoryListQuery_BadPaging_IsInvalid(int page, int pageSize)
    {
        var result = new InventoryListQueryValidator().Validate(new InventoryListQuery { Page = page, PageSize = pageSize });

        Assert.False(result.IsValid);
    }

    [Fact]
    public void InventoryListQuery_UndefinedEnumsOrLongSearch_AreInvalid()
    {
        var validator = new InventoryListQueryValidator();

        Assert.False(validator.Validate(new InventoryListQuery { Status = (InventoryStatus)99 }).IsValid);
        Assert.False(validator.Validate(new InventoryListQuery { Category = (ClassificationCategory)99 }).IsValid);
        Assert.False(validator.Validate(new InventoryListQuery { OriginType = (OriginType)99 }).IsValid);
        Assert.False(validator.Validate(new InventoryListQuery { SortBy = (InventorySortField)99 }).IsValid);
        Assert.False(validator.Validate(new InventoryListQuery { Search = new string('a', 101) }).IsValid);
    }

    [Fact]
    public void PendingPaymentsQuery_DefaultsValid_BadPagingOrSourceTypeInvalid()
    {
        var validator = new PendingPaymentsQueryValidator();

        Assert.True(validator.Validate(new PendingPaymentsQuery()).IsValid);
        Assert.False(validator.Validate(new PendingPaymentsQuery { PageSize = 101 }).IsValid);
        Assert.False(validator.Validate(new PendingPaymentsQuery { Page = 0 }).IsValid);
        Assert.False(validator.Validate(new PendingPaymentsQuery { SourceType = (PaymentSourceType)99 }).IsValid);
    }

    [Fact]
    public void ExtraWasteReceipt_OverlongNotesKeyOrRejectionReason_IsInvalid()
    {
        var validator = new ReceiveExtraWasteRequestValidator();
        var baseItem = new ReceiveExtraWasteItemRequest { ItemType = "Laptop", WeightKg = 1m, Accepted = true };

        Assert.False(validator.Validate(new ReceiveExtraWasteRequest
        {
            CollectorId = Guid.NewGuid(), WarehouseLocationId = Guid.NewGuid(),
            Notes = new string('n', 1001), Items = { baseItem }
        }).IsValid);

        Assert.False(validator.Validate(new ReceiveExtraWasteRequest
        {
            CollectorId = Guid.NewGuid(), WarehouseLocationId = Guid.NewGuid(),
            IdempotencyKey = new string('k', 101), Items = { baseItem }
        }).IsValid);

        Assert.False(validator.Validate(new ReceiveExtraWasteRequest
        {
            CollectorId = Guid.NewGuid(), WarehouseLocationId = Guid.NewGuid(),
            Items = { new ReceiveExtraWasteItemRequest { ItemType = "Laptop", WeightKg = 1m, Accepted = false, RejectionReason = new string('r', 501) } }
        }).IsValid);
    }
}
