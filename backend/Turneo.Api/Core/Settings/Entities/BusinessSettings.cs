using System.ComponentModel.DataAnnotations.Schema;

namespace Turneo.Api.Core.Settings;

[Table("BusinessSettings")]
public class BusinessSettings : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public int[] DaysOfWeek { get; set; } = Array.Empty<int>();
    public TimeSpan StartTime { get; set; }
    // public TimeSpan EndTime { get; set; }
    public int SlotDuration { get; set; } // minutos
    public int BreakBetweenSlots { get; set; } // minutos
    public int MaxDaysInAdvance { get; set; } = 30;
    // Minimum gap, in minutes, between two at-home bookings of the same
    // professional (0 disables it). Rows created before the column existed get
    // the default from the migration; the model has no DB default on purpose so
    // an explicit 0 is never replaced by it.
    public int HomeServiceTravelBufferMinutes { get; set; } = DefaultHomeServiceTravelBufferMinutes;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public const int DefaultHomeServiceTravelBufferMinutes = 30;
    public const int MaxHomeServiceTravelBufferMinutes = 240;
}