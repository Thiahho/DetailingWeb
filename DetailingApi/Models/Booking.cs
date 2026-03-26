namespace DetailingApi.Models;

public class Booking
{
    public int Id { get; set; }
    public int TimeSlotId { get; set; }
    public TimeSlot TimeSlot { get; set; } = null!;
    public string? Service{get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string CustomerEmailNormalized { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string? CustomFieldsJson { get; set; }
    public string? Message { get; set; }
    public string? GoogleEventId { get; set; }
    public string? Email { get; set; }
    public string Status { get; set; } = BookingStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CancelledAt { get; set; }
    public Payment? Payment { get; set; }
}
