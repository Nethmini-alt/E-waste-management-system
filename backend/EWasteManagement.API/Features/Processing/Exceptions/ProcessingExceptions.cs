using EWasteManagement.API.Features.Processing.Entities;

namespace EWasteManagement.API.Features.Processing.Exceptions;

public class DuplicateJobReceiptException : Exception
{
    public DuplicateJobReceiptException(Guid jobId)
        : base($"Job '{jobId}' has already been received into inventory.") { }
}

public class JobNotCompletedException : Exception
{
    public JobNotCompletedException(Guid jobId)
        : base($"Job '{jobId}' is not marked Completed yet and cannot be received.") { }
}

// The job already determines who collected it, so the collector on a receive request is checked
// against the job's assigned collector — never trusted. A job with no collector cannot be received
// (the collector is never guessed).
public class JobCollectorMismatchException : Exception
{
    private JobCollectorMismatchException(string message) : base(message) { }

    public static JobCollectorMismatchException NoCollectorAssigned(Guid jobId)
        => new($"Job '{jobId}' has no assigned collector, so it cannot be received.");

    public static JobCollectorMismatchException WrongCollector(Guid jobId, Guid suppliedCollectorId)
        => new($"Collector '{suppliedCollectorId}' is not the collector assigned to job '{jobId}'.");
}

public class DuplicatePaymentException : Exception
{
    public DuplicatePaymentException(PaymentSourceType sourceType, Guid sourceId)
        : base($"A payment already exists for {sourceType} source '{sourceId}'.") { }
}

public class PaymentAlreadyPaidException : Exception
{
    public PaymentAlreadyPaidException(Guid paymentId)
        : base($"Payment '{paymentId}' has already been marked paid.") { }
}