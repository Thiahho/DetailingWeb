using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TTurnos.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddInsumos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "InsumoId",
                table: "BookingItems",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Insumos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TenantId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Stock = table.Column<int>(type: "integer", nullable: false),
                    LowStockThreshold = table.Column<int>(type: "integer", nullable: false),
                    UnitCost = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Insumos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Insumos_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BookingItems_InsumoId",
                table: "BookingItems",
                column: "InsumoId");

            migrationBuilder.CreateIndex(
                name: "IX_Insumos_TenantId",
                table: "Insumos",
                column: "TenantId");

            migrationBuilder.AddForeignKey(
                name: "FK_BookingItems_Insumos_InsumoId",
                table: "BookingItems",
                column: "InsumoId",
                principalTable: "Insumos",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BookingItems_Insumos_InsumoId",
                table: "BookingItems");

            migrationBuilder.DropTable(
                name: "Insumos");

            migrationBuilder.DropIndex(
                name: "IX_BookingItems_InsumoId",
                table: "BookingItems");

            migrationBuilder.DropColumn(
                name: "InsumoId",
                table: "BookingItems");
        }
    }
}
