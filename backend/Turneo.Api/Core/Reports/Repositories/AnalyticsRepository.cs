using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Core.Reports;

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

    public async Task<List<ProfessionalStatsSummary>> GetProfessionalStatsAsync(DateTime monthStart, DateTime monthEnd)
    {
        var professionals = await _context.Professionals
            .Where(p => p.IsActive)
            .Select(p => new { p.Id, Name = p.FirstName + " " + p.LastName })
            .ToListAsync();

        var revenueByProfessional = await _context.Payments
            .Where(pay => pay.Status == PaymentStatus.Approved
                       && pay.PaidAt != null
                       && pay.PaidAt >= monthStart && pay.PaidAt < monthEnd
                       && pay.Booking.ProfessionalId != null)
            .GroupBy(pay => pay.Booking.ProfessionalId!.Value)
            .Select(g => new { ProfessionalId = g.Key, Revenue = g.Sum(p => p.Amount), Count = g.Count() })
            .ToListAsync();

        // Horas ocupadas/libres se calculan en memoria (dataset acotado a un mes) porque
        // sumar TimeSpan (EndDateTime - StartDateTime) no traduce a SQL.
        var monthSlots = await _context.TimeSlots
            .Where(s => s.ProfessionalId != null && s.StartDateTime >= monthStart && s.StartDateTime < monthEnd)
            .Select(s => new { s.ProfessionalId, s.StartDateTime, s.EndDateTime, s.IsAvailable })
            .ToListAsync();

        var hoursByProfessional = monthSlots
            .GroupBy(s => s.ProfessionalId!.Value)
            .Select(g => new
            {
                ProfessionalId = g.Key,
                OccupiedHours = g.Where(s => !s.IsAvailable).Sum(s => (s.EndDateTime - s.StartDateTime).TotalHours),
                FreeHours = g.Where(s => s.IsAvailable).Sum(s => (s.EndDateTime - s.StartDateTime).TotalHours),
            })
            .ToList();

        var absencesByProfessional = await _context.BlockedDates
            .Where(b => b.ProfessionalId != null && b.Date >= monthStart)
            .GroupBy(b => b.ProfessionalId!.Value)
            .Select(g => new { ProfessionalId = g.Key, Count = g.Count() })
            .ToListAsync();

        return professionals
            .Select(p =>
            {
                var revenue = revenueByProfessional.FirstOrDefault(r => r.ProfessionalId == p.Id);
                var hours = hoursByProfessional.FirstOrDefault(h => h.ProfessionalId == p.Id);
                var absences = absencesByProfessional.FirstOrDefault(a => a.ProfessionalId == p.Id);

                var occupiedHours = hours?.OccupiedHours ?? 0;
                var freeHours = hours?.FreeHours ?? 0;
                var totalHours = occupiedHours + freeHours;

                return new ProfessionalStatsSummary(
                    p.Id,
                    p.Name,
                    revenue?.Revenue ?? 0m,
                    revenue?.Count ?? 0,
                    Math.Round(occupiedHours, 1),
                    Math.Round(freeHours, 1),
                    totalHours > 0 ? Math.Round(occupiedHours / totalHours * 100, 1) : 0,
                    absences?.Count ?? 0
                );
            })
            .OrderByDescending(p => p.RevenueThisMonth)
            .ToList();
    }

    public async Task<CommissionsSummary> GetCommissionsSummaryAsync(DateTime from, DateTime to, int? professionalId)
    {
        var professionalsQuery = _context.Professionals.AsQueryable();
        if (professionalId.HasValue)
            professionalsQuery = professionalsQuery.Where(p => p.Id == professionalId.Value);

        var professionals = await professionalsQuery
            .Select(p => new { p.Id, Name = p.FirstName + " " + p.LastName, p.Commission })
            .ToListAsync();

        var chargedByProfessional = await _context.CajaMovements
            .Where(m => m.Booking != null && m.Booking.ProfessionalId != null
                && m.CreatedAt >= from && m.CreatedAt < to
                && (m.Type == CajaMovementType.Charge || m.Type == CajaMovementType.Deposit || m.Type == CajaMovementType.Refund))
            .GroupBy(m => m.Booking!.ProfessionalId!.Value)
            .Select(g => new
            {
                ProfessionalId = g.Key,
                Charged = g.Where(m => m.Type != CajaMovementType.Refund).Sum(m => (decimal?)m.Amount) ?? 0m,
                Refunded = g.Where(m => m.Type == CajaMovementType.Refund).Sum(m => (decimal?)m.Amount) ?? 0m
            })
            .ToListAsync();

        var byProfessional = professionals
            .Select(p =>
            {
                var charged = chargedByProfessional.FirstOrDefault(c => c.ProfessionalId == p.Id);
                var chargedTotal = charged == null ? 0m : charged.Charged - charged.Refunded;
                var commissionAmount = chargedTotal * (p.Commission / 100m);
                return new ProfessionalCommissionSummary(p.Id, p.Name, p.Commission, chargedTotal, commissionAmount);
            })
            .OrderByDescending(p => p.ChargedTotal)
            .ToList();

        // Ingresos totales del negocio: todo lo cobrado en el rango, tenga o no
        // profesional asignado (distinto de la suma de byProfessional).
        var businessTotals = await _context.CajaMovements
            .Where(m => m.CreatedAt >= from && m.CreatedAt < to
                && (m.Type == CajaMovementType.Charge || m.Type == CajaMovementType.Deposit || m.Type == CajaMovementType.Refund))
            .GroupBy(m => 1)
            .Select(g => new
            {
                Charged = g.Where(m => m.Type != CajaMovementType.Refund).Sum(m => (decimal?)m.Amount) ?? 0m,
                Refunded = g.Where(m => m.Type == CajaMovementType.Refund).Sum(m => (decimal?)m.Amount) ?? 0m
            })
            .FirstOrDefaultAsync();

        var businessChargedTotal = businessTotals == null ? 0m : businessTotals.Charged - businessTotals.Refunded;

        return new CommissionsSummary(
            businessChargedTotal,
            byProfessional.Sum(p => p.CommissionAmount),
            byProfessional
        );
    }

    public async Task<ProfessionalDaySummary> GetDaySummaryAllAsync(DateTime date, int? professionalId)
    {
        var dayStart = date.Date;
        var dayEnd = dayStart.AddDays(1);

        var slotsQuery = _context.TimeSlots
            .Where(s => s.StartDateTime >= dayStart && s.StartDateTime < dayEnd);
        if (professionalId.HasValue)
            slotsQuery = slotsQuery.Where(s => s.ProfessionalId == professionalId.Value);

        var slots = await slotsQuery
            .Include(s => s.Bookings)
            .OrderBy(s => s.StartDateTime)
            .ToListAsync();

        var bookings = slots
            .SelectMany(s => s.Bookings.Select(b => new DayBookingSummary(b.Id, s.StartDateTime, s.EndDateTime, b.CustomerName, b.Service, b.Status)))
            .OrderBy(b => b.StartDateTime)
            .ToList();

        var movementsQuery = _context.CajaMovements
            .Where(m => m.Booking != null && m.CreatedAt >= dayStart && m.CreatedAt < dayEnd
                && (m.Type == CajaMovementType.Charge || m.Type == CajaMovementType.Deposit || m.Type == CajaMovementType.Refund));
        if (professionalId.HasValue)
            movementsQuery = movementsQuery.Where(m => m.Booking!.ProfessionalId == professionalId.Value);

        var totals = await movementsQuery
            .GroupBy(m => 1)
            .Select(g => new
            {
                Charged = g.Where(m => m.Type != CajaMovementType.Refund).Sum(m => (decimal?)m.Amount) ?? 0m,
                Refunded = g.Where(m => m.Type == CajaMovementType.Refund).Sum(m => (decimal?)m.Amount) ?? 0m
            })
            .FirstOrDefaultAsync();

        var chargedTotal = totals == null ? 0m : totals.Charged - totals.Refunded;

        return new ProfessionalDaySummary(
            dayStart,
            PendingCount: bookings.Count(b => b.Status == BookingStatus.Pending || b.Status == BookingStatus.LegacyReserved),
            ConfirmedCount: bookings.Count(b => b.Status == BookingStatus.Confirmed),
            CancelledCount: bookings.Count(b => b.Status == BookingStatus.Cancelled),
            ChargedTotal: chargedTotal,
            Bookings: bookings
        );
    }

    public async Task<List<BusinessEarningsPeriod>> GetBusinessEarningsBreakdownAsync(EarningsGranularity granularity, DateTime from, DateTime to)
    {
        var professionalRates = await _context.Professionals
            .Select(p => new { p.Id, p.Commission })
            .ToDictionaryAsync(p => p.Id, p => p.Commission);

        var movements = await _context.CajaMovements
            .Where(m => m.Booking != null && m.Booking.ProfessionalId != null
                && m.CreatedAt >= from && m.CreatedAt < to
                && (m.Type == CajaMovementType.Charge || m.Type == CajaMovementType.Deposit || m.Type == CajaMovementType.Refund))
            .Select(m => new { m.CreatedAt, m.Amount, m.Type, ProfessionalId = m.Booking!.ProfessionalId!.Value })
            .ToListAsync();

        // Igual que GetEarningsBreakdownAsync (Professionals), pero agregando por
        // profesional dentro de cada bucket para aplicar la comisión de cada uno.
        return movements
            .GroupBy(m => BucketStart(m.CreatedAt, granularity))
            .Select(bucket =>
            {
                var chargedTotal = bucket.Where(m => m.Type != CajaMovementType.Refund).Sum(m => m.Amount)
                    - bucket.Where(m => m.Type == CajaMovementType.Refund).Sum(m => m.Amount);

                var commissionAmount = bucket
                    .GroupBy(m => m.ProfessionalId)
                    .Sum(byProfessional =>
                    {
                        var professionalCharged = byProfessional.Where(m => m.Type != CajaMovementType.Refund).Sum(m => m.Amount)
                            - byProfessional.Where(m => m.Type == CajaMovementType.Refund).Sum(m => m.Amount);
                        var rate = professionalRates.TryGetValue(byProfessional.Key, out var r) ? r : 0m;
                        return professionalCharged * (rate / 100m);
                    });

                return new BusinessEarningsPeriod(bucket.Key, chargedTotal, commissionAmount);
            })
            .OrderBy(p => p.PeriodStart)
            .ToList();
    }

    private static DateTime BucketStart(DateTime dt, EarningsGranularity granularity) => granularity switch
    {
        EarningsGranularity.Month => new DateTime(dt.Year, dt.Month, 1),
        EarningsGranularity.Week => dt.Date.AddDays(-((7 + (dt.DayOfWeek - DayOfWeek.Monday)) % 7)),
        _ => dt.Date
    };
}
