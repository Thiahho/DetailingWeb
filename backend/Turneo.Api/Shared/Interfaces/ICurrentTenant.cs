namespace Turneo.Api.Shared.Interfaces;

// Implementada por Infrastructure/MultiTenancy/CurrentTenantService, scoped por request.
// La consume ApplicationDbContext para aplicar el query filter global por TenantId.
public interface ICurrentTenant
{
    int TenantId { get; }
    bool IsResolved { get; }
}
