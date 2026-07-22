namespace Turneo.Api.SaaS.Features;

// Catálogo de features/límites que un Plan puede otorgar (ej. "CanUseWhatsapp",
// "CanUseAI", "MaxProfessionals", "MaxBranches", "MaxBookings"). Agregar un
// límite nuevo es una fila acá, no una migración de schema en Plan.
public class Feature
{
    public int Id { get; set; }
    public required string Key { get; set; }
    public required string Name { get; set; }
    public FeatureType Type { get; set; }
    public string? Description { get; set; }
}
