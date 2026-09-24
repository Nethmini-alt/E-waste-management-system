using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;

namespace EWasteManagement.Tests.TestHelpers;

public static class ControllerTestExtensions
{
    // Simulates what the JWT middleware does in the real app: puts the user id
    // in ClaimTypes.NameIdentifier and the role in ClaimTypes.Role, which is
    // what the controllers read via User.FindFirstValue / User.IsInRole.
    public static T WithUser<T>(this T controller, Guid userId, string role) where T : ControllerBase
    {
        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Role, role)
        }, authenticationType: "Test");

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };
        return controller;
    }

    public static int? StatusCodeOf<T>(ActionResult<T> result)
        => (result.Result as IStatusCodeActionResult)?.StatusCode;

    public static TValue ValueOf<TValue>(ActionResult<TValue> result)
    {
        var objectResult = Assert.IsAssignableFrom<ObjectResult>(result.Result);
        return Assert.IsAssignableFrom<TValue>(objectResult.Value);
    }
}
