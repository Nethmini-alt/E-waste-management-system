using System.Reflection;
using EWasteManagement.API.Features.Processing.Controllers;
using Microsoft.AspNetCore.Authorization;
using Xunit;

namespace EWasteManagement.Tests.Processing;

/// <summary>
/// Money decisions are Admin-only: warehouse Staff can process items and view payments and rates,
/// but cannot pay collectors or change rates. These pin the attributes that enforce that.
/// </summary>
public class ProcessingAuthorizationTests
{
    private static string?[] Roles(MemberInfo member)
        => member.GetCustomAttributes<AuthorizeAttribute>().Select(a => a.Roles).ToArray();

    [Fact]
    public void MarkPaid_RequiresAdmin_OnTopOfTheControllersStaffOrAdminRule()
    {
        var method = typeof(CollectorPaymentsController).GetMethod(nameof(CollectorPaymentsController.MarkPaid))!;

        Assert.Contains("Admin", Roles(method));
        Assert.Contains("Staff,Admin", Roles(typeof(CollectorPaymentsController)));
    }

    [Fact]
    public void PaymentReads_StayOpenToStaff()
    {
        var list = typeof(CollectorPaymentsController).GetMethod(nameof(CollectorPaymentsController.List))!;

        Assert.Empty(Roles(list));
    }

    [Fact]
    public void RatePolicyWrites_AreAdminOnly()
    {
        Assert.Equal(new[] { "Admin" }, Roles(typeof(RatePoliciesController)));
        Assert.DoesNotContain(typeof(RatePoliciesController).GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly),
            m => m.GetCustomAttributes<AllowAnonymousAttribute>().Any());
    }
}
