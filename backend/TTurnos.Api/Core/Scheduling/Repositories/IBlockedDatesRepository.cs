namespace TTurnos.Api.Core.Scheduling;

public interface IBlockedDatesRepository
{
    Task<List<BlockedDateSummary>> GetUpcomingAsync();
    Task<bool> ExistsAsync(DateTime date, int? professionalId);
    Task<List<TimeSlot>> GetAvailableSlotsOnDateAsync(DateTime date, int? professionalId);
    Task<BlockedDate?> FindAsync(int id);
    void Add(BlockedDate blockedDate);
    void Remove(BlockedDate blockedDate);
    void RemoveSlots(IEnumerable<TimeSlot> slots);
    Task<int> SaveChangesAsync();
}

public record BlockedDateSummary(int Id, DateTime Date, string? Reason, bool IsRecurring, int? ProfessionalId, string? ProfessionalName);
