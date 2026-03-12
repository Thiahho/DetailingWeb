using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace DetailingApi.Migrations
{
    /// <inheritdoc />
    public partial class AddServicesTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Services",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Slug = table.Column<string>(type: "text", nullable: false),
                    Price = table.Column<string>(type: "text", nullable: false),
                    Duration = table.Column<string>(type: "text", nullable: false),
                    ImageUrl = table.Column<string>(type: "text", nullable: false),
                    Details = table.Column<List<string>>(type: "jsonb", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Services", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Services_Slug",
                table: "Services",
                column: "Slug",
                unique: true);

            // Seed inicial con los 6 servicios del detailing
            migrationBuilder.InsertData(
                table: "Services",
                columns: new[] { "Title", "Slug", "Price", "Duration", "ImageUrl", "Details", "IsActive", "Order", "CreatedAt", "UpdatedAt" },
                values: new object[,]
                {
                    {
                        "Pack Daily Reset", "daily-reset", "Desde $45.000", "4-6 hs",
                        "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80",
                        "[\"Lavado premium + sellado rápido\",\"Interior profundo + tapizados\",\"Motor y detalles con brillo\"]",
                        true, 1, DateTime.UtcNow, DateTime.UtcNow
                    },
                    {
                        "Pack Brillo Total", "brillo-total", "Desde $85.000", "1-2 días",
                        "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80",
                        "[\"Corrección de pintura 1 paso\",\"Sellador cerámico 6 meses\",\"Detailing interior completo\"]",
                        true, 2, DateTime.UtcNow, DateTime.UtcNow
                    },
                    {
                        "Pack Protección Pro", "proteccion-pro", "Desde $180.000", "2-4 días",
                        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
                        "[\"Coating cerámico 3-5 años\",\"PPF parcial frontal\",\"Garantía y plan de mantenimiento\"]",
                        true, 3, DateTime.UtcNow, DateTime.UtcNow
                    },
                    {
                        "Pack SUV Interior Plus", "suv-interior-plus", "Desde $60.000", "6-8 hs",
                        "https://images.unsplash.com/photo-1519648023493-d82b5f8d7b8a?auto=format&fit=crop&w=900&q=80",
                        "[\"Interior intensivo + tapizados\",\"Limpieza de baúl y paneles\",\"Sanitizado premium\"]",
                        true, 4, DateTime.UtcNow, DateTime.UtcNow
                    },
                    {
                        "Pack Corrección 2 pasos", "correccion-2-pasos", "Desde $120.000", "2-3 días",
                        "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80",
                        "[\"Corrección de pintura avanzada\",\"Sellado cerámico 12 meses\",\"Acabado espejo\"]",
                        true, 5, DateTime.UtcNow, DateTime.UtcNow
                    },
                    {
                        "Pack Flota Express", "flota-express", "Desde $35.000", "3-5 hs",
                        "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80",
                        "[\"Lavado premium exterior\",\"Interior express\",\"Turnos recurrentes\"]",
                        true, 6, DateTime.UtcNow, DateTime.UtcNow
                    }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Services");
        }
    }
}
