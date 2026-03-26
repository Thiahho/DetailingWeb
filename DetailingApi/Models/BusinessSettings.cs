using System.ComponentModel.DataAnnotations.Schema;

namespace DetailingApi.Models;

[Table("BusinessSettings")]
public class BusinessSettings
{
    public int Id { get; set; }
    public int[] DaysOfWeek { get; set; } = Array.Empty<int>();
    public TimeSpan StartTime { get; set; }
    // public TimeSpan EndTime { get; set; }
    public int SlotDuration { get; set; } // minutos
    public int BreakBetweenSlots { get; set; } // minutos
    public int MaxDaysInAdvance { get; set; } = 30;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}