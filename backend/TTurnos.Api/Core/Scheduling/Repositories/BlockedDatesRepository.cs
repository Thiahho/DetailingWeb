using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Core.Scheduling;

public class BlockedDatesRepository : IBlockedDatesRepository
{
    private readonly ApplicationDbContext _context;

    public BlockedDatesRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<List<BlockedDateSummary>> GetUpcomingAsync() =>
        _context.BlockedDates
            .Include(d => d.Professional)
            .Where(d => d.Date >= DateTime.Today)
            .OrderBy(d => d.Date)
            .Select(d => new BlockedDateSummary(
                d.Id,
                d.Date,
                d.Reason,
                d.IsRecurring,
                d.ProfessionalId,
                d.Professional != null ? d.Professional.FirstName + " " + d.Professional.LastName : null))
            .ToListAsync();

    public Task<bool> ExistsAsync(DateTime date, int? professionalId) =>
        _context.BlockedDates.AnyAsync(d => d.Date == date && d.ProfessionalId == professionalId);

    public Task<List<TimeSlot>> GetAvailableSlotsOnDateAsync(DateTime date, int? professionalId) =>
        _context.TimeSlots
            .Where(t => t.StartDateTime.Date == date.Date && t.IsAvailable)
            .Where(t => professionalId == null || t.ProfessionalId == professionalId)
            .ToListAsync();

    public Task<BlockedDate?> FindAsync(int id) => _context.BlockedDates.FindAsync(id).AsTask();

    public void Add(BlockedDate blockedDate) => _context.BlockedDates.Add(blockedDate);

    public void Remove(BlockedDate blockedDate) => _context.BlockedDates.Remove(blockedDate);

    public void RemoveSlots(IEnumerable<TimeSlot> slots) => _context.TimeSlots.RemoveRange(slots);

    public Task<int> SaveChangesAsync() => _context.SaveChangesAsync();
}
