using System.ComponentModel.DataAnnotations.Schema;

namespace Turneo.Api.Core.Bookings;

[Table("Bookings")]
public class Booking : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public int TimeSlotId { get; set; }
    public TimeSlot TimeSlot { get; set; } = null!;
    public int? ProfessionalId { get; set; }
    public Professional? Professional { get; set; }
    public string? Service{get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string CustomerEmailNormalized { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string? CustomFieldsJson { get; set; }
    public string? Message { get; set; }
    public string? GoogleEventId { get; set; }
    public string? Email { get; set; }
    public string Status { get; set; } = BookingStatus.Pending;
    public DateTime TermsAcceptedAt { get; set; }
    public string TermsVersion { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CancelledAt { get; set; }
    public Payment? Payment { get; set; }
    public ICollection<BookingItem> Items { get; set; } = new List<BookingItem>();
    public string? PhotoUrlsBefore { get; set; }
    public string? PhotoUrlsAfter { get; set; }
}
