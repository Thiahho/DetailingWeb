using Microsoft.EntityFrameworkCore;

namespace TTurnos.Api.Core.Scheduling;

public class TimeSlotsRepository : ITimeSlotsRepository
{
    private readonly ApplicationDbContext _context;

    public TimeSlotsRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<List<TimeSlot>> GetAvailableAsync(int? professionalId, DateTime after) =>
        _context.TimeSlots
            .Where(t => t.IsAvailable && t.StartDateTime > after)
            .Where(t => professionalId == null || t.ProfessionalId == professionalId)
            .Include(t => t.Professional)
            .OrderBy(t => t.StartDateTime)
            .ToListAsync();

    public Task<List<TimeSlot>> GetMineAsync(int professionalId) =>
        _context.TimeSlots
            .Where(t => t.ProfessionalId == professionalId)
            .Include(t => t.Bookings)
            .OrderBy(t => t.StartDateTime)
            .ToListAsync();

    public Task<List<TimeSlot>> GetAllWithBookingsAsync() =>
        _context.TimeSlots
            .Include(t => t.Professional)
            .Include(t => t.Bookings)
                .ThenInclude(b => b.Professional)
            .OrderBy(t => t.StartDateTime)
            .ToListAsync();

    public Task<bool> ProfessionalIsActiveAsync(int professionalId) =>
        _context.Professionals.AnyAsync(p => p.Id == professionalId && p.IsActive);

    public Task<bool> SlotExistsAsync(DateTime startDateTime, int? professionalId, int? excludeId = null) =>
        _context.TimeSlots.AnyAsync(t =>
            t.StartDateTime == startDateTime &&
            t.ProfessionalId == professionalId &&
            (excludeId == null || t.Id != excludeId));

    public Task<TimeSlot?> GetByIdWithBookingsAsync(int id) =>
        _context.TimeSlots.Include(t => t.Bookings).FirstOrDefaultAsync(t => t.Id == id);

    public void Add(TimeSlot slot) => _context.TimeSlots.Add(slot);

    public void Remove(TimeSlot slot) => _context.TimeSlots.Remove(slot);

    public void RemoveBookings(IEnumerable<Booking> bookings) => _context.Bookings.RemoveRange(bookings);

    public Task<int> SaveChangesAsync() => _context.SaveChangesAsync();
}
