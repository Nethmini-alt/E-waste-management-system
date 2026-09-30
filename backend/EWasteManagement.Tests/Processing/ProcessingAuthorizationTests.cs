using System.Reflection;
using EWasteManagement.API.Features.Admin.Controllers;
using EWasteManagement.API.Features.Processing.Controllers;
using Microsoft.AspNetCore.Authorization;
using Xunit;

namespace EWasteManagement.Tests.Processing;

/// <summary>
/// Who may do what in Component C. Management staff carry the "Staff" role, worker staff the
/// "Worker" role. Stacked [Authorize] attributes must ALL pass, so a method-level "Worker" on a
/// "Staff,Admin,Worker" controller means worker only.
/// </summary>
public class ProcessingAuthorizationTests
{
    private static string?[] Roles(MemberInfo member)
        => member.GetCustomAttributes<AuthorizeAttribute>().Select(a => a.Roles).ToArray();

    private static MethodInfo Method<T>(string name) => typeof(T).GetMethod(name)!;

    [Fact]
    public void MarkPaid_IsOpenToAdminAndManagementStaff_NotWorkers()
    {
        Assert.Empty(Roles(Method<CollectorPaymentsController>(nameof(CollectorPaymentsController.MarkPaid))));
        Assert.Equal(new[] { "Staff,Admin" }, Roles(typeof(CollectorPaymentsController)));
    }

    [Fact]
    public void PaymentReads_StayOpenToManagementStaff()
    {
        Assert.Empty(Roles(Method<CollectorPaymentsController>(nameof(CollectorPaymentsController.List))));
    }

    [Fact]
    public void RatePolicyWrites_AreAdminOnly()
    {
        Assert.Equal(new[] { "Admin" }, Roles(typeof(RatePoliciesController)));
        Assert.DoesNotContain(typeof(RatePoliciesController).GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly),
            m => m.GetCustomAttributes<AllowAnonymousAttribute>().Any());
    }

    [Theory]
    [InlineData(nameof(InventoryProcessingController.TransitionStatus))]
    [InlineData(nameof(InventoryProcessingController.AddDismantleLog))]
    [InlineData(nameof(InventoryProcessingController.Classify))]
    [InlineData(nameof(InventoryProcessingController.MoveLocation))]
    [InlineData(nameof(InventoryProcessingController.List))]
    [InlineData(nameof(InventoryProcessingController.GetById))]
    [InlineData(nameof(InventoryProcessingController.GetHistory))]
    public void Inventory_IsOpenToManagementStaffWorkersAndAdmin(string method)
    {
        Assert.Empty(Roles(Method<InventoryProcessingController>(method)));
        Assert.Equal(new[] { "Staff,Admin,Worker" }, Roles(typeof(InventoryProcessingController)));
    }

    [Fact]
    public void Receiving_IsOpenToManagementStaffWorkersAndAdmin()
    {
        Assert.Equal(new[] { "Staff,Admin,Worker" }, Roles(typeof(JobReceiptController)));
        Assert.Equal(new[] { "Staff,Admin,Worker" }, Roles(typeof(ExtraWasteController)));
        Assert.Empty(Roles(Method<ExtraWasteController>(nameof(ExtraWasteController.Receive))));
    }

    [Fact]
    public void StaffManagement_IsAdminOnly()
    {
        Assert.Equal(new[] { "Admin" }, Roles(typeof(StaffController)));
    }
}
