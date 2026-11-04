using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Turneo.Api.Core.Bookings;

// Database rules on the time a booking occupies (migration
// AddBookingOverlapConstraint) translated into the answer a booking write
// returns. Anything else is not a booking time conflict and keeps throwing.
public static class BookingWriteConflict
{
    public const string OverlapConstraint = "EX_Bookings_ProfessionalTimeOverlap";
    public const string EndAfterStartConstraint = "CK_Bookings_EndAfterStart";

    public const string OverlapMessage = "Ese horario se superpone con otro turno del mismo profesional";
    public const string InvalidRangeMessage = "El horario del turno no es válido";

    // Status code and Spanish message for a failed booking save, or null when
    // the failure is not one of the booking time rules.
    public static (int StatusCode, string Message)? From(DbUpdateException exception) =>
        exception.InnerException switch
        {
            PostgresException { SqlState: PostgresErrorCodes.ExclusionViolation, ConstraintName: OverlapConstraint }
                => (StatusCodes.Status409Conflict, OverlapMessage),
            PostgresException { SqlState: PostgresErrorCodes.CheckViolation, ConstraintName: EndAfterStartConstraint }
                => (StatusCodes.Status400BadRequest, InvalidRangeMessage),
            _ => null
        };
}
