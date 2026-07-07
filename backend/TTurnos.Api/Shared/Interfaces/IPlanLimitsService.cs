namespace TTurnos.Api.Shared.Interfaces;

// Implementada en SaaS/Features/PlanLimitsService. Core depende SOLO de esta
// abstracción — nunca de SaaS directamente (regla de dependencias: Core no
// puede importar SaaS, ver README).
public interface IPlanLimitsService
{
    // true si currentCount todavía entra dentro del límite del Feature para
    // el plan del tenant actual. Fail-open (devuelve true) si el tenant no
    // tiene plan asignado o el plan no tiene ese feature configurado.
    Task<bool> IsWithinLimitAsync(string featureKey, int currentCount);
}
