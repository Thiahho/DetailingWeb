using System.ComponentModel.DataAnnotations.Schema;

namespace Turneo.Api.Core.Clients;

public static class AccessCodePurposes
{
    public const string ClientAccess = "ClientAccess";
    public const string ProfessionalRegistration = "ProfessionalRegistration";
}

[Table("ClientAccessCodes")]
public class ClientAccessCode : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public string Email { get; set; } = string.Empty;
    public string CodeHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UsedAt { get; set; }
    // Para qué sirve el código: un OTP de "Mis turnos" no debe poder usarse para
    // registrar un profesional, ni al revés. Ver AccessCodePurposes.
    public string Purpose { get; set; } = AccessCodePurposes.ClientAccess;
    // Verificaciones fallidas contra este código: al llegar al máximo queda inservible.
    public int FailedAttempts { get; set; }
}
