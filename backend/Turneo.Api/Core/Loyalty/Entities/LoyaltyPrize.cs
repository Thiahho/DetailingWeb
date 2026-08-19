namespace Turneo.Api.Core.Loyalty;

// Premio de la ruleta de fidelización que cada NEGOCIO arma para SUS propios
// clientes — no confundir con Marketing.Roulette.RoulettePrize (esa es la
// ruleta de captación de leads de Turneo, global y sin TenantId). Acá cada
// tenant configura su propio catálogo desde /admin para fidelizar clientes
// y subir su ticket promedio.
public class LoyaltyPrize : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }

    public required string Name { get; set; }
    public string? Description { get; set; }
    public LoyaltyPrizeType Type { get; set; }

    // % de descuento, valor del producto, etc. según Type — nullable porque no
    // todos los tipos tienen un valor numérico (ej. "2x1").
    public decimal? Value { get; set; }

    // 0-100, la suma de los premios activos debería dar 100 (no se fuerza en
    // la API, el admin lo ve reflejado en la rueda al guardar).
    public decimal Probability { get; set; }
    public int ValidityDays { get; set; } = 30;

    public bool IsActive { get; set; } = true;
    public int Order { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
