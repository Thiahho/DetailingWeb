namespace TTurnos.Api.Core.Caja;

public interface ICajaRepository
{
    Task<CajaSession?> GetOpenSessionAsync();
    Task<CajaSession?> GetSessionWithMovementsAsync(int id);
    void AddSession(CajaSession session);
    void AddMovement(CajaMovement movement);
    Task<CajaMovement?> FindMovementAsync(int id);
    Task<List<CajaSession>> GetClosedSessionsInRangeAsync(DateTime from, DateTime to);
    Task<decimal> GetApprovedMercadoPagoTotalInRangeAsync(DateTime from, DateTime to);
    Task<List<PendingChargeBooking>> GetPendingChargeBookingsAsync(DateTime since);
    Task<int> SaveChangesAsync();
}

public record PendingChargeBooking(
    int BookingId,
    string CustomerName,
    string Subject,
    DateTime StartDateTime,
    decimal ItemsTotal,
    decimal AlreadyCharged);
