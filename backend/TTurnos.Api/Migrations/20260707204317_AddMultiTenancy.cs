using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TTurnos.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMultiTenancy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_Email",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_Username",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_TimeSlots_StartDateTime_ProfessionalId",
                table: "TimeSlots");

            migrationBuilder.DropIndex(
                name: "IX_Services_Slug",
                table: "Services");

            migrationBuilder.DropIndex(
                name: "IX_CustomerProfiles_Phone",
                table: "CustomerProfiles");

            migrationBuilder.DropIndex(
                name: "IX_BlockedDates_Date_ProfessionalId",
                table: "BlockedDates");

            migrationBuilder.AddColumn<int>(
                name: "TenantId",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TenantId",
                table: "TimeSlots",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TenantId",
                table: "SiteConfigs",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TenantId",
                table: "Services",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TenantId",
                table: "ScheduledReminders",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TenantId",
                table: "ReminderLogs",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TenantId",
                table: "Professionals",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TenantId",
                table: "Payments",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TenantId",
                table: "NotificationLogs",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TenantId",
                table: "GalleryItems",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TenantId",
                table: "CustomerProfiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TenantId",
                table: "ContentVideos",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TenantId",
                table: "ClientAccessCodes",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TenantId",
                table: "BusinessSettings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TenantId",
                table: "Bookings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TenantId",
                table: "BlockedDates",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "Modules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Key = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Modules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Plans",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    PriceMonthly = table.Column<decimal>(type: "numeric", nullable: true),
                    PriceYearly = table.Column<decimal>(type: "numeric", nullable: true),
                    MaxProfessionals = table.Column<int>(type: "integer", nullable: true),
                    MaxBookingsPerMonth = table.Column<int>(type: "integer", nullable: true),
                    MaxBranches = table.Column<int>(type: "integer", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Plans", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Tenants",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Slug = table.Column<string>(type: "text", nullable: false),
                    Vertical = table.Column<string>(type: "text", nullable: false),
                    CommercialModel = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    TrialEndsAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tenants", x => x.Id);
                });

            // ── Migración de datos: el negocio que ya corre en esta base pasa a ser
            // el primer tenant real (no uno de prueba). CommercialModel=1 (License) /
            // Status=1 (Active) — ajustar a mano si el contrato real es otro modelo.
            // El Name es un placeholder editable; lo que importa para que todo lo
            // demás siga andando es el Slug 'legacy', que matchea
            // Tenancy:DefaultTenantSlug en appsettings (fallback para localhost/dev
            // y mientras el dominio con subdominios no esté configurado en producción).
            migrationBuilder.Sql(@"
                INSERT INTO ""Tenants"" (""Name"", ""Slug"", ""Vertical"", ""CommercialModel"", ""Status"", ""CreatedAt"")
                VALUES ('Negocio Legacy', 'legacy', 'Beauty', 1, 1, now());

                DO $$
                DECLARE
                    legacy_id integer;
                BEGIN
                    SELECT ""Id"" INTO legacy_id FROM ""Tenants"" WHERE ""Slug"" = 'legacy';

                    UPDATE ""Users"" SET ""TenantId"" = legacy_id WHERE ""TenantId"" = 0;
                    UPDATE ""BusinessSettings"" SET ""TenantId"" = legacy_id WHERE ""TenantId"" = 0;
                    UPDATE ""BlockedDates"" SET ""TenantId"" = legacy_id WHERE ""TenantId"" = 0;
                    UPDATE ""TimeSlots"" SET ""TenantId"" = legacy_id WHERE ""TenantId"" = 0;
                    UPDATE ""Bookings"" SET ""TenantId"" = legacy_id WHERE ""TenantId"" = 0;
                    UPDATE ""Services"" SET ""TenantId"" = legacy_id WHERE ""TenantId"" = 0;
                    UPDATE ""Professionals"" SET ""TenantId"" = legacy_id WHERE ""TenantId"" = 0;
                    UPDATE ""NotificationLogs"" SET ""TenantId"" = legacy_id WHERE ""TenantId"" = 0;
                    UPDATE ""ClientAccessCodes"" SET ""TenantId"" = legacy_id WHERE ""TenantId"" = 0;
                    UPDATE ""ContentVideos"" SET ""TenantId"" = legacy_id WHERE ""TenantId"" = 0;
                    UPDATE ""SiteConfigs"" SET ""TenantId"" = legacy_id WHERE ""TenantId"" = 0;
                    UPDATE ""GalleryItems"" SET ""TenantId"" = legacy_id WHERE ""TenantId"" = 0;
                    UPDATE ""Payments"" SET ""TenantId"" = legacy_id WHERE ""TenantId"" = 0;
                    UPDATE ""CustomerProfiles"" SET ""TenantId"" = legacy_id WHERE ""TenantId"" = 0;
                    UPDATE ""ScheduledReminders"" SET ""TenantId"" = legacy_id WHERE ""TenantId"" = 0;
                    UPDATE ""ReminderLogs"" SET ""TenantId"" = legacy_id WHERE ""TenantId"" = 0;
                END $$;
            ");

            migrationBuilder.CreateTable(
                name: "Licenses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TenantId = table.Column<int>(type: "integer", nullable: false),
                    LicenseKey = table.Column<string>(type: "text", nullable: false),
                    PurchasedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    SupportExpiresAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Licenses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Licenses_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Subscriptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TenantId = table.Column<int>(type: "integer", nullable: false),
                    PlanId = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CurrentPeriodStart = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CurrentPeriodEnd = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Subscriptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Subscriptions_Plans_PlanId",
                        column: x => x.PlanId,
                        principalTable: "Plans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Subscriptions_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TenantModules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TenantId = table.Column<int>(type: "integer", nullable: false),
                    ModuleId = table.Column<int>(type: "integer", nullable: false),
                    EnabledAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantModules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TenantModules_Modules_ModuleId",
                        column: x => x.ModuleId,
                        principalTable: "Modules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TenantModules_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UsageRecords",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TenantId = table.Column<int>(type: "integer", nullable: false),
                    Metric = table.Column<string>(type: "text", nullable: false),
                    Period = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Count = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UsageRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UsageRecords_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Users_TenantId_Email",
                table: "Users",
                columns: new[] { "TenantId", "Email" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_TenantId_Username",
                table: "Users",
                columns: new[] { "TenantId", "Username" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TimeSlots_TenantId_StartDateTime_ProfessionalId",
                table: "TimeSlots",
                columns: new[] { "TenantId", "StartDateTime", "ProfessionalId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SiteConfigs_TenantId",
                table: "SiteConfigs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Services_TenantId_Slug",
                table: "Services",
                columns: new[] { "TenantId", "Slug" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScheduledReminders_TenantId",
                table: "ScheduledReminders",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ReminderLogs_TenantId",
                table: "ReminderLogs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Professionals_TenantId",
                table: "Professionals",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_TenantId",
                table: "Payments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_NotificationLogs_TenantId",
                table: "NotificationLogs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_GalleryItems_TenantId",
                table: "GalleryItems",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerProfiles_TenantId_Phone",
                table: "CustomerProfiles",
                columns: new[] { "TenantId", "Phone" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ContentVideos_TenantId",
                table: "ContentVideos",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientAccessCodes_TenantId",
                table: "ClientAccessCodes",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_BusinessSettings_TenantId",
                table: "BusinessSettings",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_TenantId",
                table: "Bookings",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_BlockedDates_TenantId_Date_ProfessionalId",
                table: "BlockedDates",
                columns: new[] { "TenantId", "Date", "ProfessionalId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Licenses_LicenseKey",
                table: "Licenses",
                column: "LicenseKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Licenses_TenantId",
                table: "Licenses",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Modules_Key",
                table: "Modules",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Subscriptions_PlanId",
                table: "Subscriptions",
                column: "PlanId");

            migrationBuilder.CreateIndex(
                name: "IX_Subscriptions_TenantId",
                table: "Subscriptions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantModules_ModuleId",
                table: "TenantModules",
                column: "ModuleId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantModules_TenantId_ModuleId",
                table: "TenantModules",
                columns: new[] { "TenantId", "ModuleId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tenants_Slug",
                table: "Tenants",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UsageRecords_TenantId_Metric_Period",
                table: "UsageRecords",
                columns: new[] { "TenantId", "Metric", "Period" });

            migrationBuilder.AddForeignKey(
                name: "FK_BlockedDates_Tenants_TenantId",
                table: "BlockedDates",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Bookings_Tenants_TenantId",
                table: "Bookings",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_BusinessSettings_Tenants_TenantId",
                table: "BusinessSettings",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ClientAccessCodes_Tenants_TenantId",
                table: "ClientAccessCodes",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ContentVideos_Tenants_TenantId",
                table: "ContentVideos",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_CustomerProfiles_Tenants_TenantId",
                table: "CustomerProfiles",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_GalleryItems_Tenants_TenantId",
                table: "GalleryItems",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_NotificationLogs_Tenants_TenantId",
                table: "NotificationLogs",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_Tenants_TenantId",
                table: "Payments",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Professionals_Tenants_TenantId",
                table: "Professionals",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ReminderLogs_Tenants_TenantId",
                table: "ReminderLogs",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ScheduledReminders_Tenants_TenantId",
                table: "ScheduledReminders",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Services_Tenants_TenantId",
                table: "Services",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SiteConfigs_Tenants_TenantId",
                table: "SiteConfigs",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_TimeSlots_Tenants_TenantId",
                table: "TimeSlots",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Tenants_TenantId",
                table: "Users",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BlockedDates_Tenants_TenantId",
                table: "BlockedDates");

            migrationBuilder.DropForeignKey(
                name: "FK_Bookings_Tenants_TenantId",
                table: "Bookings");

            migrationBuilder.DropForeignKey(
                name: "FK_BusinessSettings_Tenants_TenantId",
                table: "BusinessSettings");

            migrationBuilder.DropForeignKey(
                name: "FK_ClientAccessCodes_Tenants_TenantId",
                table: "ClientAccessCodes");

            migrationBuilder.DropForeignKey(
                name: "FK_ContentVideos_Tenants_TenantId",
                table: "ContentVideos");

            migrationBuilder.DropForeignKey(
                name: "FK_CustomerProfiles_Tenants_TenantId",
                table: "CustomerProfiles");

            migrationBuilder.DropForeignKey(
                name: "FK_GalleryItems_Tenants_TenantId",
                table: "GalleryItems");

            migrationBuilder.DropForeignKey(
                name: "FK_NotificationLogs_Tenants_TenantId",
                table: "NotificationLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_Payments_Tenants_TenantId",
                table: "Payments");

            migrationBuilder.DropForeignKey(
                name: "FK_Professionals_Tenants_TenantId",
                table: "Professionals");

            migrationBuilder.DropForeignKey(
                name: "FK_ReminderLogs_Tenants_TenantId",
                table: "ReminderLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_ScheduledReminders_Tenants_TenantId",
                table: "ScheduledReminders");

            migrationBuilder.DropForeignKey(
                name: "FK_Services_Tenants_TenantId",
                table: "Services");

            migrationBuilder.DropForeignKey(
                name: "FK_SiteConfigs_Tenants_TenantId",
                table: "SiteConfigs");

            migrationBuilder.DropForeignKey(
                name: "FK_TimeSlots_Tenants_TenantId",
                table: "TimeSlots");

            migrationBuilder.DropForeignKey(
                name: "FK_Users_Tenants_TenantId",
                table: "Users");

            migrationBuilder.DropTable(
                name: "Licenses");

            migrationBuilder.DropTable(
                name: "Subscriptions");

            migrationBuilder.DropTable(
                name: "TenantModules");

            migrationBuilder.DropTable(
                name: "UsageRecords");

            migrationBuilder.DropTable(
                name: "Plans");

            migrationBuilder.DropTable(
                name: "Modules");

            migrationBuilder.DropTable(
                name: "Tenants");

            migrationBuilder.DropIndex(
                name: "IX_Users_TenantId_Email",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_TenantId_Username",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_TimeSlots_TenantId_StartDateTime_ProfessionalId",
                table: "TimeSlots");

            migrationBuilder.DropIndex(
                name: "IX_SiteConfigs_TenantId",
                table: "SiteConfigs");

            migrationBuilder.DropIndex(
                name: "IX_Services_TenantId_Slug",
                table: "Services");

            migrationBuilder.DropIndex(
                name: "IX_ScheduledReminders_TenantId",
                table: "ScheduledReminders");

            migrationBuilder.DropIndex(
                name: "IX_ReminderLogs_TenantId",
                table: "ReminderLogs");

            migrationBuilder.DropIndex(
                name: "IX_Professionals_TenantId",
                table: "Professionals");

            migrationBuilder.DropIndex(
                name: "IX_Payments_TenantId",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_NotificationLogs_TenantId",
                table: "NotificationLogs");

            migrationBuilder.DropIndex(
                name: "IX_GalleryItems_TenantId",
                table: "GalleryItems");

            migrationBuilder.DropIndex(
                name: "IX_CustomerProfiles_TenantId_Phone",
                table: "CustomerProfiles");

            migrationBuilder.DropIndex(
                name: "IX_ContentVideos_TenantId",
                table: "ContentVideos");

            migrationBuilder.DropIndex(
                name: "IX_ClientAccessCodes_TenantId",
                table: "ClientAccessCodes");

            migrationBuilder.DropIndex(
                name: "IX_BusinessSettings_TenantId",
                table: "BusinessSettings");

            migrationBuilder.DropIndex(
                name: "IX_Bookings_TenantId",
                table: "Bookings");

            migrationBuilder.DropIndex(
                name: "IX_BlockedDates_TenantId_Date_ProfessionalId",
                table: "BlockedDates");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "TimeSlots");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "SiteConfigs");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "Services");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "ScheduledReminders");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "ReminderLogs");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "Professionals");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "NotificationLogs");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "GalleryItems");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "CustomerProfiles");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "ContentVideos");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "ClientAccessCodes");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "BusinessSettings");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "BlockedDates");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TimeSlots_StartDateTime_ProfessionalId",
                table: "TimeSlots",
                columns: new[] { "StartDateTime", "ProfessionalId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Services_Slug",
                table: "Services",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CustomerProfiles_Phone",
                table: "CustomerProfiles",
                column: "Phone",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BlockedDates_Date_ProfessionalId",
                table: "BlockedDates",
                columns: new[] { "Date", "ProfessionalId" },
                unique: true);
        }
    }
}
