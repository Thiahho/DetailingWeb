namespace Turneo.Api.Marketing.Roulette;

// No es tenant-scoped: es el catálogo de premios de la ruleta comercial de
// Turneo (marketing propio), no un dato de negocio de un tenant. Vive en la
// misma ApplicationDbContext que Tenant/Plan, sin query filter, igual que esos.
public class RoulettePrize
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public RoulettePrizeType Type { get; set; }

    // Meses gratis, % de descuento, etc. según Type — nullable porque no todos
    // los tipos de premio tienen un valor numérico (ej. "Demo personalizada").
    public decimal? Value { get; set; }
    public int? DurationMonths { get; set; }

    // 0-100, la suma de todos los premios activos debe dar 100 (se valida en el seed).
    public decimal Probability { get; set; }
    public int ValidityDays { get; set; } = 30;

    // Fragmento fijo para el código promocional (ej. "2MESES" en TURNEO-2MESES-X7K9).
    public required string CodeSlug { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
