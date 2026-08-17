using System.ComponentModel.DataAnnotations;

namespace Turneo.Api.Core.Clients;

// Al menos uno de Email/Phone es obligatorio: es lo que se usa para
// encontrar los registros a anonimizar (CustomerProfile/Booking/LoyaltySpin).
public record CreateDataDeletionRequest(
    [Required, StringLength(150, MinimumLength = 1)] string ContactName,
    [EmailAddress, StringLength(256)] string? ContactEmail,
    [StringLength(30)] string? ContactPhone,
    [StringLength(500)] string? Note
) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (string.IsNullOrWhiteSpace(ContactEmail) && string.IsNullOrWhiteSpace(ContactPhone))
        {
            yield return new ValidationResult(
                "Tenés que indicar al menos un email o un teléfono para poder encontrar tus datos.",
                new[] { nameof(ContactEmail), nameof(ContactPhone) });
        }
    }
}

public record ResolveDataDeletionRequest(
    [StringLength(500)] string? ResolutionNote
);

public record DataDeletionRequestResponse(
    int Id,
    string ContactName,
    string? ContactEmail,
    string? ContactPhone,
    string? Note,
    string Status,
    DateTime RequestedAt,
    DateTime? ResolvedAt,
    string? ResolutionNote
);
