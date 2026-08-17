using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Turneo.Api.Migrations
{
    /// <inheritdoc />
    // Segunda capa de aislamiento por tenant, a nivel de Postgres — complementa
    // (no reemplaza) los global query filters de EF Core. Ver
    // Infrastructure/Persistence/TenantSessionInterceptor.cs, que fija
    // "app.tenant_id" en la sesión antes de cada query, y CurrentTenantService,
    // que decide si esa sesión es un tenant real o 'bypass' (webhooks públicos,
    // jobs cross-tenant, panel de PlatformOwner).
    public partial class EnableRowLevelSecurity : Migration
    {
        // Todas las tablas con HasQueryFilter(e => e.TenantId == ...) en
        // ApplicationDbContext.OnModelCreating. Quedan afuera a propósito:
        // Tenants, Modules, TenantModules, Subscriptions, Licenses,
        // UsageRecords, Features, PlanFeatures (catálogo de plataforma, no de
        // un tenant) y RoulettePrizes/RouletteLeads (datos propios de Turneo
        // como negocio, no de sus tenants).
        private static readonly string[] TenantScopedTables =
        {
            "Branches", "Themes", "Treatments", "Users", "ModulePermissions",
            "TimeSlots", "Bookings", "ClientAccessCodes", "NotificationLogs",
            "BlockedDates", "Services", "GalleryItems", "Professionals",
            "ContentVideos", "Payments", "Products", "Insumos", "ServiceInsumos",
            "BookingItems", "CajaSessions", "CajaMovements", "BusinessSettings",
            "SiteConfigs", "CustomerProfiles", "ScheduledReminders", "ReminderLogs",
            "AutomationRules", "AutomationRuleExecutions", "SmartTags", "SmartTagEvents"
        };

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            foreach (var table in TenantScopedTables)
            {
                migrationBuilder.Sql($"ALTER TABLE \"{table}\" ENABLE ROW LEVEL SECURITY;");

                // Sin esto, el owner de la tabla (el mismo rol que usa la app
                // para conectarse) queda EXENTO de RLS por default de Postgres —
                // la policy existiría pero no haría absolutamente nada.
                migrationBuilder.Sql($"ALTER TABLE \"{table}\" FORCE ROW LEVEL SECURITY;");

                migrationBuilder.Sql($@"
                    CREATE POLICY tenant_isolation ON ""{table}""
                        FOR ALL
                        USING (
                            current_setting('app.tenant_id', true) = 'bypass'
                            OR ""TenantId""::text = current_setting('app.tenant_id', true)
                        )
                        WITH CHECK (
                            current_setting('app.tenant_id', true) = 'bypass'
                            OR ""TenantId""::text = current_setting('app.tenant_id', true)
                        );");
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var table in TenantScopedTables)
            {
                migrationBuilder.Sql($"DROP POLICY IF EXISTS tenant_isolation ON \"{table}\";");
                migrationBuilder.Sql($"ALTER TABLE \"{table}\" NO FORCE ROW LEVEL SECURITY;");
                migrationBuilder.Sql($"ALTER TABLE \"{table}\" DISABLE ROW LEVEL SECURITY;");
            }
        }
    }
}
