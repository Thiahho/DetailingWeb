namespace Turneo.Api.SaaS.Licenses;

// Solo aplica al modelo comercial License (compra perpetua del software).
public class License : ITenantScoped
{
    public int Id { get; set; }

    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }

    public required string LicenseKey { get; set; }

    public DateTime PurchasedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SupportExpiresAt { get; set; }
}
