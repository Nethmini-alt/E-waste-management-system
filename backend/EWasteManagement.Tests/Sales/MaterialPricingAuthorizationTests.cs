using System.Reflection;
using EWasteManagement.API.Features.Sales.Controllers;
using Microsoft.AspNetCore.Authorization;
using Xunit;

namespace EWasteManagement.Tests.Sales;

/// <summary>
/// Management staff can read the price list; only an admin may add, edit, approve, expire or delete
/// a price. Stacked [Authorize] attributes must ALL pass, so "Admin" on a method of a
/// "Staff,Admin" controller means admin only.
/// </summary>
public class MaterialPricingAuthorizationTests
{
    private static string?[] Roles(MemberInfo member)
        => member.GetCustomAttributes<AuthorizeAttribute>().Select(a => a.Roles).ToArray();

    private static MethodInfo Method(string name) => typeof(MaterialPricingController).GetMethod(name)!;

    [Fact]
    public void Controller_IsOpenToManagementStaffAndAdmin()
        => Assert.Equal(new[] { "Staff,Admin" }, Roles(typeof(MaterialPricingController)));

    [Theory]
    [InlineData(nameof(MaterialPricingController.GetAll))]
    [InlineData(nameof(MaterialPricingController.GetById))]
    public void Reads_StayOpenToManagementStaff(string method)
        => Assert.Empty(Roles(Method(method)));

    [Theory]
    [InlineData(nameof(MaterialPricingController.Create))]
    [InlineData(nameof(MaterialPricingController.Update))]
    [InlineData(nameof(MaterialPricingController.Delete))]
    [InlineData(nameof(MaterialPricingController.ExpireStale))]
    public void Writes_AreAdminOnly(string method)
        => Assert.Equal(new[] { "Admin" }, Roles(Method(method)));
}
