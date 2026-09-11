using System.Net;
using System.Text.Json;

namespace EWasteManagement.API.Infrastructure.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleAsync(context, ex);
        }
    }

    private async Task HandleAsync(HttpContext context, Exception ex)
    {
        var (status, title) = ex switch
        {
            KeyNotFoundException      => ((int)HttpStatusCode.NotFound, "Resource not found."),
            UnauthorizedAccessException => ((int)HttpStatusCode.Unauthorized, "Unauthorized."),
            InvalidOperationException   => ((int)HttpStatusCode.BadRequest, ex.Message),
            ArgumentException           => ((int)HttpStatusCode.BadRequest, ex.Message),
            _                           => ((int)HttpStatusCode.InternalServerError, "An unexpected error occurred.")
        };

        if (status >= 500)
            _logger.LogError(ex, "Unhandled exception");
        else
            _logger.LogWarning(ex, "Handled exception: {Message}", ex.Message);

        context.Response.StatusCode = status;
        context.Response.ContentType = "application/json";

        var payload = new
        {
            status,
            title,
            detail = status >= 500 ? null : ex.Message,
            traceId = context.TraceIdentifier
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(payload));
    }
}