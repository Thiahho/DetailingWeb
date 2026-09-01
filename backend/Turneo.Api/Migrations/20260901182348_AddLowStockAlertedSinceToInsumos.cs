using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Turneo.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLowStockAlertedSinceToInsumos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LowStockAlertedSince",
                table: "Insumos",
                type: "timestamp without time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LowStockAlertedSince",
                table: "Insumos");
        }
    }
}
