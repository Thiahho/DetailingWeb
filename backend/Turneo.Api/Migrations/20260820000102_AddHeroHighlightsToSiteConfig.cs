using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Turneo.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddHeroHighlightsToSiteConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "HeroHighlights",
                table: "SiteConfigs",
                type: "jsonb",
                nullable: false,
                defaultValue: "[]");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HeroHighlights",
                table: "SiteConfigs");
        }
    }
}
