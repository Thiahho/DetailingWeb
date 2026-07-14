using Microsoft.EntityFrameworkCore;

namespace TTurnos.Api.Core.Reports;

public class AnalyticsRepository : IAnalyticsRepository
{
    private readonly ApplicationDbContext _context;

    public AnalyticsRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<int> CountBookingsFromAsync(DateTime from) =>
        _context.Bookings.Where(b => b.CreatedAt >= from).CountAsync();

    public Task<int> CountBookingsFromAsync(DateTime from, string status) =>
        _context.Bookings.Where(b => b.CreatedAt >= from && b.Status == status).CountAsync();

    public Task<int> CountBookingsBetweenAsync(DateTime from, DateTime to) =>
        _context.Bookings.Where(b => b.CreatedAt >= from && b.CreatedAt < to).CountAsync();

    public Task<int> CountBookingsTotalAsync() => _context.Bookings.CountAsync();

    public Task<int> CountBookingsByStatusAsync(params string[] statuses) =>
        _context.Bookings.Where(b => statuses.Contains(b.Status)).CountAsync();

    public Task<int> CountTimeSlotsTotalAsync() => _context.TimeSlots.CountAsync();

    public Task<int> CountTimeSlotsAvailableAsync() => _context.TimeSlots.CountAsync(s => s.IsAvailable);

    public async Task<List<(string Service, int Count)>> GetTopServicesAsync(int take)
    {
        var result = await _context.Bookings
            .Where(b => b.Service != null)
            .GroupBy(b => b.Service!)
            .Select(g => new { Service = g.Key, Count = g.Count() })
            .OrderByDescending(g => g.Count)
            .Take(take)
            .ToListAsync();

        return result.Select(r => (r.Service, r.Count)).ToList();
    }

    public async Task<List<(DateTime CreatedAt, DateTime SlotStart)>> GetLeadTimesFromAsync(DateTime from)
    {
        var result = await _context.Bookings
            .Include(b => b.TimeSlot)
            .Where(b => b.CreatedAt >= from)
            .Select(b => new { b.CreatedAt, b.TimeSlot.StartDateTime })
            .ToListAsync();

        return result.Select(r => (r.CreatedAt, r.StartDateTime)).ToList();
    }

    public async Task<List<(int Year, int Month, int Count)>> GetBookingsByMonthAsync(DateTime from)
    {
        var result = await _context.Bookings
            .Where(b => b.CreatedAt >= from)
            .GroupBy(b => new { b.CreatedAt.Year, b.CreatedAt.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, Count = g.Count() })
            .OrderBy(g => g.Year).ThenBy(g => g.Month)
            .ToListAsync();

        return result.Select(r => (r.Year, r.Month, r.Count)).ToList();
    }

    public Task<List<UpcomingBookingSummary>> GetUpcomingBookingsAsync(DateTime from, DateTime to, int take, params string[] statuses) =>
        _context.Bookings
            .Include(b => b.TimeSlot)
            .Where(b => b.TimeSlot.StartDateTime >= from
                     && b.TimeSlot.StartDateTime <= to
                     && statuses.Contains(b.Status))
            .OrderBy(b => b.TimeSlot.StartDateTime)
            .Select(b => new UpcomingBookingSummary(b.Id, b.CustomerName, b.Subject, b.Service, b.TimeSlot.StartDateTime))
            .Take(take)
            .ToListAsync();
}
