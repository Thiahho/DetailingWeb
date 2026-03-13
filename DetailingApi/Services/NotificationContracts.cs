using DetailingApi.Models;

namespace DetailingApi.Services;

public class NotificationTemplateData
{
    public required string CustomerName { get; init; }
    public required string Service { get; init; }
    public required DateTime StartDateTime { get; init; }
    public required string Location { get; init; }
    public required string CancellationLink { get; init; }
}

public class NotificationMessage
{
    public required string Subject { get; init; }
    public required string Body { get; init; }
}

public class NotificationSendResult
{
    public bool Success { get; init; }
    public string? ProviderMessageId { get; init; }
    public string? Error { get; init; }
    public bool IsTransientFailure { get; init; }
}

public interface INotificationProvider
{
    string Channel { get; }
    string ProviderName { get; }
    bool IsEnabled { get; }
    Task<NotificationSendResult> SendAsync(Booking booking, NotificationMessage message, CancellationToken cancellationToken = default);
}
