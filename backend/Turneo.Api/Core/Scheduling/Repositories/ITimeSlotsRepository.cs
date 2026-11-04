namespace Turneo.Api.Core.Scheduling;

public interface ITimeSlotsRepository
{
    Task<List<TimeSlot>> GetAvailableAsync(int? professionalId, DateTime after);
    Task<List<TimeSlot>> GetMineAsync(int professionalId);
    // Optional [from, toExclusive) filter on StartDateTime (Argentina wall-clock,
    // as stored). Bookings come with their Professional and Payment in the same query.
    Task<List<TimeSlot>> GetAllWithBookingsAsync(DateTime? from = null, DateTime? toExclusive = null);
    // True when any booking of the slot has an approved payment (tenant-scoped query filter).
    Task<bool> HasApprovedPaymentAsync(int timeSlotId);
    Task<bool> ProfessionalIsActiveAsync(int professionalId);
    Task<bool> ServiceExistsAsync(int serviceId);
    // Negocio unipersonal: sin ningún Professional activo, un turno puntual puede
    // crearse sin asignar profesional (mismo criterio que ya usa la generación
    // automática de disponibilidad, ver TimeSlotGeneratorService).
    Task<bool> AnyActiveProfessionalExistsAsync();
    Task<bool> SlotExistsAsync(DateTime startDateTime, int? professionalId, int? excludeId = null);
    Task<TimeSlot?> GetByIdWithBookingsAsync(int id);
    void Add(TimeSlot slot);
    void Remove(TimeSlot slot);
    void RemoveBookings(IEnumerable<Booking> bookings);
    Task<int> SaveChangesAsync();
}
