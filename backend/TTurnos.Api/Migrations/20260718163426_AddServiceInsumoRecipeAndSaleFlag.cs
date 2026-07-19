using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TTurnos.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddServiceInsumoRecipeAndSaleFlag : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsSale",
                table: "BookingItems",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "ServiceInsumos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TenantId = table.Column<int>(type: "integer", nullable: false),
                    ServiceId = table.Column<int>(type: "integer", nullable: false),
                    InsumoId = table.Column<int>(type: "integer", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceInsumos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServiceInsumos_Insumos_InsumoId",
                        column: x => x.InsumoId,
                        principalTable: "Insumos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ServiceInsumos_Services_ServiceId",
                        column: x => x.ServiceId,
                        principalTable: "Services",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ServiceInsumos_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceInsumos_InsumoId",
                table: "ServiceInsumos",
                column: "InsumoId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceInsumos_ServiceId",
                table: "ServiceInsumos",
                column: "ServiceId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceInsumos_TenantId_ServiceId_InsumoId",
                table: "ServiceInsumos",
                columns: new[] { "TenantId", "ServiceId", "InsumoId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ServiceInsumos");

            migrationBuilder.DropColumn(
                name: "IsSale",
                table: "BookingItems");
        }
    }
}
