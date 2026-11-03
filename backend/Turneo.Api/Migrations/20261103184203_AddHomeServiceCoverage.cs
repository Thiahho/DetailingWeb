using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Turneo.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddHomeServiceCoverage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LocationType",
                table: "Services",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "CoverageLocalities",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TenantId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Province = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    GeorefId = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Surcharge = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CoverageLocalities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CoverageLocalities_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CoverageLocalities_TenantId_GeorefId",
                table: "CoverageLocalities",
                columns: new[] { "TenantId", "GeorefId" },
                unique: true,
                filter: "\"GeorefId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CoverageLocalities_TenantId_Province_Name",
                table: "CoverageLocalities",
                columns: new[] { "TenantId", "Province", "Name" },
                unique: true);

            // Same second isolation layer as every other tenant-scoped table
            // (see EnableRowLevelSecurity / AddProfessionalPromotions).
            migrationBuilder.Sql("ALTER TABLE \"CoverageLocalities\" ENABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql("ALTER TABLE \"CoverageLocalities\" FORCE ROW LEVEL SECURITY;");
            migrationBuilder.Sql(@"
                CREATE POLICY tenant_isolation ON ""CoverageLocalities""
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
            migrationBuilder.Sql("DROP POLICY IF EXISTS tenant_isolation ON \"CoverageLocalities\";");
            migrationBuilder.DropTable(
                name: "CoverageLocalities");

            migrationBuilder.DropColumn(
                name: "LocationType",
                table: "Services");
        }
    }
}
