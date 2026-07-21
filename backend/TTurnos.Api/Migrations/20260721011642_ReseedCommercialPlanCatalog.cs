using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TTurnos.Api.Migrations
{
    // Reemplaza el catálogo placeholder (Starter/Pro/Premium/Enterprise/License/Custom)
    // por la propuesta comercial real (Free/Starter/Pro/Business/Licencia/Custom).
    // Segura de correr en cualquier ambiente: ningún Tenant tiene hoy un PlanId
    // no-nulo (confirmado antes de escribir esta migración), así que borrar y
    // recrear Plans/Features/PlanFeatures no deja ninguna FK huérfana.
    /// <inheritdoc />
    public partial class ReseedCommercialPlanCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DELETE FROM "PlanFeatures";
                DELETE FROM "Plans";
                DELETE FROM "Features";

                INSERT INTO "Features" ("Key", "Name", "Type", "Description") VALUES
                ('CanUseWhatsapp', 'Notificaciones por WhatsApp', 0, NULL),
                ('CanUseAI', 'Funciones con IA', 0, NULL),
                ('CanUseMercadoPago', 'Pagos con Mercado Pago', 0, NULL),
                ('CanUseAutomations', 'Automatizaciones', 0, NULL),
                ('HideTTurnosBranding', 'Ocultar marca TTurnos', 0, NULL),
                ('MaxProfessionals', 'Profesionales', 1, '-1 = sin límite'),
                ('MaxBranches', 'Sucursales', 1, '-1 = sin límite'),
                ('MaxBookings', 'Reservas por mes', 1, '-1 = sin límite'),
                ('MaxClients', 'Clientes', 1, '-1 = sin límite'),
                ('MaxServices', 'Servicios', 1, '-1 = sin límite'),
                ('MaxAdmins', 'Administradores', 1, '-1 = sin límite (sin enforcement todavía)');

                INSERT INTO "Plans" ("Name", "PriceMonthly", "PriceYearly", "IsActive") VALUES
                ('Free', NULL, NULL, true),
                ('Starter', NULL, NULL, true),
                ('Pro', NULL, NULL, true),
                ('Business', NULL, NULL, true),
                ('Licencia', NULL, NULL, true),
                ('Custom', NULL, NULL, true);

                INSERT INTO "PlanFeatures" ("PlanId", "FeatureId", "Value")
                SELECT p."Id", f."Id", v.value
                FROM (VALUES
                    ('Free', 'CanUseWhatsapp', 'False'),
                    ('Free', 'CanUseAI', 'False'),
                    ('Free', 'CanUseMercadoPago', 'False'),
                    ('Free', 'CanUseAutomations', 'False'),
                    ('Free', 'HideTTurnosBranding', 'False'),
                    ('Free', 'MaxProfessionals', '1'),
                    ('Free', 'MaxBranches', '1'),
                    ('Free', 'MaxBookings', '50'),
                    ('Free', 'MaxClients', '50'),
                    ('Free', 'MaxServices', '5'),
                    ('Free', 'MaxAdmins', '1'),

                    ('Starter', 'CanUseWhatsapp', 'False'),
                    ('Starter', 'CanUseAI', 'False'),
                    ('Starter', 'CanUseMercadoPago', 'False'),
                    ('Starter', 'CanUseAutomations', 'False'),
                    ('Starter', 'HideTTurnosBranding', 'True'),
                    ('Starter', 'MaxProfessionals', '2'),
                    ('Starter', 'MaxBranches', '1'),
                    ('Starter', 'MaxBookings', '-1'),
                    ('Starter', 'MaxClients', '-1'),
                    ('Starter', 'MaxServices', '-1'),
                    ('Starter', 'MaxAdmins', '1'),

                    ('Pro', 'CanUseWhatsapp', 'True'),
                    ('Pro', 'CanUseAI', 'False'),
                    ('Pro', 'CanUseMercadoPago', 'True'),
                    ('Pro', 'CanUseAutomations', 'True'),
                    ('Pro', 'HideTTurnosBranding', 'True'),
                    ('Pro', 'MaxProfessionals', '10'),
                    ('Pro', 'MaxBranches', '1'),
                    ('Pro', 'MaxBookings', '-1'),
                    ('Pro', 'MaxClients', '-1'),
                    ('Pro', 'MaxServices', '-1'),
                    ('Pro', 'MaxAdmins', '3'),

                    ('Business', 'CanUseWhatsapp', 'True'),
                    ('Business', 'CanUseAI', 'False'),
                    ('Business', 'CanUseMercadoPago', 'True'),
                    ('Business', 'CanUseAutomations', 'True'),
                    ('Business', 'HideTTurnosBranding', 'True'),
                    ('Business', 'MaxProfessionals', '-1'),
                    ('Business', 'MaxBranches', '-1'),
                    ('Business', 'MaxBookings', '-1'),
                    ('Business', 'MaxClients', '-1'),
                    ('Business', 'MaxServices', '-1'),
                    ('Business', 'MaxAdmins', '-1'),

                    ('Licencia', 'CanUseWhatsapp', 'True'),
                    ('Licencia', 'CanUseAI', 'True'),
                    ('Licencia', 'CanUseMercadoPago', 'True'),
                    ('Licencia', 'CanUseAutomations', 'True'),
                    ('Licencia', 'HideTTurnosBranding', 'True'),
                    ('Licencia', 'MaxProfessionals', '-1'),
                    ('Licencia', 'MaxBranches', '-1'),
                    ('Licencia', 'MaxBookings', '-1'),
                    ('Licencia', 'MaxClients', '-1'),
                    ('Licencia', 'MaxServices', '-1'),
                    ('Licencia', 'MaxAdmins', '-1'),

                    ('Custom', 'CanUseWhatsapp', 'True'),
                    ('Custom', 'CanUseAI', 'True'),
                    ('Custom', 'CanUseMercadoPago', 'True'),
                    ('Custom', 'CanUseAutomations', 'True'),
                    ('Custom', 'HideTTurnosBranding', 'True'),
                    ('Custom', 'MaxProfessionals', '-1'),
                    ('Custom', 'MaxBranches', '-1'),
                    ('Custom', 'MaxBookings', '-1'),
                    ('Custom', 'MaxClients', '-1'),
                    ('Custom', 'MaxServices', '-1'),
                    ('Custom', 'MaxAdmins', '-1')
                ) AS v(plan_name, feature_key, value)
                JOIN "Plans" p ON p."Name" = v.plan_name
                JOIN "Features" f ON f."Key" = v.feature_key;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DELETE FROM "PlanFeatures";
                DELETE FROM "Plans";
                DELETE FROM "Features";

                INSERT INTO "Features" ("Key", "Name", "Type", "Description") VALUES
                ('CanUseWhatsapp', 'Notificaciones por WhatsApp', 0, NULL),
                ('CanUseAI', 'Funciones con IA', 0, NULL),
                ('MaxProfessionals', 'Profesionales', 1, '-1 = sin límite'),
                ('MaxBranches', 'Sucursales', 1, '-1 = sin límite'),
                ('MaxBookings', 'Reservas por mes', 1, '-1 = sin límite');

                INSERT INTO "Plans" ("Name", "PriceMonthly", "PriceYearly", "IsActive") VALUES
                ('Starter', NULL, NULL, true),
                ('Pro', NULL, NULL, true),
                ('Premium', NULL, NULL, true),
                ('Enterprise', NULL, NULL, true),
                ('License', NULL, NULL, true),
                ('Custom', NULL, NULL, true);

                INSERT INTO "PlanFeatures" ("PlanId", "FeatureId", "Value")
                SELECT p."Id", f."Id", v.value
                FROM (VALUES
                    ('Starter', 'CanUseWhatsapp', 'False'),
                    ('Starter', 'CanUseAI', 'False'),
                    ('Starter', 'MaxProfessionals', '1'),
                    ('Starter', 'MaxBranches', '1'),
                    ('Starter', 'MaxBookings', '50'),

                    ('Pro', 'CanUseWhatsapp', 'True'),
                    ('Pro', 'CanUseAI', 'False'),
                    ('Pro', 'MaxProfessionals', '5'),
                    ('Pro', 'MaxBranches', '1'),
                    ('Pro', 'MaxBookings', '500'),

                    ('Premium', 'CanUseWhatsapp', 'True'),
                    ('Premium', 'CanUseAI', 'True'),
                    ('Premium', 'MaxProfessionals', '15'),
                    ('Premium', 'MaxBranches', '3'),
                    ('Premium', 'MaxBookings', '2000'),

                    ('Enterprise', 'CanUseWhatsapp', 'True'),
                    ('Enterprise', 'CanUseAI', 'True'),
                    ('Enterprise', 'MaxProfessionals', '-1'),
                    ('Enterprise', 'MaxBranches', '-1'),
                    ('Enterprise', 'MaxBookings', '-1'),

                    ('License', 'CanUseWhatsapp', 'True'),
                    ('License', 'CanUseAI', 'True'),
                    ('License', 'MaxProfessionals', '-1'),
                    ('License', 'MaxBranches', '-1'),
                    ('License', 'MaxBookings', '-1'),

                    ('Custom', 'CanUseWhatsapp', 'True'),
                    ('Custom', 'CanUseAI', 'True'),
                    ('Custom', 'MaxProfessionals', '-1'),
                    ('Custom', 'MaxBranches', '-1'),
                    ('Custom', 'MaxBookings', '-1')
                ) AS v(plan_name, feature_key, value)
                JOIN "Plans" p ON p."Name" = v.plan_name
                JOIN "Features" f ON f."Key" = v.feature_key;
                """);
        }
    }
}
