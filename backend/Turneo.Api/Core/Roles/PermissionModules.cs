namespace Turneo.Api.Core.Roles;

// Un módulo por límite real de endpoints, no por página de frontend: Turnos
// agrupa TimeSlotsController + BookingsController porque Calendario, Turnos y
// Historial (las 3 páginas admin) pegan a los mismos endpoints — separarlas
// en permisos distintos sería una distinción sin efecto real en el backend.
public static class PermissionModules
{
    public const string Turnos = "Turnos";
    public const string Clientes = "Clientes";
    public const string Servicios = "Servicios";
    public const string Productos = "Productos";
    public const string Insumos = "Insumos";
    public const string Profesionales = "Profesionales";
    public const string Caja = "Caja";
    public const string Contenido = "Contenido";
    public const string Galeria = "Galeria";
    public const string Automatizaciones = "Automatizaciones";
    public const string Ruleta = "Ruleta";

    public static readonly string[] All =
    {
        Turnos, Clientes, Servicios, Productos, Insumos,
        Profesionales, Caja, Contenido, Galeria, Automatizaciones, Ruleta
    };

    public static bool IsValid(string module) => All.Contains(module);
}

public static class PermissionActions
{
    public const string View = "View";
    public const string Create = "Create";
    public const string Edit = "Edit";
    public const string Delete = "Delete";

    public static readonly string[] All = { View, Create, Edit, Delete };
}
