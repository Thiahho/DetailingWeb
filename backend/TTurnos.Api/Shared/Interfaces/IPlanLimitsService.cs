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

    // true si el Feature (Boolean) está habilitado para el plan del tenant
    // actual. Mismo fail-open: sin plan asignado o sin fila para ese feature
    // → true (no bloquea).
    Task<bool> IsFeatureEnabledAsync(string featureKey);

    // Misma lógica que IsFeatureEnabledAsync, pero para un tenant explícito en
    // vez del tenant ambiental — necesario en flujos que no dependen de
    // ICurrentTenant (ej. background jobs que procesan bookings de todos los
    // tenants con IgnoreQueryFilters, identificando el tenant por el dato en
    // sí, no por el request).
    Task<bool> IsFeatureEnabledAsync(int tenantId, string featureKey);
}
