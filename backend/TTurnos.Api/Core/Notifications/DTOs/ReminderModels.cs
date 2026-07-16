using System.ComponentModel.DataAnnotations;

namespace TTurnos.Api.Core.Notifications;


// CustomerProfile
public record CreateCustomerProfileRequest(
    [Required, StringLength(30, MinimumLength = 6)] string Phone,
    [Required, StringLength(200, MinimumLength = 1)] string Name,
    [EmailAddress, StringLength(256)] string? Email,
    [StringLength(2000)] string? Notes,
    DateOnly? Birthday,
    [StringLength(100)] string? Instagram,
    [Range(1, int.MaxValue)] int? FavoriteProfessionalId,
    [StringLength(4000)] string? PhotoUrls
);

public record UpdateCustomerProfileRequest(
    [Required, StringLength(30, MinimumLength = 6)] string Phone,
    [Required, StringLength(200, MinimumLength = 1)] string Name,
    [EmailAddress, StringLength(256)] string? Email,
    [StringLength(2000)] string? Notes,
    DateOnly? Birthday,
    [StringLength(100)] string? Instagram,
    [Range(1, int.MaxValue)] int? FavoriteProfessionalId,
    [StringLength(4000)] string? PhotoUrls
);

public record CustomerProfileResponse(
    int Id,
    string Phone,
    string Name,
    string? Email,
    string? Notes,
    DateOnly? Birthday,
    string? Instagram,
    int? FavoriteProfessionalId,
    string? FavoriteProfessionalName,
    string? PhotoUrls,
    DateTime CreatedAt
);

public record CustomerBookingHistoryItem(
    int Id,
    string Status,
    string? Service,
    string Subject,
    int? ProfessionalId,
    string? ProfessionalName,
    DateTime StartDateTime,
    DateTime EndDateTime
);

// ScheduledReminder
public record CreateReminderRequest(
    [Range(1, int.MaxValue)] int CustomerProfileId,
    [Range(1, int.MaxValue)] int? BookingId,
    [Required, StringLength(200, MinimumLength = 1)] string ServiceLabel,
    DateTime ScheduledFor,
    [Range(1, 3650)] int? IntervalDays,
    [StringLength(2000)] string? MessageTemplate
);

public record UpdateReminderRequest(
    [Required, StringLength(200, MinimumLength = 1)] string ServiceLabel,
    DateTime ScheduledFor,
    [Range(1, 3650)] int? IntervalDays,
    [StringLength(2000)] string? MessageTemplate,
    [Required, RegularExpression("^(Pending|Sent|Failed|Cancelled)$")] string Status
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
