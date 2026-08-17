using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Turneo.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddGoogleReviewUrlToSiteConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GoogleReviewUrl",
                table: "SiteConfigs",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GoogleReviewUrl",
                table: "SiteConfigs");
        }
    }
}
