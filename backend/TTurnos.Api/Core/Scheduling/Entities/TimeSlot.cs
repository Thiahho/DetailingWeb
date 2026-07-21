namespace TTurnos.Api.Core.Scheduling;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

[Table("TimeSlots")]
public class TimeSlot : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    [Column("StartDateTime")]
    public DateTime StartDateTime { get; set; }
    [Column("EndDateTime")]
    public DateTime EndDateTime { get; set; }
    [Column("IsAvailable")]
    public bool IsAvailable { get; set; } = true;
    // Deshabilitado a mano por el admin/profesional (sin reserva): distinto de
    // IsAvailable=false, que significa "tiene una reserva activa".
    [Column("IsBlocked")]
    public bool IsBlocked { get; set; } = false;
    [Column("MaxBookings")]
    public int MaxBookings { get; set; } = 1;
    [Column("GeneratedAt")]
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

    // Nullable: turnos legacy generados antes de la agenda por profesional quedan sin asignar.
    public int? ProfessionalId { get; set; }
    public Professional? Professional { get; set; }

    public ICollection<Booking> Bookings { get; set; } = new List<Booking>();
}