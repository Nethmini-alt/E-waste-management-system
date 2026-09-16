using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Features.Processing.Events;
using EWasteManagement.API.Shared.Common;
using Xunit;

namespace EWasteManagement.Tests.Processing;

public class InventoryItemTests
{
    private static InventoryItem CreateReceivedItem() => new()
    {
        OriginType = OriginType.ExtraWaste,
        ItemType = "Laptop",
        VerifiedWeightKg = 4.7m,
        CurrentLocationId = Guid.NewGuid()
    };

    [Fact]
    public void TransitionTo_AllowedNextStatus_UpdatesStatus()
    {
        var item = CreateReceivedItem();

        item.TransitionTo(InventoryStatus.Sorting, Guid.NewGuid());

        Assert.Equal(InventoryStatus.Sorting, item.Status);
    }

    [Fact]
    public void TransitionTo_AllowedNextStatus_RaisesInventoryStatusChangedEvent()
    {
        var item = CreateReceivedItem();
        var staffId = Guid.NewGuid();

        item.TransitionTo(InventoryStatus.Sorting, staffId, "moved after weighing");

        var evt = Assert.IsType<InventoryStatusChangedEvent>(Assert.Single(item.DomainEvents));
        Assert.Equal(item.Id, evt.InventoryItemId);
        Assert.Equal(InventoryStatus.Received, evt.PreviousStatus);
        Assert.Equal(InventoryStatus.Sorting, evt.NewStatus);
        Assert.Equal(staffId, evt.StaffId);
        Assert.Equal("moved after weighing", evt.Notes);
    }

    [Fact]
    public void TransitionTo_IllegalJump_ThrowsAndLeavesStatusUnchanged()
    {
        var item = CreateReceivedItem(); // status = Received

        Assert.Throws<InvalidStatusTransitionException>(
            () => item.TransitionTo(InventoryStatus.Classified, Guid.NewGuid()));

        Assert.Equal(InventoryStatus.Received, item.Status);
    }

    [Fact]
    public void TransitionTo_FromTerminalState_AlwaysThrows()
    {
        var item = CreateReceivedItem();
        item.TransitionTo(InventoryStatus.Sorting, Guid.NewGuid());
        item.TransitionTo(InventoryStatus.Classified, Guid.NewGuid());
        item.TransitionTo(InventoryStatus.ReadyForSale, Guid.NewGuid());

        Assert.Throws<InvalidStatusTransitionException>(
            () => item.TransitionTo(InventoryStatus.OnHold, Guid.NewGuid()));
    }
}