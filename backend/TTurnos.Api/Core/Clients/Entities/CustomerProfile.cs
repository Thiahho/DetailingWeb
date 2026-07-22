
using System.ComponentModel.DataAnnotations.Schema;

namespace Turneo.Api.Core.Clients;


[Table("CustomerProfiles")] 
// Models/CustomerProfile.cs
public class CustomerProfile : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public string Phone { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Notes { get; set; }
    public DateOnly? Birthday { get; set; }
    public string? Instagram { get; set; }
    public int? FavoriteProfessionalId { get; set; }
    public Professional? FavoriteProfessional { get; set; }
    // Array JSON de URLs de Cloudinary (mismo patrón que Professional.Schedule: string crudo, jsonb).
    public string? PhotoUrls { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ScheduledReminder> ScheduledReminders { get; set; } = [];
}

// Models/ScheduledReminder.cs
public class ScheduledReminder : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public int CustomerProfileId { get; set; }
    public int? BookingId { get; set; }
    public string ServiceLabel { get; set; } = string.Empty;
    public DateTime ScheduledFor { get; set; }
    public string Status { get; set; } = ReminderStatus.Pending;
    public int? IntervalDays { get; set; }
    public DateTime? NextReminderDate { get; set; }
    public string? MessageTemplate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SentAt { get; set; }

    public CustomerProfile CustomerProfile { get; set; } = null!;
    public Booking? Booking { get; set; }
    public ICollection<ReminderLog> Logs { get; set; } = [];
}

// Models/ReminderLog.cs
public class ReminderLog : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public int ScheduledReminderId { get; set; }
    public string Channel { get; set; } = "WhatsApp";
    public string Status { get; set; } = string.Empty;
    public string? ProviderMessageId { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime AttemptedAt { get; set; } = DateTime.UtcNow;

    public ScheduledReminder ScheduledReminder { get; set; } = null!;
}

// Models/ReminderStatus.cs — constantes para evitar strings sueltos
public static class ReminderStatus
{
    public const string Pending   = "Pending";
    public const string Sent      = "Sent";
    public const string Failed    = "Failed";
    public const string Cancelled = "Cancelled";
}
