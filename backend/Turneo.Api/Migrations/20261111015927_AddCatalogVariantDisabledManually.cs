using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Turneo.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCatalogVariantDisabledManually : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "DisabledManually",
                table: "CatalogVariants",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DisabledManually",
                table: "CatalogVariants");
        }
    }
}
