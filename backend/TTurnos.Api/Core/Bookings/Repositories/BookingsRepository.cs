using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace TTurnos.Api.Core.Bookings;

public class BookingsRepository : IBookingsRepository
{
    private readonly ApplicationDbContext _context;

    public BookingsRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<bool> ProfessionalIsActiveAsync(int professionalId) =>
        _context.Professionals.AnyAsync(p => p.Id == professionalId && p.IsActive);

    public Task<IDbContextTransaction> BeginTransactionAsync() =>
        _context.Database.BeginTransactionAsync();

    public Task<int> TryClaimSlotAsync(int timeSlotId) =>
        _context.TimeSlots
            .Where(t => t.Id == timeSlotId && t.IsAvailable)
            .ExecuteUpdateAsync(setters => setters.SetProperty(t => t.IsAvailable, false));

    public Task ReleaseSlotAsync(int timeSlotId) =>
        _context.TimeSlots
            .Where(t => t.Id == timeSlotId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(t => t.IsAvailable, true));

    public Task<bool> SlotExistsAsync(int timeSlotId) =>
        _context.TimeSlots.AnyAsync(t => t.Id == timeSlotId);

    public Task<TimeSlot> GetSlotSnapshotAsync(int timeSlotId) =>
        _context.TimeSlots.AsNoTracking().FirstAsync(t => t.Id == timeSlotId);

    public void Add(Booking booking) => _context.Bookings.Add(booking);

    public Task<List<AdminBookingListItem>> GetAllWithDetailsAsync() =>
        _context.Bookings
            .Include(b => b.TimeSlot)
            .Include(b => b.Payment)
            .Include(b => b.Professional)
            .Include(b => b.Items)
            .GroupJoin(
                _context.NotificationLogs,
                b => b.Id,
                n => n.BookingId,
                (b, logs) => new { Booking = b, Logs = logs })
            .OrderByDescending(x => x.Booking.CreatedAt)
            .Select(x => new AdminBookingListItem(
                x.Booking.Id,
                x.Booking.CustomerName,
                x.Booking.CustomerPhone,
                x.Booking.Email,
                x.Booking.Subject,
                x.Booking.Service,
                x.Booking.ProfessionalId,
                x.Booking.Professional != null ? x.Booking.Professional.FirstName + " " + x.Booking.Professional.LastName : null,
                x.Booking.CustomFieldsJson,
                x.Booking.Message,
                x.Booking.Status == BookingStatus.LegacyReserved ? BookingStatus.Pending : x.Booking.Status,
                x.Booking.TimeSlotId,
                x.Booking.TimeSlot.StartDateTime,
                x.Booking.TimeSlot.EndDateTime,
                x.Booking.TimeSlot.IsAvailable,
                x.Booking.CreatedAt,
                x.Booking.CancelledAt,
                x.Booking.Payment != null ? x.Booking.Payment.Status : null,
                x.Booking.Payment != null ? x.Booking.Payment.Amount : (decimal?)null,
                x.Booking.Payment != null ? x.Booking.Payment.PaidAt : (DateTime?)null,
                x.Booking.Payment != null ? x.Booking.Payment.Provider : null,
                x.Logs.Any(l => l.Status == NotificationDeliveryStatus.Failed)
                    ? NotificationDeliveryStatus.Failed
                    : x.Logs.Any(l => l.Status == NotificationDeliveryStatus.Pending)
                        ? NotificationDeliveryStatus.Pending
                        : x.Logs.Any(l => l.Status == NotificationDeliveryStatus.Sent)
                            ? NotificationDeliveryStatus.Sent
                            : NotificationDeliveryStatus.Pending,
                x.Logs
                    .OrderByDescending(l => l.CreatedAt)
                    .Select(l => new NotificationLogSummary(
                        l.Channel, l.EventType, l.Status, l.ProviderMessageId, l.ErrorMessage,
                        l.RetryCount, l.CreatedAt, l.LastAttemptAt))
                    .ToList(),
                x.Booking.PhotoUrlsBefore,
                x.Booking.PhotoUrlsAfter,
                x.Booking.Items
                    .Select(i => new BookingItemSummary(
                        i.Id, i.ItemType, i.ServiceId, i.ProductId, i.InsumoId, i.IsSale, i.Name, i.Quantity, i.UnitPrice))
                    .ToList()))
            .ToListAsync();

    public Task<List<MyBookingItem>> GetMineAsync(string? emailFilter)
    {
        var query = _context.Bookings.Include(b => b.TimeSlot).Include(b => b.Payment).AsQueryable();
        if (emailFilter != null)
            query = query.Where(b => b.CustomerEmailNormalized == emailFilter);

        return query
            .OrderByDescending(b => b.TimeSlot.StartDateTime)
            .Select(b => new MyBookingItem(
                b.Id,
                b.Status == BookingStatus.LegacyReserved ? BookingStatus.Pending : b.Status,
                b.CustomerName,
                b.Service,
                b.Subject,
                b.CustomFieldsJson,
                b.TimeSlot.StartDateTime,
                b.TimeSlot.EndDateTime,
                b.Status != BookingStatus.Cancelled && b.TimeSlot.EndDateTime > DateTime.UtcNow,
                b.Status != BookingStatus.Cancelled && b.TimeSlot.EndDateTime > DateTime.UtcNow,
                b.Payment != null ? b.Payment.Status : null,
                b.Payment != null ? b.Payment.Amount : (decimal?)null,
                b.Payment != null ? b.Payment.PaidAt : (DateTime?)null,
                b.Payment != null ? b.Payment.CheckoutUrl : null))
            .ToListAsync();
    }

    public Task<List<PublicBookingItem>> GetByEmailAsync(string normalizedEmail) =>
        _context.Bookings
            .Include(b => b.TimeSlot)
            .Where(b => b.CustomerEmailNormalized == normalizedEmail)
            .OrderByDescending(b => b.TimeSlot.StartDateTime)
            .Select(b => new PublicBookingItem(
                b.Id,
                b.Status == BookingStatus.LegacyReserved ? BookingStatus.Pending : b.Status,
                b.CustomerName,
                b.Service,
                b.Subject,
                b.CustomFieldsJson,
                b.TimeSlot.StartDateTime,
                b.TimeSlot.EndDateTime,
                b.Status != BookingStatus.Cancelled && b.TimeSlot.EndDateTime > DateTime.UtcNow,
                b.Status != BookingStatus.Cancelled && b.TimeSlot.EndDateTime > DateTime.UtcNow))
            .ToListAsync();

    public Task<Booking?> GetByIdWithTimeSlotAsync(int id) =>
        _context.Bookings.Include(b => b.TimeSlot).FirstOrDefaultAsync(b => b.Id == id);

    public Task<Booking?> FindAsync(int id) => _context.Bookings.FindAsync(id).AsTask();

    public Task LoadTimeSlotAsync(Booking booking) =>
        _context.Entry(booking).Reference(b => b.TimeSlot).LoadAsync();

    public Task<int> DeleteExpiredSlotsAsync(DateTime now) =>
        _context.TimeSlots.Where(t => t.EndDateTime < now).ExecuteDeleteAsync();

    public Task<Booking?> GetByIdWithItemsAsync(int id) =>
        _context.Bookings.Include(b => b.Items).FirstOrDefaultAsync(b => b.Id == id);

    public void RemoveItemRange(IEnumerable<BookingItem> items) => _context.BookingItems.RemoveRange(items);

    public void AddItemRange(IEnumerable<BookingItem> items) => _context.BookingItems.AddRange(items);

    public Task<int> SaveChangesAsync() => _context.SaveChangesAsync();
}
