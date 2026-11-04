using Microsoft.EntityFrameworkCore;
using Turneo.Api.Modules.HomeService.TravelBuffer;

namespace Turneo.Api.Core.Scheduling;

// The time a booking occupies, as stored: used to recompute the IsAvailable
// flag of the slots it overlaps after it is created, moved, edited or cancelled.
public readonly record struct BookingFootprint(int TimeSlotId, int? ProfessionalId, DateTime Start, DateTime End)
{
    public static BookingFootprint Of(Booking booking) =>
        new(booking.TimeSlotId, booking.ProfessionalId, booking.StartDateTime, booking.EndDateTime);

    // A slot's own range: refreshes the slot (and those of its professional it overlaps).
    public static BookingFootprint OfSlot(TimeSlot slot) =>
        new(slot.Id, slot.ProfessionalId, slot.StartDateTime, slot.EndDateTime);
}

// What the listing needs from the requested service. Found = false only when
// a slug was given and matches no service of the tenant.
public readonly record struct ServiceBookingProfile(bool Found, int? DurationMinutes, bool AtHome)
{
    public static readonly ServiceBookingProfile None = new(true, null, false);
}

public readonly record struct BookableSlot(TimeSlot Slot, DateTime BookingEnd);

// Database side of the availability rule (AgendaSnapshot): loads the window a
// placement needs and keeps TimeSlot.IsAvailable in line with booking ranges.
// Every query runs under the tenant query filters.
public interface IBookingAvailability
{
    Task<ServiceBookingProfile> GetServiceProfileAsync(string? serviceSlug);

    // Start slots of the listing that pass the rule for the requested service.
    // An unassigned slot is evaluated for fallbackProfessionalId, the same
    // professional booking creation would store.
    Task<List<BookableSlot>> FilterBookableStartsAsync(IReadOnlyList<TimeSlot> slots, ServiceBookingProfile service, int? fallbackProfessionalId);

    Task<AvailabilityVerdict> CheckAsync(BookingCandidate candidate);

    // Serializes, until the current transaction ends, the booking writes of one
    // professional (null = the tenant's unassigned resource). Taken before the
    // slot claim: without it, two concurrent writes of the same professional
    // can deadlock (one waits on the other's slot row lock while refreshing,
    // the other on its uncommitted booking through the exclusion constraint).
    Task LockProfessionalAsync(int? professionalId);

    // Atomic claim of a start slot (exactly one concurrent caller wins). A
    // moving booking may also claim a slot that is unavailable only because its
    // own current range overlaps it.
    Task<bool> TryClaimStartSlotAsync(int timeSlotId, int? movingBookingId = null);

    // Recomputes IsAvailable of the slots each footprint overlaps (plus its own
    // slot): unavailable while any active booking occupies them, free otherwise.
    // Call after the booking change is saved, inside the same transaction.
    Task RefreshSlotAvailabilityAsync(params BookingFootprint[] footprints);

    // Slot id -> id of the active booking that occupies it (own or overlapping).
    Task<Dictionary<int, int>> GetOccupyingBookingIdsAsync(IReadOnlyCollection<TimeSlot> slots);
}

public class BookingAvailability : IBookingAvailability
{
    public const string NotCoveredMessage = "El servicio no entra en el horario disponible de la agenda";

    private readonly ApplicationDbContext _context;
    private readonly ICurrentTenant _currentTenant;

    public BookingAvailability(ApplicationDbContext context, ICurrentTenant currentTenant)
    {
        _context = context;
        _currentTenant = currentTenant;
    }

    // Every rejection is a 409 like the other "that time is not available" answers.
    public static string MessageFor(AvailabilityVerdict verdict) => verdict switch
    {
        AvailabilityVerdict.Overlap => BookingWriteConflict.OverlapMessage,
        AvailabilityVerdict.NotCovered => NotCoveredMessage,
        AvailabilityVerdict.InsideTravelBuffer => HomeServiceTravelBuffer.InsideBufferMessage,
        _ => throw new ArgumentOutOfRangeException(nameof(verdict), verdict, "Not a rejection")
    };

