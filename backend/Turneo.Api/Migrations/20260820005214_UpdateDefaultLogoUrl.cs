using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Turneo.Api.Migrations
{
    /// <inheritdoc />
    public partial class UpdateDefaultLogoUrl : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // logo.png es el ícono solo (circular, sin texto); LogoPortada.png es el
            // isologo completo ("Turneo Belleza" + ícono). El Navbar del tenant
            // (src/components/shared/Navbar.tsx) arranca mostrando LogoPortada.png
            // como estado inicial pero lo pisa con SiteConfig.LogoUrl apenas carga —
            // como el seed original (AddSiteConfigGalleryAndCustomFields) guardó
            // logo.png ahí, el nav mostraba el isologo completo por un instante y
            // después cambiaba al ícono solo. Solo toca las filas que siguen en el
            // default viejo — no pisa un logo propio que un tenant haya subido.
            migrationBuilder.Sql(@"
                UPDATE ""SiteConfigs""
                SET ""LogoUrl"" = '/img/LogoPortada.png'
                WHERE ""LogoUrl"" = '/img/logo.png';
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                UPDATE ""SiteConfigs""
                SET ""LogoUrl"" = '/img/logo.png'
                WHERE ""LogoUrl"" = '/img/LogoPortada.png';
            ");
        }
    }
}
