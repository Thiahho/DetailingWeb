namespace TTurnos.Api.SaaS.Plans;

public class Plan
{
    public int Id { get; set; }

    // Starter, Pro, Premium, Enterprise, License, Custom
    public required string Name { get; set; }

    public decimal? PriceMonthly { get; set; }
    public decimal? PriceYearly { get; set; }

    // Límites y feature flags (CanUseWhatsapp, MaxProfessionals, ...) viven en
    // SaaS/Features — no como columnas acá, para no migrar el schema cada vez
    // que se agrega o cambia un límite.
    public bool IsActive { get; set; } = true;
}
