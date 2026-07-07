using Hangfire.Dashboard;

namespace TTurnos.Api.Infrastructure.BackgroundJobs;
// Filters/HangfireAdminAuthFilter.cs
// Bloquea el dashboard /hangfire a quien no sea admin autenticado
public class HangfireAdminAuthFilter : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        var httpContext = context.GetHttpContext();

        // Debe estar autenticado
        if (!httpContext.User.Identity?.IsAuthenticated ?? true)
            return false;

        // Debe tener rol Admin
        return httpContext.User.IsInRole("Admin");
    }
}