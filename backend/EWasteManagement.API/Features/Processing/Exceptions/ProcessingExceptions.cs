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