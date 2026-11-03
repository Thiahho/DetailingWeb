using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Turneo.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBookingHomeServiceAddress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CoverageLocalityId",
                table: "Bookings",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CoverageLocalityName",
                table: "Bookings",
                type: "character varying(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CoverageLocalityProvince",
                table: "Bookings",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HomeAddressDetails",
                table: "Bookings",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HomeAddressNotes",
                table: "Bookings",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HomeAddressStreet",
                table: "Bookings",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "HomeServiceSurcharge",
                table: "Bookings",
                type: "numeric(12,2)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CoverageLocalityId",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "CoverageLocalityName",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "CoverageLocalityProvince",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "HomeAddressDetails",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "HomeAddressNotes",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "HomeAddressStreet",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "HomeServiceSurcharge",
                table: "Bookings");
        }
    }
}
