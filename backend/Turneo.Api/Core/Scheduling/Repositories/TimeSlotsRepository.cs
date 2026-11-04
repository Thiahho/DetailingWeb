using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Core.Scheduling;

public class TimeSlotsRepository : ITimeSlotsRepository
{
    private readonly ApplicationDbContext _context;

    public TimeSlotsRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<List<TimeSlot>> GetAvailableAsync(int? professionalId, DateTime after) =>
        _context.TimeSlots
            .Where(t => t.IsAvailable && !t.IsBlocked && t.StartDateTime > after)
            .Where(t => professionalId == null || t.ProfessionalId == professionalId)
            .Include(t => t.Professional)
            .Include(t => t.Service)
            .OrderBy(t => t.StartDateTime)
            .ToListAsync();

    public Task<List<TimeSlot>> GetMineAsync(int professionalId) =>
        _context.TimeSlots
            .Where(t => t.ProfessionalId == professionalId)
            .Include(t => t.Bookings)
            .OrderBy(t => t.StartDateTime)
            .ToListAsync();

    // One SQL query (EF single-query mode): slots LEFT JOIN professional/service,
    // plus their bookings LEFT JOIN booking professional and payment. The range
    // is applied in the WHERE clause and served by the (TenantId, StartDateTime,
    // ProfessionalId) index.
    public Task<List<TimeSlot>> GetAllWithBookingsAsync(DateTime? from = null, DateTime? toExclusive = null) =>
        _context.TimeSlots
            .AsNoTracking()
            .Where(t => from == null || t.StartDateTime >= from)
            .Where(t => toExclusive == null || t.StartDateTime < toExclusive)
            .Include(t => t.Professional)
            .Include(t => t.Service)
            .Include(t => t.Bookings)
                .ThenInclude(b => b.Professional)
            .Include(t => t.Bookings)
                .ThenInclude(b => b.Payment)
            .OrderBy(t => t.StartDateTime)
            .ToListAsync();

    public Task<bool> HasApprovedPaymentAsync(int timeSlotId) =>
        _context.Payments.AnyAsync(p => p.Booking.TimeSlotId == timeSlotId && p.Status == PaymentStatus.Approved);

    public Task<bool> ProfessionalIsActiveAsync(int professionalId) =>
        _context.Professionals.AnyAsync(p => p.Id == professionalId && p.IsActive);

    public Task<bool> ServiceExistsAsync(int serviceId) =>
        _context.Services.AnyAsync(s => s.Id == serviceId);

    public Task<bool> AnyActiveProfessionalExistsAsync() =>
        _context.Professionals.AnyAsync(p => p.IsActive);

    public Task<bool> SlotExistsAsync(DateTime startDateTime, int? professionalId, int? excludeId = null) =>
        _context.TimeSlots.AnyAsync(t =>
            t.StartDateTime == startDateTime &&
            t.ProfessionalId == professionalId &&
            (excludeId == null || t.Id != excludeId));

    public Task<TimeSlot?> GetByIdWithBookingsAsync(int id) =>
        _context.TimeSlots
            .Include(t => t.Bookings)
                .ThenInclude(b => b.Payment)
            .FirstOrDefaultAsync(t => t.Id == id);

    public void Add(TimeSlot slot) => _context.TimeSlots.Add(slot);

    public void Remove(TimeSlot slot) => _context.TimeSlots.Remove(slot);

    public void RemoveBookings(IEnumerable<Booking> bookings) => _context.Bookings.RemoveRange(bookings);

    public Task<int> SaveChangesAsync() => _context.SaveChangesAsync();
}
