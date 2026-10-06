using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Turneo.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProfessionalSelfRegistration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Professionals_TenantId",
                table: "Professionals");

            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "Professionals",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FailedAttempts",
                table: "ClientAccessCodes",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Purpose",
                table: "ClientAccessCodes",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "ClientAccess");

            migrationBuilder.CreateIndex(
                name: "IX_Professionals_TenantId_Email",
                table: "Professionals",
                columns: new[] { "TenantId", "Email" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Professionals_TenantId_Email",
                table: "Professionals");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "Professionals");

            migrationBuilder.DropColumn(
                name: "FailedAttempts",
                table: "ClientAccessCodes");

            migrationBuilder.DropColumn(
                name: "Purpose",
                table: "ClientAccessCodes");

            migrationBuilder.CreateIndex(
                name: "IX_Professionals_TenantId",
                table: "Professionals",
                column: "TenantId");
        }
    }
}
