using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Core.Caja;

public class CajaRepository : ICajaRepository
{
    private readonly ApplicationDbContext _context;

    public CajaRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<CajaSession?> GetOpenSessionAsync() =>
        _context.CajaSessions
            .Include(s => s.Movements)
            .FirstOrDefaultAsync(s => s.Status == CajaSessionStatus.Open);

    public Task<CajaSession?> GetSessionWithMovementsAsync(int id) =>
        _context.CajaSessions.Include(s => s.Movements).FirstOrDefaultAsync(s => s.Id == id);

    public void AddSession(CajaSession session) => _context.CajaSessions.Add(session);

    public void AddMovement(CajaMovement movement) => _context.CajaMovements.Add(movement);

    public Task<CajaMovement?> FindMovementAsync(int id) => _context.CajaMovements.FindAsync(id).AsTask();

    public Task<List<CajaSession>> GetClosedSessionsInRangeAsync(DateTime from, DateTime to) =>
        _context.CajaSessions
            .Include(s => s.Movements)
            .Where(s => s.Status == CajaSessionStatus.Closed && s.ClosedAt >= from && s.ClosedAt < to)
            .OrderBy(s => s.ClosedAt)
            .ToListAsync();

    public async Task<decimal> GetApprovedMercadoPagoTotalInRangeAsync(DateTime from, DateTime to) =>
        await _context.Payments
            .Where(p => p.Status == PaymentStatus.Approved && p.PaidAt >= from && p.PaidAt < to)
            .SumAsync(p => (decimal?)p.Amount) ?? 0m;

    public async Task<List<PendingChargeBooking>> GetPendingChargeBookingsAsync(DateTime since)
    {
        var bookings = await _context.Bookings
            .Include(b => b.TimeSlot)
            .Include(b => b.Items)
            .Where(b => b.Status != BookingStatus.Cancelled && b.TimeSlot.StartDateTime >= since)
            .OrderBy(b => b.TimeSlot.StartDateTime)
            .Select(b => new
            {
                b.Id,
                b.CustomerName,
                b.Subject,
                StartDateTime = b.TimeSlot.StartDateTime,
                ItemsTotal = b.Items.Sum(i => (decimal?)(i.Quantity * i.UnitPrice)) ?? 0m
            })
            .ToListAsync();

        if (bookings.Count == 0)
            return new List<PendingChargeBooking>();

        var bookingIds = bookings.Select(b => b.Id).ToList();
        var chargedByBooking = await _context.CajaMovements
            .Where(m => m.BookingId != null && bookingIds.Contains(m.BookingId!.Value)
                && (m.Type == CajaMovementType.Charge || m.Type == CajaMovementType.Deposit || m.Type == CajaMovementType.Refund))
            .GroupBy(m => m.BookingId!.Value)
            .Select(g => new
            {
                BookingId = g.Key,
                Charged = g.Where(m => m.Type != CajaMovementType.Refund).Sum(m => (decimal?)m.Amount) ?? 0m,
                Refunded = g.Where(m => m.Type == CajaMovementType.Refund).Sum(m => (decimal?)m.Amount) ?? 0m
            })
            .ToDictionaryAsync(x => x.BookingId, x => x.Charged - x.Refunded);

        return bookings
            .Select(b => new PendingChargeBooking(
                b.Id,
                b.CustomerName,
                b.Subject,
                b.StartDateTime,
                b.ItemsTotal,
                chargedByBooking.TryGetValue(b.Id, out var charged) ? charged : 0m))
            .ToList();
    }

    public Task<int> SaveChangesAsync() => _context.SaveChangesAsync();
}
