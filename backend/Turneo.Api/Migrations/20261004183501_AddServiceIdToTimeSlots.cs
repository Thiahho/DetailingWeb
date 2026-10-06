using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Turneo.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddServiceIdToTimeSlots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ServiceId",
                table: "TimeSlots",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TimeSlots_ServiceId",
                table: "TimeSlots",
                column: "ServiceId");

            migrationBuilder.AddForeignKey(
                name: "FK_TimeSlots_Services_ServiceId",
                table: "TimeSlots",
                column: "ServiceId",
                principalTable: "Services",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TimeSlots_Services_ServiceId",
                table: "TimeSlots");

            migrationBuilder.DropIndex(
                name: "IX_TimeSlots_ServiceId",
                table: "TimeSlots");

            migrationBuilder.DropColumn(
                name: "ServiceId",
                table: "TimeSlots");
        }
    }
}
