namespace DetailingApi.Models;

public class TimeSlot
{
    public int Id { get; set; }
    public DateTime StartDateTime { get; set; }
    public DateTime EndDateTime { get; set; }
    public bool IsAvailable { get; set; } = true;
    public int MaxBookings { get; set; } = 1;
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
    
    public ICollection<Booking> Bookings { get; set; } = new List<Booking>();
}