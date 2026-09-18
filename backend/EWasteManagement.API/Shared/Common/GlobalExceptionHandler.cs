using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using EWasteManagement.API.Features.Processing.Exceptions;

namespace EWasteManagement.API.Shared.Common;

/// <summary>
/// Single place that turns any unhandled exception into a consistent RFC 7807 ProblemDetails response.
/// Register with builder.Services.AddExceptionHandler&lt;GlobalExceptionHandler&gt;() + AddProblemDetails(),
/// and app.UseExceptionHandler() in the pipeline (see Program.cs).
/// </summary>
public class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger)
    {
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        _logger.LogError(exception, "Unhandled exception on {Path}: {Message}", httpContext.Request.Path, exception.Message);

        var (statusCode, title) = exception switch
        {
            InvalidStatusTransitionException => (StatusCodes.Status409Conflict, "Invalid status transition"),
            DbUpdateConcurrencyException => (StatusCodes.Status409Conflict, "This item was modified by someone else — reload and try again"),
            KeyNotFoundException => (StatusCodes.Status404NotFound, "Resource not found"),
            ArgumentException => (StatusCodes.Status400BadRequest, "Invalid request"),
            DuplicateJobReceiptException => (StatusCodes.Status409Conflict, "Job already received"),
            JobNotCompletedException => (StatusCodes.Status409Conflict, "Job not ready for receipt"),
            DuplicatePaymentException => (StatusCodes.Status409Conflict, "Payment already exists"),
            PaymentAlreadyPaidException => (StatusCodes.Status409Conflict, "Payment already paid"),
            _ => (StatusCodes.Status500InternalServerError, "An unexpected error occurred"),
        };

        httpContext.Response.StatusCode = statusCode;

        await httpContext.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = exception.Message,
            Instance = httpContext.Request.Path,
        }, cancellationToken);

        return true;
    }
}
