using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Modules.HomeService.TravelBuffer;

// Travel time between at-home bookings: a professional who works at the
// client's address needs the business's travel buffer (BusinessSettings,
// default 30 min, 0 disables it) between two active at-home bookings.
// On-site bookings never take part in the rule. Every query runs under the
// tenant query filters, so only the current tenant's bookings count.
public interface IHomeServiceTravelBuffer
{
    Task<bool> IsAtHomeServiceAsync(string? serviceSlug);

    // Removes the slots that would leave less than the buffer before or after an
    // active at-home booking of the slot's professional. An unassigned slot uses
    // fallbackProfessionalId, the same professional booking creation would store.
    Task<List<TimeSlot>> ExcludeSlotsInsideBufferAsync(IReadOnlyList<TimeSlot> slots, int? fallbackProfessionalId);

    // True when an at-home booking placed on the slot would break the buffer.
    // excludeBookingId leaves out the booking being moved or edited.
    Task<bool> IsSlotInsideBufferAsync(int timeSlotId, int? fallbackProfessionalId, int? excludeBookingId = null);
}

public class HomeServiceTravelBuffer : IHomeServiceTravelBuffer
{
    public const string InsideBufferMessage = "Ese horario no deja tiempo de traslado con otro turno a domicilio";

    private readonly ApplicationDbContext _context;

    public HomeServiceTravelBuffer(ApplicationDbContext context)
    {
        _context = context;
    }

    // A slot is inside the buffer when it starts less than `buffer` after the
    // other booking ends and ends less than `buffer` before it starts.
    public static bool IsInsideBuffer(DateTime start, DateTime end, DateTime otherStart, DateTime otherEnd, TimeSpan buffer) =>
        buffer > TimeSpan.Zero && start < otherEnd + buffer && end > otherStart - buffer;

    public async Task<bool> IsAtHomeServiceAsync(string? serviceSlug) =>
        !string.IsNullOrWhiteSpace(serviceSlug)
        && await _context.Services.AnyAsync(s => s.Slug == serviceSlug && s.LocationType == ServiceLocationType.AtHome);

    public async Task<List<TimeSlot>> ExcludeSlotsInsideBufferAsync(IReadOnlyList<TimeSlot> slots, int? fallbackProfessionalId)
    {
        var buffer = await GetBufferAsync();
        if (buffer <= TimeSpan.Zero || slots.Count == 0)
            return slots.ToList();

        var from = slots.Min(s => s.StartDateTime) - buffer;
        var to = slots.Max(s => s.EndDateTime) + buffer;
        var bookings = await ToTimes(ActiveAtHomeBookings(from, to)).ToListAsync();

        return slots
            .Where(slot =>
            {
                var professionalId = slot.ProfessionalId ?? fallbackProfessionalId;
                return !bookings.Any(b =>
                    b.ProfessionalId == professionalId
                    && IsInsideBuffer(slot.StartDateTime, slot.EndDateTime, b.Start, b.End, buffer));
            })
            .ToList();
    }

    public async Task<bool> IsSlotInsideBufferAsync(int timeSlotId, int? fallbackProfessionalId, int? excludeBookingId = null)
    {
        var buffer = await GetBufferAsync();
        if (buffer <= TimeSpan.Zero)
            return false;

        var slot = await _context.TimeSlots.AsNoTracking().FirstOrDefaultAsync(t => t.Id == timeSlotId);
        if (slot == null)
            return false;

        var professionalId = slot.ProfessionalId ?? fallbackProfessionalId;
        var bookings = await ToTimes(ActiveAtHomeBookings(slot.StartDateTime - buffer, slot.EndDateTime + buffer)
                .Where(b => b.ProfessionalId == professionalId && b.Id != excludeBookingId))
            .ToListAsync();

        return bookings.Any(b => IsInsideBuffer(slot.StartDateTime, slot.EndDateTime, b.Start, b.End, buffer));
    }

    private async Task<TimeSpan> GetBufferAsync()
    {
        var minutes = await _context.BusinessSettings
            .AsNoTracking()
            .OrderBy(s => s.Id)
            .Select(s => (int?)s.HomeServiceTravelBufferMinutes)
            .FirstOrDefaultAsync();
        return TimeSpan.FromMinutes(minutes ?? BusinessSettings.DefaultHomeServiceTravelBufferMinutes);
    }

    // HomeServiceSurcharge is set only on at-home bookings (address snapshot).
    private IQueryable<Booking> ActiveAtHomeBookings(DateTime from, DateTime to) =>
        _context.Bookings
            .AsNoTracking()
            .Where(b => b.Status != BookingStatus.Cancelled && b.HomeServiceSurcharge != null)
            .Where(b => b.TimeSlot.StartDateTime < to && b.TimeSlot.EndDateTime > from);

    private static IQueryable<AtHomeBookingTime> ToTimes(IQueryable<Booking> bookings) =>
        bookings.Select(b => new AtHomeBookingTime(b.ProfessionalId, b.TimeSlot.StartDateTime, b.TimeSlot.EndDateTime));

    private sealed record AtHomeBookingTime(int? ProfessionalId, DateTime Start, DateTime End);
}
