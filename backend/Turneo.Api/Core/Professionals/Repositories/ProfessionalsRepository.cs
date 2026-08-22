using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Core.Professionals;

public class ProfessionalsRepository : IProfessionalsRepository
{
    private readonly ApplicationDbContext _context;

    public ProfessionalsRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<List<Professional>> GetActiveWithServicesAsync() =>
        _context.Professionals
            .Where(p => p.IsActive)
            .Include(p => p.Services)
            .OrderBy(p => p.Order)
            .ThenBy(p => p.CreatedAt)
            .ToListAsync();

    public Task<List<Professional>> GetAllWithServicesAsync() =>
        _context.Professionals
            .Include(p => p.Services)
            .OrderBy(p => p.Order)
            .ThenBy(p => p.CreatedAt)
            .ToListAsync();

    public async Task<Dictionary<int, (int UserId, string? Email, string? Username, string? TelegramChatId)>> GetProfessionalAccountsAsync()
    {
        var accounts = await _context.Users
            .Where(u => u.ProfessionalId != null && u.Role == "Professional")
            .Select(u => new { u.Id, u.ProfessionalId, u.Email, u.Username, u.TelegramChatId })
            .ToListAsync();

        return accounts.ToDictionary(a => a.ProfessionalId!.Value, a => (a.Id, (string?)a.Email, a.Username, a.TelegramChatId));
    }

    public Task<List<Professional>> GetActiveByServiceAsync(int serviceId) =>
        _context.Professionals
            .Where(p => p.IsActive && p.Services.Any(s => s.Id == serviceId))
            .OrderBy(p => p.Order)
            .ThenBy(p => p.CreatedAt)
            .ToListAsync();

    public Task<Professional?> GetActiveByIdWithServicesAsync(int id) =>
        _context.Professionals
            .Where(p => p.Id == id && p.IsActive)
            .Include(p => p.Services)
            .FirstOrDefaultAsync();

    public Task<Professional?> GetByIdWithServicesAsync(int id) =>
        _context.Professionals
            .Include(p => p.Services)
            .FirstOrDefaultAsync(p => p.Id == id);

    public Task<Professional?> GetByIdAsync(int id) =>
        _context.Professionals.FindAsync(id).AsTask();

    public Task<int> CountActiveAsync() =>
        _context.Professionals.CountAsync(p => p.IsActive);

    public async Task<decimal> GetChargedTotalInRangeAsync(int professionalId, DateTime from, DateTime to)
    {
        var totals = await _context.CajaMovements
            .Where(m => m.Booking != null && m.Booking.ProfessionalId == professionalId
                && m.CreatedAt >= from && m.CreatedAt < to
                && (m.Type == CajaMovementType.Charge || m.Type == CajaMovementType.Deposit || m.Type == CajaMovementType.Refund))
            .GroupBy(m => 1)
            .Select(g => new
            {
                Charged = g.Where(m => m.Type != CajaMovementType.Refund).Sum(m => (decimal?)m.Amount) ?? 0m,
                Refunded = g.Where(m => m.Type == CajaMovementType.Refund).Sum(m => (decimal?)m.Amount) ?? 0m
            })
            .FirstOrDefaultAsync();

        return totals == null ? 0m : totals.Charged - totals.Refunded;
    }

    public async Task<ProfessionalDaySummary> GetDaySummaryAsync(int professionalId, DateTime date)
    {
        var dayStart = date.Date;
        var dayEnd = dayStart.AddDays(1);

        var slots = await _context.TimeSlots
            .Where(s => s.ProfessionalId == professionalId && s.StartDateTime >= dayStart && s.StartDateTime < dayEnd)
            .Include(s => s.Bookings)
            .OrderBy(s => s.StartDateTime)
            .ToListAsync();

        var bookings = slots
            .SelectMany(s => s.Bookings.Select(b => new DayBookingSummary(b.Id, s.StartDateTime, s.EndDateTime, b.CustomerName, b.Service, b.Status)))
            .OrderBy(b => b.StartDateTime)
            .ToList();

        var chargedTotal = await GetChargedTotalInRangeAsync(professionalId, dayStart, dayEnd);

        return new ProfessionalDaySummary(
            dayStart,
            PendingCount: bookings.Count(b => b.Status == BookingStatus.Pending || b.Status == BookingStatus.LegacyReserved),
            ConfirmedCount: bookings.Count(b => b.Status == BookingStatus.Confirmed),
            CancelledCount: bookings.Count(b => b.Status == BookingStatus.Cancelled),
            ChargedTotal: chargedTotal,
            Bookings: bookings
        );
    }

    public async Task<List<EarningsPeriod>> GetEarningsBreakdownAsync(int professionalId, EarningsGranularity granularity, DateTime from, DateTime to)
    {
        var movements = await _context.CajaMovements
            .Where(m => m.Booking != null && m.Booking.ProfessionalId == professionalId
                && m.CreatedAt >= from && m.CreatedAt < to
                && (m.Type == CajaMovementType.Charge || m.Type == CajaMovementType.Deposit || m.Type == CajaMovementType.Refund))
            .Select(m => new { m.CreatedAt, m.Amount, m.Type })
            .ToListAsync();

        // Agrupado en memoria (dataset acotado al rango pedido): igual que en
        // GetProfessionalStatsAsync, truncar por semana/mes no traduce bien a SQL.
        return movements
            .GroupBy(m => BucketStart(m.CreatedAt, granularity))
            .Select(g => new EarningsPeriod(
                g.Key,
                g.Where(m => m.Type != CajaMovementType.Refund).Sum(m => m.Amount) - g.Where(m => m.Type == CajaMovementType.Refund).Sum(m => m.Amount)))
            .OrderBy(p => p.PeriodStart)
            .ToList();
    }

    private static DateTime BucketStart(DateTime dt, EarningsGranularity granularity) => granularity switch
    {
        EarningsGranularity.Month => new DateTime(dt.Year, dt.Month, 1),
        EarningsGranularity.Week => dt.Date.AddDays(-((7 + (dt.DayOfWeek - DayOfWeek.Monday)) % 7)),
        _ => dt.Date
    };

    public Task<List<Service>> GetServicesByIdsAsync(List<int> serviceIds) =>
        serviceIds.Count > 0
            ? _context.Services.Where(s => serviceIds.Contains(s.Id)).ToListAsync()
            : Task.FromResult(new List<Service>());

    public void Add(Professional professional) => _context.Professionals.Add(professional);

    public void Remove(Professional professional) => _context.Professionals.Remove(professional);

    public Task<int> SaveChangesAsync() => _context.SaveChangesAsync();
}
