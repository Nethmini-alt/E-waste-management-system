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