    public static AgendaSlot ToAgendaSlot(TimeSlot slot) =>
        new(slot.Id, slot.ProfessionalId, slot.StartDateTime, slot.EndDateTime, slot.IsBlocked);

    public async Task<ServiceBookingProfile> GetServiceProfileAsync(string? serviceSlug)
    {
        var slug = serviceSlug?.Trim();
        if (string.IsNullOrEmpty(slug))
            return ServiceBookingProfile.None;

        var service = await _context.Services
            .AsNoTracking()
            .Where(s => s.Slug == slug)
            .Select(s => new { s.DurationMinutes, s.LocationType })
            .FirstOrDefaultAsync();

        return service is null
            ? new ServiceBookingProfile(false, null, false)
            : new ServiceBookingProfile(true, service.DurationMinutes, service.LocationType == ServiceLocationType.AtHome);
    }

    public async Task<List<BookableSlot>> FilterBookableStartsAsync(IReadOnlyList<TimeSlot> slots, ServiceBookingProfile service, int? fallbackProfessionalId)
    {
        if (slots.Count == 0)
            return new List<BookableSlot>();

        var candidates = slots
            .Select(slot => new
            {
                Slot = slot,
                Candidate = new BookingCandidate(
                    ToAgendaSlot(slot),
                    slot.ProfessionalId ?? fallbackProfessionalId,
                    BookingTimeRange.From(slot.StartDateTime, slot.EndDateTime, service.DurationMinutes).End,
                    service.AtHome)
            })
            .ToList();

        var snapshot = await LoadSnapshotAsync(
            candidates.Min(c => c.Candidate.Start),
            candidates.Max(c => c.Candidate.End));

        return candidates
            .Where(c => snapshot.Evaluate(c.Candidate) == AvailabilityVerdict.Available)
            .Select(c => new BookableSlot(c.Slot, c.Candidate.End))
            .ToList();
    }

    public async Task<AvailabilityVerdict> CheckAsync(BookingCandidate candidate) =>
        (await LoadSnapshotAsync(candidate.Start, candidate.End)).Evaluate(candidate);

    // Two-int advisory key (tenant, COALESCE(professional, 0)), the same resource
    // as the exclusion constraint; released at commit or rollback.
    public Task LockProfessionalAsync(int? professionalId) =>
        _context.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock({_currentTenant.TenantId}, {professionalId ?? 0})");

    public async Task<bool> TryClaimStartSlotAsync(int timeSlotId, int? movingBookingId = null)
    {
        var slots = _context.TimeSlots.Where(t => t.Id == timeSlotId && !t.IsBlocked);

        slots = movingBookingId is null
            ? slots.Where(t => t.IsAvailable)
            : slots.Where(t => t.IsAvailable
                || (_context.Bookings.Any(b => b.Id == movingBookingId
                        && b.ProfessionalId == t.ProfessionalId
                        && b.StartDateTime < t.EndDateTime && b.EndDateTime > t.StartDateTime)
                    && !_context.Bookings.Any(b => b.Id != movingBookingId
                        && b.Status != BookingStatus.Cancelled
                        && (b.TimeSlotId == t.Id
                            || (b.ProfessionalId == t.ProfessionalId
                                && b.StartDateTime < t.EndDateTime && b.EndDateTime > t.StartDateTime)))));

        return await slots.ExecuteUpdateAsync(s => s.SetProperty(t => t.IsAvailable, false)) == 1;
    }

