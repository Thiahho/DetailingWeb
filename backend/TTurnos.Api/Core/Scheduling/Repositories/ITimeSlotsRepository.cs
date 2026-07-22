namespace Turneo.Api.Core.Scheduling;

public interface ITimeSlotsRepository
{
    Task<List<TimeSlot>> GetAvailableAsync(int? professionalId, DateTime after);
    Task<List<TimeSlot>> GetMineAsync(int professionalId);
    Task<List<TimeSlot>> GetAllWithBookingsAsync();
    Task<bool> ProfessionalIsActiveAsync(int professionalId);
    Task<bool> SlotExistsAsync(DateTime startDateTime, int? professionalId, int? excludeId = null);
    Task<TimeSlot?> GetByIdWithBookingsAsync(int id);
    void Add(TimeSlot slot);
    void Remove(TimeSlot slot);
    void RemoveBookings(IEnumerable<Booking> bookings);
    Task<int> SaveChangesAsync();
}
