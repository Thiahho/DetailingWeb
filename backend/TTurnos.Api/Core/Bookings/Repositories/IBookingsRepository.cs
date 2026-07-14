using Microsoft.EntityFrameworkCore.Storage;

namespace TTurnos.Api.Core.Bookings;

public interface IBookingsRepository
{
    Task<bool> ProfessionalIsActiveAsync(int professionalId);
    Task<IDbContextTransaction> BeginTransactionAsync();
    Task<int> TryClaimSlotAsync(int timeSlotId);
    Task ReleaseSlotAsync(int timeSlotId);
    Task<bool> SlotExistsAsync(int timeSlotId);
    Task<TimeSlot> GetSlotSnapshotAsync(int timeSlotId);
    void Add(Booking booking);
    Task<List<AdminBookingListItem>> GetAllWithDetailsAsync();
    // emailFilter null => sin filtro (Admin ve todo); no-null => solo las reservas de ese email (portal de cliente).
    Task<List<MyBookingItem>> GetMineAsync(string? emailFilter);
    Task<List<PublicBookingItem>> GetByEmailAsync(string normalizedEmail);
    Task<Booking?> GetByIdWithTimeSlotAsync(int id);
    Task<Booking?> FindAsync(int id);
    Task LoadTimeSlotAsync(Booking booking);
    Task<int> DeleteExpiredSlotsAsync(DateTime now);
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
    List<NotificationLogSummary> NotificationLogs);

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
    string? PaymentCheckoutUrl);

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
    bool CanReschedule);
