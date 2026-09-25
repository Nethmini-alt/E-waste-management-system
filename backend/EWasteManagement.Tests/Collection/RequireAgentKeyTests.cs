using EWasteManagement.API.Shared.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace EWasteManagement.Tests.Collection;

public class RequireAgentKeyTests
{
    private const string Key = "test-agent-key-123";

    private sealed class FakeEnvironment : IWebHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "Tests";
        public string WebRootPath { get; set; } = string.Empty;
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public string ContentRootPath { get; set; } = string.Empty;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    // Runs the filter against a fake request and returns what it decided:
    // null means "let the request through".
    private static IActionResult? Run(string? configuredKey, string? sentKey, string environment = "Development")
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Agent:ApiKey"] = configuredKey })
            .Build();

        var services = new ServiceCollection()
            .AddSingleton<IConfiguration>(config)
            .AddSingleton<IWebHostEnvironment>(new FakeEnvironment { EnvironmentName = environment })
            .AddSingleton(typeof(ILogger<>), typeof(NullLogger<>))
            .BuildServiceProvider();

        var http = new DefaultHttpContext { RequestServices = services };
        if (sentKey is not null)
            http.Request.Headers[RequireAgentKeyAttribute.HeaderName] = sentKey;

        var context = new AuthorizationFilterContext(
            new ActionContext(http, new RouteData(), new ActionDescriptor()),
            new List<IFilterMetadata>());

        new RequireAgentKeyAttribute().OnAuthorization(context);
        return context.Result;
    }

    [Fact]
    public void CorrectKey_IsAllowed()
    {
        Assert.Null(Run(configuredKey: Key, sentKey: Key));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("wrong-key")]
    [InlineData("test-agent-key-12")] // one character short
    public void MissingOrWrongKey_IsRejectedWith401(string? sentKey)
    {
        var result = Run(configuredKey: Key, sentKey: sentKey);

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public void NoKeyConfigured_InDevelopment_IsAllowed()
    {
        Assert.Null(Run(configuredKey: "", sentKey: null, environment: "Development"));
    }

    [Fact]
    public void NoKeyConfigured_OutsideDevelopment_IsRejected()
    {
        var result = Run(configuredKey: "", sentKey: null, environment: "Production");

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, objectResult.StatusCode);
    }
}
