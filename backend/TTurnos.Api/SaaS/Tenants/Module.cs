namespace TTurnos.Api.SaaS.Tenants;

// Catálogo de rubros/módulos disponibles en el sistema (Beauty, Restaurant, ...).
// Espeja las carpetas de Modules/ en el código; sirve para habilitar/deshabilitar
// rubros por tenant vía TenantModule sin tocar código.
public class Module
{
    public int Id { get; set; }
    public required string Key { get; set; }
    public required string Name { get; set; }
    public bool IsActive { get; set; } = true;
}
