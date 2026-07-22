namespace Turneo.Api.Core.Payments;

public interface IPaymentsRepository
{
    Task<Booking?> GetBookingWithPaymentAsync(int bookingId);
    Task<Service?> GetServiceBySlugAsync(string? slug);
    void AddPayment(Payment payment);
    // IgnoreQueryFilters: el webhook de MercadoPago llega sin tenant ambiental resuelto
    // (no pasa por el proxy del frontend) — ver nota en el controller.
    Task<Payment?> GetPaymentByBookingIgnoringTenantAsync(int bookingId);
    Task<Booking?> GetBookingByIdIgnoringTenantAsync(int bookingId);
    Task<Payment?> GetPaymentByBookingAsync(int bookingId);
    Task<List<AdminPaymentListItem>> GetAllWithBookingAsync();
    Task<int> SaveChangesAsync();
}

public record AdminPaymentListItem(
    int Id,
    int BookingId,
    string CustomerName,
    string? Service,
    decimal Amount,
    string Currency,
    string Status,
    string Provider,
    string? PaymentMethod,
    DateTime? PaidAt,
    DateTime CreatedAt);
