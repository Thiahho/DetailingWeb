using Microsoft.EntityFrameworkCore.Storage;

namespace Turneo.Api.Core.Bookings;

public interface IBookingsRepository
{
    Task<bool> ProfessionalIsActiveAsync(int professionalId);
    Task<int> CountThisMonthAsync();
    Task<IDbContextTransaction> BeginTransactionAsync();
    Task<int> TryClaimSlotAsync(int timeSlotId);
    Task ReleaseSlotAsync(int timeSlotId);
    Task<bool> SlotExistsAsync(int timeSlotId);
    Task<TimeSlot> GetSlotSnapshotAsync(int timeSlotId);
    // DurationMinutes of the service with this slug in the current tenant (query
    // filter); null when the service has none or the slug matches no service.
    Task<int?> GetServiceDurationMinutesAsync(string? serviceSlug);
    void Add(Booking booking);
    Task<List<AdminBookingListItem>> GetAllWithDetailsAsync();
    // emailFilter null => sin filtro (Admin ve todo); no-null => solo las reservas de ese email (portal de cliente).
    Task<List<MyBookingItem>> GetMineAsync(string? emailFilter);
    Task<List<PublicBookingItem>> GetByEmailAsync(string normalizedEmail);
    Task<Booking?> GetByIdWithTimeSlotAsync(int id);
    Task<Booking?> FindAsync(int id);
    Task<bool> HasApprovedPaymentAsync(int bookingId);
    Task<Booking?> GetByIdWithTimeSlotAndPaymentAsync(int id);
    // Conditional update (Approved -> Refunded): only one concurrent caller wins.
    Task<bool> TryMarkPaymentRefundedAsync(int paymentId, DateTime refundedAt);
    Task LoadTimeSlotAsync(Booking booking);
    Task<int> DeleteExpiredSlotsAsync(DateTime now);
    Task<Booking?> GetByIdWithItemsAsync(int id);
    void RemoveItemRange(IEnumerable<BookingItem> items);
    void AddItemRange(IEnumerable<BookingItem> items);
    Task<int> SaveChangesAsync();
}

public record NotificationLogSummary(
    string Channel,
    string EventType,
    string Status,
    string? ProviderMessageId,
    string? ErrorMessage,
    int RetryCount,
    DateTime CreatedAt,
    DateTime? LastAttemptAt);

public record BookingItemSummary(
    int Id,
    string ItemType,
    int? ServiceId,
    int? ProductId,
    int? InsumoId,
    bool IsSale,
    string Name,
    int Quantity,
    decimal UnitPrice);

public record AdminBookingListItem(
    int Id,
    string CustomerName,
    string CustomerPhone,
    string? Email,
    string Subject,
    string? Service,
    int? ProfessionalId,
    string? ProfessionalName,
    string? CustomFieldsJson,
    string? Message,
    string Status,
    int TimeSlotId,
    DateTime StartDateTime,
    DateTime EndDateTime,
    bool IsAvailable,
    DateTime CreatedAt,
    DateTime? CancelledAt,
    string? PaymentStatus,
    decimal? PaymentAmount,
    DateTime? PaymentPaidAt,
    string? PaymentProvider,
    string NotificationStatus,
    List<NotificationLogSummary> NotificationLogs,
    string? PhotoUrlsBefore,
    string? PhotoUrlsAfter,
    List<BookingItemSummary> Items,
    HomeServiceAddressSummary? HomeServiceAddress,
    // Time the booking occupies (see BookingTimeRange). StartDateTime/EndDateTime
    // above are still the slot times until readers switch to this range.
    DateTime BookingStartDateTime,
    DateTime BookingEndDateTime);

// Address snapshot of an at-home booking (null for on-site bookings).
public record HomeServiceAddressSummary(
    string? Street,
    string? Details,
    string? Notes,
    int? CoverageLocalityId,
    string? LocalityName,
    string? Province,
    decimal? Surcharge);

public record MyBookingItem(
    int Id,
    string Status,
    string CustomerName,
    string? Service,
    string Subject,
    string? CustomFieldsJson,
    DateTime StartDateTime,
    DateTime EndDateTime,
    bool CanCancel,
    bool CanReschedule,
    string? PaymentStatus,
    decimal? PaymentAmount,
    DateTime? PaymentPaidAt,
    string? PaymentCheckoutUrl,
    DateTime BookingStartDateTime,
    DateTime BookingEndDateTime);

public record PublicBookingItem(
    int Id,
    string Status,
    string CustomerName,
    string? Service,
    string Subject,
    string? CustomFieldsJson,
    DateTime StartDateTime,
    DateTime EndDateTime,
    bool CanCancel,
    bool CanReschedule,
    DateTime BookingStartDateTime,
    DateTime BookingEndDateTime);
