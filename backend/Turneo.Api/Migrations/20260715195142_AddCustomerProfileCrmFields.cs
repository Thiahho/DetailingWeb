using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Turneo.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerProfileCrmFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "Birthday",
                table: "CustomerProfiles",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FavoriteProfessionalId",
                table: "CustomerProfiles",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Instagram",
                table: "CustomerProfiles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PhotoUrls",
                table: "CustomerProfiles",
                type: "jsonb",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_CustomerProfiles_FavoriteProfessionalId",
                table: "CustomerProfiles",
                column: "FavoriteProfessionalId");

            migrationBuilder.AddForeignKey(
                name: "FK_CustomerProfiles_Professionals_FavoriteProfessionalId",
                table: "CustomerProfiles",
                column: "FavoriteProfessionalId",
                principalTable: "Professionals",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CustomerProfiles_Professionals_FavoriteProfessionalId",
                table: "CustomerProfiles");

            migrationBuilder.DropIndex(
                name: "IX_CustomerProfiles_FavoriteProfessionalId",
                table: "CustomerProfiles");

            migrationBuilder.DropColumn(
                name: "Birthday",
                table: "CustomerProfiles");

            migrationBuilder.DropColumn(
                name: "FavoriteProfessionalId",
                table: "CustomerProfiles");

            migrationBuilder.DropColumn(
                name: "Instagram",
                table: "CustomerProfiles");

            migrationBuilder.DropColumn(
                name: "PhotoUrls",
                table: "CustomerProfiles");
        }
    }
}
