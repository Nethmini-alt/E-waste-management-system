using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace EWasteManagement.API.Infrastructure.Security;

/// <summary>
/// Guards machine-to-machine endpoints called by the agentic-ai service. The caller must send
/// the shared secret (config: Agent:ApiKey) in the X-Agent-Key header. If no key is configured
/// every request is refused, so a missing setting can never open the endpoint.
/// It is an authorization filter on purpose: those run before model binding and validation, so a caller
/// without the key gets a 401 and its body is never even parsed.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class AgentKeyAttribute : Attribute, IAsyncAuthorizationFilter
{
    public const string HeaderName = "X-Agent-Key";

    public Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var expected = context.HttpContext.RequestServices
            .GetRequiredService<IConfiguration>()["Agent:ApiKey"];

        var authorized = !string.IsNullOrWhiteSpace(expected)
            && context.HttpContext.Request.Headers.TryGetValue(HeaderName, out var provided)
            && CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(provided.ToString()),
                Encoding.UTF8.GetBytes(expected));

        if (!authorized)
            context.Result = new UnauthorizedObjectResult(new { message = "Invalid agent API key." });

        return Task.CompletedTask;
    }
}
