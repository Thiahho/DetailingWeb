namespace Turneo.Api.Modules.HomeService.BookingAddress;

// Client address sent with a public booking. Only read when the booked service
// is AtHome; for OnSite services it is ignored entirely. No DataAnnotations on
// purpose: an invalid address for an OnSite service must not reject the
// booking, so HomeServiceBookingPolicy validates it only when it applies.
public class HomeServiceAddressRequest
{
    // Street and number, e.g. "Av. Mitre 1234".
    public string? Street { get; set; }

    // Floor / apartment.
    public string? Details { get; set; }

    // Free-text indications for the professional (gate, doorbell, parking).
    public string? Notes { get; set; }

    public int? CoverageLocalityId { get; set; }
}