    public async Task RefreshSlotAvailabilityAsync(params BookingFootprint[] footprints)
    {
        var slotIds = new HashSet<int>();
        foreach (var footprint in footprints)
        {
            var (ownSlotId, professionalId, start, end) = footprint;
            slotIds.UnionWith(await _context.TimeSlots
                .Where(t => t.Id == ownSlotId
                    || (t.ProfessionalId == professionalId && t.StartDateTime < end && t.EndDateTime > start))
                .Select(t => t.Id)
                .ToListAsync());
        }

        if (slotIds.Count == 0)
            return;

        // Same occupancy as AgendaSnapshot.OccupyingBookingId.
        await _context.TimeSlots
            .Where(t => slotIds.Contains(t.Id))
            .Where(t => _context.Bookings.Any(b => b.Status != BookingStatus.Cancelled
                && (b.TimeSlotId == t.Id
                    || (b.ProfessionalId == t.ProfessionalId
                        && b.StartDateTime < t.EndDateTime && b.EndDateTime > t.StartDateTime))))
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.IsAvailable, false));

        await _context.TimeSlots
            .Where(t => slotIds.Contains(t.Id))
            .Where(t => !_context.Bookings.Any(b => b.Status != BookingStatus.Cancelled
                && (b.TimeSlotId == t.Id
                    || (b.ProfessionalId == t.ProfessionalId
                        && b.StartDateTime < t.EndDateTime && b.EndDateTime > t.StartDateTime))))
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.IsAvailable, true));
    }

    public async Task<Dictionary<int, int>> GetOccupyingBookingIdsAsync(IReadOnlyCollection<TimeSlot> slots)
    {
        if (slots.Count == 0)
            return new Dictionary<int, int>();

        var from = slots.Min(s => s.StartDateTime);
        var to = slots.Max(s => s.EndDateTime);
        var slotIds = slots.Select(s => s.Id).ToList();
        var bookings = await ActiveBookings()
            .Where(b => (b.StartDateTime < to && b.EndDateTime > from) || slotIds.Contains(b.TimeSlotId))
            .Select(b => new OccupiedRange(b.Id, b.ProfessionalId, b.StartDateTime, b.EndDateTime, b.HomeServiceSurcharge != null, b.TimeSlotId))
            .ToListAsync();
        var snapshot = new AgendaSnapshot([], bookings, [], TimeSpan.Zero);

        var occupied = new Dictionary<int, int>();
        foreach (var slot in slots)
        {
            if (snapshot.OccupyingBookingId(ToAgendaSlot(slot)) is int bookingId)
                occupied[slot.Id] = bookingId;
        }
        return occupied;
    }

    // Everything the rule needs around [from, to): the travel buffer widens the
    // window so neighbouring at-home bookings are seen.
    private async Task<AgendaSnapshot> LoadSnapshotAsync(DateTime from, DateTime to)
    {
        var buffer = await GetTravelBufferAsync();
        var windowStart = from - buffer;
        var windowEnd = to + buffer;

        var bookings = await ActiveBookings()
            .Where(b => b.StartDateTime < windowEnd && b.EndDateTime > windowStart)
            .Select(b => new OccupiedRange(b.Id, b.ProfessionalId, b.StartDateTime, b.EndDateTime, b.HomeServiceSurcharge != null, b.TimeSlotId))
            .ToListAsync();

        var slots = await _context.TimeSlots
            .AsNoTracking()
            .Where(t => t.StartDateTime < to && t.EndDateTime > from)
            .Select(t => new AgendaSlot(t.Id, t.ProfessionalId, t.StartDateTime, t.EndDateTime, t.IsBlocked))
            .ToListAsync();

        var firstDay = from.Date;
        var lastDay = to.Date;
        var blockedDays = await _context.BlockedDates
            .AsNoTracking()
            .Where(d => d.Date >= firstDay && d.Date <= lastDay)
            .Select(d => new BlockedDay(d.Date, d.ProfessionalId))
            .ToListAsync();

        return new AgendaSnapshot(slots, bookings, blockedDays, buffer);
    }

    private IQueryable<Booking> ActiveBookings() =>
        _context.Bookings.AsNoTracking().Where(b => b.Status != BookingStatus.Cancelled);

    // Same setting HomeServiceTravelBuffer reads (first row by id, default when absent).
    private async Task<TimeSpan> GetTravelBufferAsync()
    {
        var minutes = await _context.BusinessSettings
            .AsNoTracking()
            .OrderBy(s => s.Id)
            .Select(s => (int?)s.HomeServiceTravelBufferMinutes)
            .FirstOrDefaultAsync();
        return TimeSpan.FromMinutes(minutes ?? BusinessSettings.DefaultHomeServiceTravelBufferMinutes);
    }
}
