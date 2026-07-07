using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TTurnos.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProfessionalIdToBookings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ProfessionalId",
                table: "Bookings",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_ProfessionalId",
                table: "Bookings",
                column: "ProfessionalId");

            migrationBuilder.AddForeignKey(
                name: "FK_Bookings_Professionals_ProfessionalId",
                table: "Bookings",
                column: "ProfessionalId",
                principalTable: "Professionals",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Bookings_Professionals_ProfessionalId",
                table: "Bookings");

            migrationBuilder.DropIndex(
                name: "IX_Bookings_ProfessionalId",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "ProfessionalId",
                table: "Bookings");
        }
    }
}
