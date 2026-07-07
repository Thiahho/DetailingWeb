using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TTurnos.Api.Migrations
{
    /// <inheritdoc />
    public partial class ReplaceVehicleWithSubjectOnBooking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Vehicle",
                table: "Bookings",
                newName: "Subject");

            migrationBuilder.AddColumn<string>(
                name: "CustomFieldsJson",
                table: "Bookings",
                type: "text",
                nullable: true);

            migrationBuilder.Sql("UPDATE \"Bookings\" SET \"Subject\" = COALESCE(\"Subject\", '')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CustomFieldsJson",
                table: "Bookings");

            migrationBuilder.RenameColumn(
                name: "Subject",
                table: "Bookings",
                newName: "Vehicle");
        }
    }
}
