using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Turneo.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDataDeletionRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DataDeletionRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TenantId = table.Column<int>(type: "integer", nullable: false),
                    ContactName = table.Column<string>(type: "text", nullable: false),
                    ContactEmail = table.Column<string>(type: "text", nullable: true),
                    ContactPhone = table.Column<string>(type: "text", nullable: true),
                    Note = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    RequestedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    ResolvedByUserId = table.Column<int>(type: "integer", nullable: true),
                    ResolutionNote = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DataDeletionRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DataDeletionRequests_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DataDeletionRequests_TenantId_Status",
                table: "DataDeletionRequests",
                columns: new[] { "TenantId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DataDeletionRequests");
        }
    }
}
