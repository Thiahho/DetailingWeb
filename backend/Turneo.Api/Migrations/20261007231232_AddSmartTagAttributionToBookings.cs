using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Turneo.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSmartTagAttributionToBookings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SmartTagId",
                table: "Bookings",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "Bookings",
                type: "character varying(8)",
                maxLength: 8,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_SmartTagId",
                table: "Bookings",
                column: "SmartTagId");

            migrationBuilder.AddForeignKey(
                name: "FK_Bookings_SmartTags_SmartTagId",
                table: "Bookings",
                column: "SmartTagId",
                principalTable: "SmartTags",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Bookings_SmartTags_SmartTagId",
                table: "Bookings");

            migrationBuilder.DropIndex(
                name: "IX_Bookings_SmartTagId",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "SmartTagId",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "Bookings");
        }
    }
}
