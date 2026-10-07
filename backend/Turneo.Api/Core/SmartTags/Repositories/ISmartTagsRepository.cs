namespace Turneo.Api.Core.SmartTags;

public interface ISmartTagsRepository
{
    Task<List<SmartTag>> GetAllAsync();
    Task<SmartTag?> GetByIdAsync(int id);

    // Genera y asigna el Token internamente (verificando unicidad) antes de insertar.
    Task<SmartTag> CreateAsync(SmartTag tag);

    Task<SmartTag?> UpdateAsync(int id, Action<SmartTag> apply);
    Task<SmartTag?> SetActiveAsync(int id, bool isActive);
    Task<bool> DeleteAsync(int id);

    // Cross-tenant a propósito: el Smart Link público (/api/smart/{token}) no
    // tiene tenant ambiental resuelto de forma confiable — el token identifica
    // al tenant sin ambigüedad. Mismo patrón que PaymentsRepository (webhook de
    // MercadoPago) y AutomationRulesRepository.GetActiveRulesCrossTenantAsync.
    // Devuelve null tanto si el token no existe como si el tag está inactivo
    // (el caller no debe distinguir los dos casos, ver docs/NFC.md sección 11).
    Task<SmartTag?> FindActiveByTokenIgnoringTenantAsync(string token);

    // Inserta el evento con TenantId explícito (el del SmartTag resuelto), sin
    // depender de ApplyTenantId/ICurrentTenant. source es el canal ya
    // normalizado (SmartTagSource.Normalize) o null si no se conoce.
    Task RecordEventAsync(int smartTagId, int tenantId, string action, string eventType, string? source = null);

    // Analytics (Fase 7): corren desde el admin autenticado, tenant ya resuelto
    // por el query filter normal — a diferencia de FindActiveByTokenIgnoringTenantAsync,
    // acá no hace falta IgnoreQueryFilters.
    Task<SmartTagAnalyticsRow?> GetAnalyticsForTagAsync(int smartTagId);
    Task<List<SmartTagAnalyticsRow>> GetAnalyticsSummaryAsync();
}
