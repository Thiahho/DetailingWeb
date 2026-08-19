namespace Turneo.Api.Core.Clients;

// Pedido de borrado/anonimización de datos personales (derecho de supresión,
// Ley 25.326 art. 16 / GDPR-like). El cliente final no tiene cuenta de
// usuario, así que el pedido lo carga por un formulario público sin
// autenticar y el negocio lo confirma manualmente antes de ejecutar —
// mismo criterio de "confirmación humana antes de una acción irreversible"
// que RequirePermission ya aplica en el resto del panel Admin.
public class DataDeletionRequest : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }

    public string ContactName { get; set; } = string.Empty;
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public string? Note { get; set; }

    public string Status { get; set; } = DataDeletionRequestStatus.Pending;
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }
    public int? ResolvedByUserId { get; set; }
    public string? ResolutionNote { get; set; }
}

public static class DataDeletionRequestStatus
{
    public const string Pending = "Pending";
    public const string Confirmed = "Confirmed";
    public const string Rejected = "Rejected";

    public static readonly string[] All = { Pending, Confirmed, Rejected };
}
