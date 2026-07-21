using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TTurnos.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddIsBlockedToTimeSlots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsBlocked",
                table: "TimeSlots",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsBlocked",
                table: "TimeSlots");
        }
    }
}
