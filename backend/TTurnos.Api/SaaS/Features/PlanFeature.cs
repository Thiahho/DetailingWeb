namespace TTurnos.Api.SaaS.Features;

// Valor de un Feature para un Plan puntual. Value se interpreta según
// Feature.Type: "true"/"false" para Boolean, un número (como string) para
// Numeric. La ausencia de fila para un (Plan, Feature) significa "sin acceso"
// (Boolean) o "sin límite configurado" (Numeric) — a definir por quien
// consuma esto, no está forzado acá.
public class PlanFeature
{
    public int Id { get; set; }

    public int PlanId { get; set; }
    public Plan? Plan { get; set; }

    public int FeatureId { get; set; }
    public Feature? Feature { get; set; }

    public required string Value { get; set; }
}
