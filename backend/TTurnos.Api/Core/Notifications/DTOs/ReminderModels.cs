namespace TTurnos.Api.Core.Notifications;


// CustomerProfile
public record CreateCustomerProfileRequest(
    string Phone,
    string Name,
    string? Email,
    string? Notes
);

public record UpdateCustomerProfileRequest(
    string Phone,
    string Name,
    string? Email,
    string? Notes
);

public record CustomerProfileResponse(
    int Id,
    string Phone,
    string Name,
    string? Email,
    string? Notes,
    DateTime CreatedAt
);

// ScheduledReminder
public record CreateReminderRequest(
    int CustomerProfileId,
    int? BookingId,
    string ServiceLabel,
    DateTime ScheduledFor,
    int? IntervalDays,
    string? MessageTemplate
);

public record UpdateReminderRequest(
    string ServiceLabel,
    DateTime ScheduledFor,
    int? IntervalDays,
    string? MessageTemplate,
    string Status
);

public record ReminderResponse(
    int Id,
    int CustomerProfileId,
    string CustomerName,
    string CustomerPhone,
    int? BookingId,
    string ServiceLabel,
    DateTime ScheduledFor,
    string Status,
    int? IntervalDays,
    DateTime? NextReminderDate,
    DateTime CreatedAt,
    DateTime? SentAt
);
