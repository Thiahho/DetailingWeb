using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DetailingApi.Migrations
{
    public partial class AddCustomizationToServiceAndBooking : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CustomizationJson",
                table: "Bookings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomizationSchemaJson",
                table: "Services",
                type: "text",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CustomizationJson",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "CustomizationSchemaJson",
                table: "Services");
        }
    }
}
