using Microsoft.EntityFrameworkCore;

namespace TTurnos.Api.Infrastructure.Persistence;

// Semilla el catálogo de Features y los 6 planes comerciales (Free, Starter,
// Pro, Business, Licencia, Custom — propuesta comercial confirmada 20/07).
// Los límites son los de esa propuesta; los precios quedan sin definir
// (null) porque son una decisión de negocio real, no algo para inventar acá.
// Solo corre en una base sin Features todavía — una base ya sembrada con el
// catálogo viejo se actualiza vía migración de datos, no acá.
public static class SaaSCatalogSeeder
{
    private const string Unlimited = "-1";

    public static async Task SeedAsync(ApplicationDbContext context)
    {
        if (await context.Features.AnyAsync())
            return;

        var canUseWhatsapp = new Feature { Key = "CanUseWhatsapp", Name = "Notificaciones por WhatsApp", Type = FeatureType.Boolean };
        var canUseAI = new Feature { Key = "CanUseAI", Name = "Funciones con IA", Type = FeatureType.Boolean };
        var canUseMercadoPago = new Feature { Key = "CanUseMercadoPago", Name = "Pagos con Mercado Pago", Type = FeatureType.Boolean };
        var canUseAutomations = new Feature { Key = "CanUseAutomations", Name = "Automatizaciones", Type = FeatureType.Boolean };
        var hideBranding = new Feature { Key = "HideTTurnosBranding", Name = "Ocultar marca TTurnos", Type = FeatureType.Boolean };
        var maxProfessionals = new Feature { Key = "MaxProfessionals", Name = "Profesionales", Type = FeatureType.Numeric, Description = $"{Unlimited} = sin límite" };
        var maxBranches = new Feature { Key = "MaxBranches", Name = "Sucursales", Type = FeatureType.Numeric, Description = $"{Unlimited} = sin límite" };
        var maxBookings = new Feature { Key = "MaxBookings", Name = "Reservas por mes", Type = FeatureType.Numeric, Description = $"{Unlimited} = sin límite" };
        var maxClients = new Feature { Key = "MaxClients", Name = "Clientes", Type = FeatureType.Numeric, Description = $"{Unlimited} = sin límite" };
        var maxServices = new Feature { Key = "MaxServices", Name = "Servicios", Type = FeatureType.Numeric, Description = $"{Unlimited} = sin límite" };
        // Sembrado para uso futuro — todavía no existe un endpoint para invitar
        // un segundo Admin/Staff dentro de un tenant, así que no hay nada que
        // este límite aplique hoy. Ver PLAN comercial / plan de trabajo 20/07.
        var maxAdmins = new Feature { Key = "MaxAdmins", Name = "Administradores", Type = FeatureType.Numeric, Description = $"{Unlimited} = sin límite (sin enforcement todavía)" };

        context.Features.AddRange(
            canUseWhatsapp, canUseAI, canUseMercadoPago, canUseAutomations, hideBranding,
            maxProfessionals, maxBranches, maxBookings, maxClients, maxServices, maxAdmins);
        await context.SaveChangesAsync();

        var plans = new[]
        {
            new Plan { Name = "Free" },
            new Plan { Name = "Starter" },
            new Plan { Name = "Pro" },
            new Plan { Name = "Business" },
            new Plan { Name = "Licencia" },
            new Plan { Name = "Custom" },
        };
        context.Plans.AddRange(plans);
        await context.SaveChangesAsync();

        var limits = new Dictionary<string, (bool Whatsapp, bool Ai, bool MercadoPago, bool Automations, bool HideBranding, string Professionals, string Branches, string Bookings, string Clients, string Services, string Admins)>
        {
            ["Free"] = (false, false, false, false, false, "1", "1", "50", "50", "5", "1"),
            ["Starter"] = (false, false, false, false, true, "2", "1", Unlimited, Unlimited, Unlimited, "1"),
            ["Pro"] = (true, false, true, true, true, "10", "1", Unlimited, Unlimited, Unlimited, "3"),
            ["Business"] = (true, false, true, true, true, Unlimited, Unlimited, Unlimited, Unlimited, Unlimited, Unlimited),
            ["Licencia"] = (true, true, true, true, true, Unlimited, Unlimited, Unlimited, Unlimited, Unlimited, Unlimited),
            ["Custom"] = (true, true, true, true, true, Unlimited, Unlimited, Unlimited, Unlimited, Unlimited, Unlimited),
        };

        foreach (var plan in plans)
        {
            var l = limits[plan.Name];
            context.PlanFeatures.AddRange(
                new PlanFeature { PlanId = plan.Id, FeatureId = canUseWhatsapp.Id, Value = l.Whatsapp.ToString() },
                new PlanFeature { PlanId = plan.Id, FeatureId = canUseAI.Id, Value = l.Ai.ToString() },
                new PlanFeature { PlanId = plan.Id, FeatureId = canUseMercadoPago.Id, Value = l.MercadoPago.ToString() },
                new PlanFeature { PlanId = plan.Id, FeatureId = canUseAutomations.Id, Value = l.Automations.ToString() },
                new PlanFeature { PlanId = plan.Id, FeatureId = hideBranding.Id, Value = l.HideBranding.ToString() },
                new PlanFeature { PlanId = plan.Id, FeatureId = maxProfessionals.Id, Value = l.Professionals },
                new PlanFeature { PlanId = plan.Id, FeatureId = maxBranches.Id, Value = l.Branches },
                new PlanFeature { PlanId = plan.Id, FeatureId = maxBookings.Id, Value = l.Bookings },
                new PlanFeature { PlanId = plan.Id, FeatureId = maxClients.Id, Value = l.Clients },
                new PlanFeature { PlanId = plan.Id, FeatureId = maxServices.Id, Value = l.Services },
                new PlanFeature { PlanId = plan.Id, FeatureId = maxAdmins.Id, Value = l.Admins }
            );
        }

        await context.SaveChangesAsync();
    }
}
