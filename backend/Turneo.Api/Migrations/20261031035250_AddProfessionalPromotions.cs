using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Turneo.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProfessionalPromotions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Promotions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TenantId = table.Column<int>(type: "integer", nullable: false),
                    ProfessionalId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DiscountType = table.Column<int>(type: "integer", nullable: false),
                    Value = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    ServiceIds = table.Column<List<int>>(type: "integer[]", nullable: false),
                    StartsAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    EndsAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Promotions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Promotions_Professionals_ProfessionalId",
                        column: x => x.ProfessionalId,
                        principalTable: "Professionals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Promotions_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Promotions_ProfessionalId_IsActive",
                table: "Promotions",
                columns: new[] { "ProfessionalId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_Promotions_TenantId",
                table: "Promotions",
                column: "TenantId");

            // Misma segunda capa de aislamiento que el resto de las tablas tenant-scoped
            // (ver EnableRowLevelSecurity / AddReviews).
            migrationBuilder.Sql("ALTER TABLE \"Promotions\" ENABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql("ALTER TABLE \"Promotions\" FORCE ROW LEVEL SECURITY;");
            migrationBuilder.Sql(@"
                CREATE POLICY tenant_isolation ON ""Promotions""
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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP POLICY IF EXISTS tenant_isolation ON \"Promotions\";");
            migrationBuilder.DropTable(
                name: "Promotions");
        }
    }
}
