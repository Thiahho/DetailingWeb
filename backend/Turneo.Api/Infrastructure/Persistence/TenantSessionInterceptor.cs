using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Turneo.Api.Infrastructure.Persistence;

// Segunda capa de aislamiento por tenant, a nivel de base de datos (Row Level
// Security de Postgres) — complementa, no reemplaza, el query filter global
// de EF Core en ApplicationDbContext.OnModelCreating. Cada vez que se abre
// una conexión lógica (por request, con un DbContext scoped-per-request,
// incluso si Npgsql reutiliza una conexión física del pool — el evento
// ConnectionOpened se dispara en cada Open() lógico) fija en la sesión de
// Postgres qué tenant puede ver, para que las policies definidas en la
// migración EnableRowLevelSecurity lo hagan cumplir aunque una query de la
// aplicación se olvide de filtrar por TenantId.
public class TenantSessionInterceptor : DbConnectionInterceptor
{
    private readonly ICurrentTenant _currentTenant;

    public TenantSessionInterceptor(ICurrentTenant currentTenant)
    {
        _currentTenant = currentTenant;
    }

    public override async Task ConnectionOpenedAsync(
        DbConnection connection,
        ConnectionEndEventData eventData,
        CancellationToken cancellationToken = default)
    {
        await SetSessionTenantAsync(connection, cancellationToken);
        await base.ConnectionOpenedAsync(connection, eventData, cancellationToken);
    }

    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        SetSessionTenantAsync(connection, CancellationToken.None).GetAwaiter().GetResult();
        base.ConnectionOpened(connection, eventData);
    }

    private async Task SetSessionTenantAsync(DbConnection connection, CancellationToken cancellationToken)
    {
        // "bypass" o el TenantId numérico — nunca texto arbitrario del usuario,
        // así que no hay riesgo de inyección al interpolarlo en el SET.
        var value = _currentTenant.IsBypassed ? "bypass" : _currentTenant.TenantId.ToString();

        await using var command = connection.CreateCommand();
        command.CommandText = $"SET app.tenant_id = '{value}'";
        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}
