namespace DetailingApi.Models;

public class Booking
{
    public int Id { get; set; }
    public int TimeSlotId { get; set; }
    public TimeSlot TimeSlot { get; set; } = null!;
    public string? Service{get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string Vehicle { get; set; } = string.Empty;
    public string? Message { get; set; }
    public string? GoogleEventId { get; set; }
    public string Status { get; set; } = "Pending"; // Pending, Confirmed, Cancelled
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}