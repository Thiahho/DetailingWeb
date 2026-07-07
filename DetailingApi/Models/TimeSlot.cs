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

    // Nullable: turnos legacy generados antes de la agenda por profesional quedan sin asignar.
    public int? ProfessionalId { get; set; }
    public Professional? Professional { get; set; }

    public ICollection<Booking> Bookings { get; set; } = new List<Booking>();
}