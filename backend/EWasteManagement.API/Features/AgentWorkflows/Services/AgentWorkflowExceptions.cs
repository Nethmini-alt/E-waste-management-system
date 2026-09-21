namespace EWasteManagement.API.Features.AgentWorkflows.Services;

/// <summary>The workflow is not in a state that allows the action (e.g. already decided). Mapped to HTTP 409.</summary>
public class WorkflowConflictException : InvalidOperationException
{
    public WorkflowConflictException(string message) : base(message) { }
}

/// <summary>The agent service could not be reached or refused the request. Mapped to HTTP 503.</summary>
public class AgentServiceUnavailableException : Exception
{
    public AgentServiceUnavailableException(string message) : base(message) { }
}
