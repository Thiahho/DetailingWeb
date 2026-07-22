using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Turneo.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProfessionalIdToScheduling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TimeSlots_StartDateTime",
                table: "TimeSlots");

            migrationBuilder.DropIndex(
                name: "IX_BlockedDates_Date",
                table: "BlockedDates");

            migrationBuilder.AddColumn<int>(
                name: "ProfessionalId",
                table: "Users",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ProfessionalId",
                table: "TimeSlots",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ProfessionalId",
                table: "BlockedDates",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_ProfessionalId",
                table: "Users",
                column: "ProfessionalId");

            migrationBuilder.CreateIndex(
                name: "IX_TimeSlots_ProfessionalId",
                table: "TimeSlots",
                column: "ProfessionalId");

            migrationBuilder.CreateIndex(
                name: "IX_TimeSlots_StartDateTime_ProfessionalId",
                table: "TimeSlots",
                columns: new[] { "StartDateTime", "ProfessionalId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BlockedDates_Date_ProfessionalId",
                table: "BlockedDates",
                columns: new[] { "Date", "ProfessionalId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BlockedDates_ProfessionalId",
                table: "BlockedDates",
                column: "ProfessionalId");

            migrationBuilder.AddForeignKey(
                name: "FK_BlockedDates_Professionals_ProfessionalId",
                table: "BlockedDates",
                column: "ProfessionalId",
                principalTable: "Professionals",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_TimeSlots_Professionals_ProfessionalId",
                table: "TimeSlots",
                column: "ProfessionalId",
                principalTable: "Professionals",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Professionals_ProfessionalId",
                table: "Users",
                column: "ProfessionalId",
                principalTable: "Professionals",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BlockedDates_Professionals_ProfessionalId",
                table: "BlockedDates");

            migrationBuilder.DropForeignKey(
                name: "FK_TimeSlots_Professionals_ProfessionalId",
                table: "TimeSlots");

            migrationBuilder.DropForeignKey(
                name: "FK_Users_Professionals_ProfessionalId",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_ProfessionalId",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_TimeSlots_ProfessionalId",
                table: "TimeSlots");

            migrationBuilder.DropIndex(
                name: "IX_TimeSlots_StartDateTime_ProfessionalId",
                table: "TimeSlots");

            migrationBuilder.DropIndex(
                name: "IX_BlockedDates_Date_ProfessionalId",
                table: "BlockedDates");

            migrationBuilder.DropIndex(
                name: "IX_BlockedDates_ProfessionalId",
                table: "BlockedDates");

            migrationBuilder.DropColumn(
                name: "ProfessionalId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ProfessionalId",
                table: "TimeSlots");

            migrationBuilder.DropColumn(
                name: "ProfessionalId",
                table: "BlockedDates");

            migrationBuilder.CreateIndex(
                name: "IX_TimeSlots_StartDateTime",
                table: "TimeSlots",
                column: "StartDateTime",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BlockedDates_Date",
                table: "BlockedDates",
                column: "Date",
                unique: true);
        }
    }
}
