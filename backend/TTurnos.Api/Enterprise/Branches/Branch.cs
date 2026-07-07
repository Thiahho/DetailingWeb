namespace TTurnos.Api.Enterprise.Branches;

// Sucursal física de un tenant. Opcional: un tenant de una sola ubicación
// simplemente no tiene filas acá — Core no depende de que exista una Branch.
public class Branch : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }

    public required string Name { get; set; }
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
