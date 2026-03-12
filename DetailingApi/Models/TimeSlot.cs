namespace DetailingApi.Models;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

[Table("TimeSlots")]
public class TimeSlot
{
    public int Id { get; set; }
    [Column("StartDateTime")]
    public DateTime StartDateTime { get; set; }
    [Column("EndDateTime")]
    public DateTime EndDateTime { get; set; }
    [Column("IsAvailable")]
    public bool IsAvailable { get; set; } = true;
    [Column("MaxBookings")]
    public int MaxBookings { get; set; } = 1;
    [Column("GeneratedAt")]
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
    
    public ICollection<Booking> Bookings { get; set; } = new List<Booking>();
}