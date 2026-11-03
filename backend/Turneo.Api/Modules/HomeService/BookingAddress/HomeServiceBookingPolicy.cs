using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Modules.HomeService.BookingAddress;

// Address and locality data frozen on the booking for an at-home service.
public record HomeServiceAddressSnapshot(
    string Street,
    string? Details,
    string? Notes,
    int CoverageLocalityId,
    string LocalityName,
    string Province,
    decimal Surcharge)
{
    public void ApplyTo(Booking booking)
    {
        booking.HomeAddressStreet = Street;
        booking.HomeAddressDetails = Details;
        booking.HomeAddressNotes = Notes;
        booking.CoverageLocalityId = CoverageLocalityId;
        booking.CoverageLocalityName = LocalityName;
        booking.CoverageLocalityProvince = Province;
        booking.HomeServiceSurcharge = Surcharge;
    }

    // Removes every home-service field: the booking is performed on site.
    public static void ClearFrom(Booking booking)
    {
        booking.HomeAddressStreet = null;
        booking.HomeAddressDetails = null;
        booking.HomeAddressNotes = null;
        booking.CoverageLocalityId = null;
        booking.CoverageLocalityName = null;
        booking.CoverageLocalityProvince = null;
        booking.HomeServiceSurcharge = null;
    }
}

// Error = the booking must be rejected (400). KeepExisting = an edit leaves the
// booking's current snapshot untouched. Otherwise a null Snapshot means the
// service is performed on site and nothing is stored.
public record HomeServiceAddressResolution(HomeServiceAddressSnapshot? Snapshot, string? Error, bool KeepExisting = false)
{
    public static readonly HomeServiceAddressResolution OnSite = new(null, null);
    public static readonly HomeServiceAddressResolution Keep = new(null, null, KeepExisting: true);
    public static HomeServiceAddressResolution Reject(string error) => new(null, error);

    // Writes the outcome on an existing booking. Only valid when Error is null.
    public void ApplyTo(Booking booking)
    {
        if (Error is not null)
            throw new InvalidOperationException("A rejected home-service resolution cannot be applied.");
        if (KeepExisting)
            return;
        if (Snapshot is not null)
            Snapshot.ApplyTo(booking);
        else
            HomeServiceAddressSnapshot.ClearFrom(booking);
    }
}

public interface IHomeServiceBookingPolicy
{
    // Decides whether the booked service needs the client's address and, if so,
    // validates it against the current tenant's active coverage localities.
    Task<HomeServiceAddressResolution> ResolveAsync(string? serviceSlug, HomeServiceAddressRequest? address);

    // Same decision for an edit of an existing booking. When the resulting
    // service is AtHome and no address is sent, a booking that already has a
    // snapshot keeps it unchanged (editing other fields must not re-price it);
    // otherwise the address is required and validated exactly as on create.
    Task<HomeServiceAddressResolution> ResolveForUpdateAsync(string? serviceSlug, HomeServiceAddressRequest? address, Booking booking);
}

public class HomeServiceBookingPolicy : IHomeServiceBookingPolicy
{
    // Same limits as the Bookings columns (ApplicationDbContext).
    public const int StreetMaxLength = 200;
    public const int DetailsMaxLength = 100;
    public const int NotesMaxLength = 500;

    public const string MissingStreetMessage = "Ingresá la dirección (calle y número) para el servicio a domicilio";
    public const string MissingLocalityMessage = "Elegí la localidad del servicio a domicilio";
    public const string TooLongMessage = "La dirección supera el largo permitido";
    public const string OutOfCoverageMessage = "La localidad elegida está fuera de la zona de cobertura";

    private readonly ApplicationDbContext _context;

    public HomeServiceBookingPolicy(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<HomeServiceAddressResolution> ResolveAsync(string? serviceSlug, HomeServiceAddressRequest? address)
    {
        // Same lookup as the promotion quote and the payment amount: the booking
        // stores the service slug. Unknown slug = on site, as before this feature.
        if (string.IsNullOrWhiteSpace(serviceSlug))
            return HomeServiceAddressResolution.OnSite;

        if (!await IsAtHomeAsync(serviceSlug))
            return HomeServiceAddressResolution.OnSite;

        var street = address?.Street?.Trim();
        if (string.IsNullOrEmpty(street))
            return HomeServiceAddressResolution.Reject(MissingStreetMessage);

        if (address!.CoverageLocalityId is not int localityId)
            return HomeServiceAddressResolution.Reject(MissingLocalityMessage);

        var details = NullIfBlank(address.Details);
        var notes = NullIfBlank(address.Notes);
        if (street.Length > StreetMaxLength
            || details?.Length > DetailsMaxLength
            || notes?.Length > NotesMaxLength)
            return HomeServiceAddressResolution.Reject(TooLongMessage);

        // The tenant query filter makes another tenant's locality invisible, so
        // unknown, foreign and inactive ids all get the same answer.
        var locality = await _context.CoverageLocalities
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == localityId && c.IsActive);
        if (locality == null)
            return HomeServiceAddressResolution.Reject(OutOfCoverageMessage);

        return new HomeServiceAddressResolution(
            new HomeServiceAddressSnapshot(
                street, details, notes,
                locality.Id, locality.Name, locality.Province,
                locality.Surcharge ?? 0m),
            null);
    }

    public async Task<HomeServiceAddressResolution> ResolveForUpdateAsync(string? serviceSlug, HomeServiceAddressRequest? address, Booking booking)
    {
        // HomeServiceSurcharge is null only when the booking has no snapshot.
        if (address is null
            && booking.HomeServiceSurcharge is not null
            && !string.IsNullOrWhiteSpace(serviceSlug)
            && await IsAtHomeAsync(serviceSlug))
            return HomeServiceAddressResolution.Keep;

        return await ResolveAsync(serviceSlug, address);
    }

    private Task<bool> IsAtHomeAsync(string serviceSlug) =>
        _context.Services.AnyAsync(s => s.Slug == serviceSlug && s.LocationType == ServiceLocationType.AtHome);

    private static string? NullIfBlank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
