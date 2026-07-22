using System.ComponentModel.DataAnnotations.Schema;

namespace Turneo.Api.Core.Professionals;

[Table("Professionals")]
public class Professional : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string PhotoUrl { get; set; } = string.Empty;
    public string CalendarColor { get; set; } = "#7c3aed";
    public string? Specialty { get; set; }
    public decimal Commission { get; set; } = 0;
    public string? Schedule { get; set; }
    public bool IsActive { get; set; } = true;
    public int Order { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<Service> Services { get; set; } = new();
}

// Estructura serializada dentro de Professional.Schedule (jsonb) — no es una entidad EF.
public class WeeklyScheduleDay
{
    public int DayOfWeek { get; set; } // 0=Domingo..6=Sábado, mismo criterio que BusinessSettings.DaysOfWeek
    public string Start { get; set; } = "08:00";
    public string End { get; set; } = "18:00";
    public bool Enabled { get; set; } = true; // día libre recurrente = false
}
