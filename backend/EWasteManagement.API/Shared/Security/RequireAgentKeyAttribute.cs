using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace EWasteManagement.API.Shared.Security;

// For endpoints that the Python agents call (machine-to-machine, so no user
// JWT). The caller must send the shared secret from "Agent:ApiKey" in the
// X-Agent-Key header, the same key the backend already sends to the agents.
//
// If no key is configured:
//   - Development: the request is allowed and a warning is logged, so
//     teammates can run everything locally without setting up keys.
//   - Any other environment: the request is rejected. An unconfigured key
//     must never mean "open to everyone" in a real deployment.
//
// Usage: keep [AllowAnonymous] (there's no user), add [RequireAgentKey].
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class RequireAgentKeyAttribute : Attribute, IAuthorizationFilter
{
    public const string HeaderName = "X-Agent-Key";

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var services = context.HttpContext.RequestServices;
        var config = services.GetRequiredService<IConfiguration>();
        var env = services.GetRequiredService<IWebHostEnvironment>();
        var logger = services.GetRequiredService<ILogger<RequireAgentKeyAttribute>>();

        var expected = config["Agent:ApiKey"];

        if (string.IsNullOrWhiteSpace(expected))
        {
            if (env.IsDevelopment())
            {
                logger.LogWarning(
                    "Agent:ApiKey is not set, so {Path} accepted a request without an agent key. " +
                    "Set Agent:ApiKey (and AGENT_API_KEY in the agent's .env) to protect this endpoint.",
                    context.HttpContext.Request.Path);
                return;
            }

            context.Result = new ObjectResult(new { message = "Agent endpoints are disabled: no agent key is configured." })
            {
                StatusCode = StatusCodes.Status503ServiceUnavailable
            };
            return;
        }

        var provided = context.HttpContext.Request.Headers[HeaderName].ToString();

        if (!KeysMatch(provided, expected))
        {
            context.Result = new UnauthorizedObjectResult(new { message = "Missing or invalid agent key." });
        }
    }

    // Fixed-time comparison, so response timing doesn't leak how much of a
    // guessed key was right.
    private static bool KeysMatch(string provided, string expected)
    {
        var a = Encoding.UTF8.GetBytes(provided);
        var b = Encoding.UTF8.GetBytes(expected);
        return a.Length == b.Length && CryptographicOperations.FixedTimeEquals(a, b);
    }
}
