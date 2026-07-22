using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Turneo.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMarketingRoulette : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RoulettePrizes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Value = table.Column<decimal>(type: "numeric(10,2)", nullable: true),
                    DurationMonths = table.Column<int>(type: "integer", nullable: true),
                    Probability = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    ValidityDays = table.Column<int>(type: "integer", nullable: false),
                    CodeSlug = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoulettePrizes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RouletteLeads",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    NombreNegocio = table.Column<string>(type: "text", nullable: false),
                    WhatsApp = table.Column<string>(type: "text", nullable: false),
                    NombreResponsable = table.Column<string>(type: "text", nullable: true),
                    Email = table.Column<string>(type: "text", nullable: true),
                    Instagram = table.Column<string>(type: "text", nullable: true),
                    TipoNegocio = table.Column<string>(type: "text", nullable: true),
                    CantidadProfesionales = table.Column<string>(type: "text", nullable: true),
                    ProblemaPrincipal = table.Column<string>(type: "text", nullable: true),
                    PrizeId = table.Column<int>(type: "integer", nullable: false),
                    CodigoPromocional = table.Column<string>(type: "text", nullable: false),
                    FechaParticipacion = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CodigoVenceAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Fuente = table.Column<string>(type: "text", nullable: true),
                    Campaign = table.Column<string>(type: "text", nullable: true),
                    Estado = table.Column<int>(type: "integer", nullable: false),
                    Notas = table.Column<string>(type: "text", nullable: true),
                    FechaUltimoContacto = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IpAddress = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RouletteLeads", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RouletteLeads_RoulettePrizes_PrizeId",
                        column: x => x.PrizeId,
                        principalTable: "RoulettePrizes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RouletteLeads_CodigoPromocional",
                table: "RouletteLeads",
                column: "CodigoPromocional",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RouletteLeads_PrizeId",
                table: "RouletteLeads",
                column: "PrizeId");

            migrationBuilder.CreateIndex(
                name: "IX_RouletteLeads_WhatsApp",
                table: "RouletteLeads",
                column: "WhatsApp",
                unique: true);

            // Catálogo inicial de premios (docs/RULETA.pdf, sección 11) — las
            // probabilidades suman 100%. Type: 0=FreeMonths, 1=PercentOff,
            // 2=FreeActivation, 3=FreeSetup, 4=SpecialBenefit, 5=CustomDemo.
            migrationBuilder.Sql(
                """
                INSERT INTO "RoulettePrizes" ("Name", "Description", "Type", "Value", "DurationMonths", "Probability", "ValidityDays", "CodeSlug", "IsActive", "CreatedAt") VALUES
                ('3 meses gratis', 'Tres meses de Turneo sin costo.', 0, 3, NULL, 3, 30, '3MESES', true, now()),
                ('2 meses gratis', 'Dos meses de Turneo sin costo.', 0, 2, NULL, 7, 30, '2MESES', true, now()),
                ('1 mes gratis', 'Un mes de Turneo sin costo.', 0, 1, NULL, 15, 30, '1MES', true, now()),
                ('50% OFF primer mes', '50% de descuento en tu primer mes de Turneo.', 1, 50, 1, 20, 30, '50OFF', true, now()),
                ('30% OFF 3 meses', '30% de descuento durante tus primeros 3 meses.', 1, 30, 3, 20, 30, '30OFF3M', true, now()),
                ('Activación gratis', 'Sin costo de activación al suscribirte.', 2, NULL, NULL, 20, 30, 'ACTIVACION', true, now()),
                ('Beneficio especial', 'Beneficio a coordinar con el equipo comercial.', 4, NULL, NULL, 15, 30, 'ESPECIAL', true, now());
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RouletteLeads");

            migrationBuilder.DropTable(
                name: "RoulettePrizes");
        }
    }
}
