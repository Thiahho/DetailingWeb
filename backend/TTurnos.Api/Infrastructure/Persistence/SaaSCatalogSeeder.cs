using Microsoft.EntityFrameworkCore;

namespace TTurnos.Api.Infrastructure.Persistence;

// Semilla el catálogo de Features y los 6 planes comerciales (Starter, Pro,
// Premium, Enterprise, License, Custom). Los límites son valores de partida
// razonables, editables desde la base — los precios quedan sin definir
// (null) porque son una decisión de negocio real, no algo para inventar acá.
public static class SaaSCatalogSeeder
{
    private const string Unlimited = "-1";

    public static async Task SeedAsync(ApplicationDbContext context)
    {
        if (await context.Features.AnyAsync())
            return;

        var canUseWhatsapp = new Feature { Key = "CanUseWhatsapp", Name = "Notificaciones por WhatsApp", Type = FeatureType.Boolean };
        var canUseAI = new Feature { Key = "CanUseAI", Name = "Funciones con IA", Type = FeatureType.Boolean };
        var maxProfessionals = new Feature { Key = "MaxProfessionals", Name = "Profesionales", Type = FeatureType.Numeric, Description = $"{Unlimited} = sin límite" };
        var maxBranches = new Feature { Key = "MaxBranches", Name = "Sucursales", Type = FeatureType.Numeric, Description = $"{Unlimited} = sin límite" };
        var maxBookings = new Feature { Key = "MaxBookings", Name = "Reservas por mes", Type = FeatureType.Numeric, Description = $"{Unlimited} = sin límite" };

        context.Features.AddRange(canUseWhatsapp, canUseAI, maxProfessionals, maxBranches, maxBookings);
        await context.SaveChangesAsync();

        var plans = new[]
        {
            new Plan { Name = "Starter" },
            new Plan { Name = "Pro" },
            new Plan { Name = "Premium" },
            new Plan { Name = "Enterprise" },
            new Plan { Name = "License" },
            new Plan { Name = "Custom" },
        };
        context.Plans.AddRange(plans);
        await context.SaveChangesAsync();

        // (CanUseWhatsapp, CanUseAI, MaxProfessionals, MaxBranches, MaxBookings)
        var limits = new Dictionary<string, (bool Whatsapp, bool Ai, string Professionals, string Branches, string Bookings)>
        {
            ["Starter"] = (false, false, "1", "1", "50"),
            ["Pro"] = (true, false, "5", "1", "500"),
            ["Premium"] = (true, true, "15", "3", "2000"),
            ["Enterprise"] = (true, true, Unlimited, Unlimited, Unlimited),
            ["License"] = (true, true, Unlimited, Unlimited, Unlimited),
            ["Custom"] = (true, true, Unlimited, Unlimited, Unlimited),
        };

        foreach (var plan in plans)
        {
            var l = limits[plan.Name];
            context.PlanFeatures.AddRange(
                new PlanFeature { PlanId = plan.Id, FeatureId = canUseWhatsapp.Id, Value = l.Whatsapp.ToString() },
                new PlanFeature { PlanId = plan.Id, FeatureId = canUseAI.Id, Value = l.Ai.ToString() },
                new PlanFeature { PlanId = plan.Id, FeatureId = maxProfessionals.Id, Value = l.Professionals },
                new PlanFeature { PlanId = plan.Id, FeatureId = maxBranches.Id, Value = l.Branches },
                new PlanFeature { PlanId = plan.Id, FeatureId = maxBookings.Id, Value = l.Bookings }
            );
        }

        await context.SaveChangesAsync();
    }
}
