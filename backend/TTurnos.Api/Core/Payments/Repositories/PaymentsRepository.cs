using Microsoft.EntityFrameworkCore;

namespace TTurnos.Api.Core.Payments;

public class PaymentsRepository : IPaymentsRepository
{
    private readonly ApplicationDbContext _context;

    public PaymentsRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<Booking?> GetBookingWithPaymentAsync(int bookingId) =>
        _context.Bookings
            .Include(b => b.TimeSlot)
            .Include(b => b.Payment)
            .FirstOrDefaultAsync(b => b.Id == bookingId);

    public Task<Service?> GetServiceBySlugAsync(string? slug) =>
        _context.Services.FirstOrDefaultAsync(s => s.Slug == slug);

    public void AddPayment(Payment payment) => _context.Payments.Add(payment);

    public Task<Payment?> GetPaymentByBookingIgnoringTenantAsync(int bookingId) =>
        _context.Payments
            .IgnoreQueryFilters()
            .Include(p => p.Booking)
            .FirstOrDefaultAsync(p => p.BookingId == bookingId);

    public Task<Booking?> GetBookingByIdIgnoringTenantAsync(int bookingId) =>
        _context.Bookings.IgnoreQueryFilters().FirstOrDefaultAsync(b => b.Id == bookingId);

    public Task<Payment?> GetPaymentByBookingAsync(int bookingId) =>
        _context.Payments.FirstOrDefaultAsync(p => p.BookingId == bookingId);

    public Task<List<AdminPaymentListItem>> GetAllWithBookingAsync() =>
        _context.Payments
            .Include(p => p.Booking)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new AdminPaymentListItem(
                p.Id,
                p.BookingId,
                p.Booking.CustomerName,
                p.Booking.Service,
                p.Amount,
                p.Currency,
                p.Status,
                p.Provider,
                p.PaymentMethod,
                p.PaidAt,
                p.CreatedAt))
            .ToListAsync();

    public Task<int> SaveChangesAsync() => _context.SaveChangesAsync();
}
