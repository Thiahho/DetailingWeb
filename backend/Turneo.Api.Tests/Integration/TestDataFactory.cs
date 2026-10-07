using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Turneo.Api.Tests.Integration;

// Helpers para sembrar datos directo contra la base del contenedor de test,
// evitando pasar por HTTP (y su rate limiting) solo para armar el fixture de
// cada test. Todas las entidades acá son ITenantScoped: se les asigna
// TenantId explícito, así que el query filter global no interfiere al
// insertar (solo afecta lecturas).
public static class TestDataFactory
{
    public static async Task<int> GetOrCreateLegacyTenantIdAsync(CustomWebApplicationFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var id = await db.Tenants.Where(t => t.Slug == "legacy").Select(t => t.Id).FirstOrDefaultAsync();
        if (id != 0) return id;

        var tenant = new Tenant { Name = "Negocio Legacy", Slug = "legacy", Vertical = "Beauty", CommercialModel = CommercialModel.License };
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();
        return tenant.Id;
    }

    public static async Task<Tenant> CreateTenantAsync(CustomWebApplicationFactory factory, string slug, string name)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var tenant = new Tenant { Name = name, Slug = slug, Vertical = "Beauty", CommercialModel = CommercialModel.SaaS };
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();
        return tenant;
    }

    public static async Task<User> CreateAdminUserAsync(CustomWebApplicationFactory factory, int tenantId, string email, string password)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = new User
        {
            TenantId = tenantId,
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = "Admin"
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    public static async Task<User> CreateStaffUserAsync(CustomWebApplicationFactory factory, int tenantId, string email, string password)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = new User
        {
            TenantId = tenantId,
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = "Staff"
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    // Fila de ModulePermission tal como la deja PermissionsController al guardar
    // la matriz de permisos de un Staff/Profesional.
    public static async Task GrantModulePermissionAsync(CustomWebApplicationFactory factory, int tenantId, int userId, string module,
        bool canView = false, bool canCreate = false, bool canEdit = false, bool canDelete = false)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.ModulePermissions.Add(new Turneo.Api.Core.Roles.ModulePermission
        {
            TenantId = tenantId,
            UserId = userId,
            Module = module,
            CanView = canView,
            CanCreate = canCreate,
            CanEdit = canEdit,
            CanDelete = canDelete
        });
        await db.SaveChangesAsync();
    }

    public static async Task<User> CreateProfessionalUserAsync(CustomWebApplicationFactory factory, int tenantId, int professionalId, string email, string password)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = new User
        {
            TenantId = tenantId,
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = "Professional",
            ProfessionalId = professionalId
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    public static async Task<Service> CreateServiceAsync(CustomWebApplicationFactory factory, int tenantId, string title)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var service = new Service
        {
            TenantId = tenantId,
            Title = title,
            Slug = $"{title.ToLowerInvariant().Replace(' ', '-')}-{Guid.NewGuid():N}",
            Price = "1000",
            IsActive = true
        };
        db.Services.Add(service);
        await db.SaveChangesAsync();
        return service;
    }

    public static async Task<Professional> CreateProfessionalAsync(CustomWebApplicationFactory factory, int tenantId, string firstName = "Profesional", decimal commission = 10)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var professional = new Professional
        {
            TenantId = tenantId,
            FirstName = firstName,
            LastName = "Test",
            CalendarColor = "#7c3aed",
            Commission = commission,
            IsActive = true
        };
        db.Professionals.Add(professional);
        await db.SaveChangesAsync();
        return professional;
    }

    public static async Task<TimeSlot> CreateTimeSlotAsync(CustomWebApplicationFactory factory, int tenantId, DateTime start, DateTime end, int? professionalId = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var slot = new TimeSlot
        {
            TenantId = tenantId,
            StartDateTime = start,
            EndDateTime = end,
            IsAvailable = true,
            ProfessionalId = professionalId
        };
        db.TimeSlots.Add(slot);
        await db.SaveChangesAsync();
        return slot;
    }

    public static async Task<Booking> CreateBookingAsync(CustomWebApplicationFactory factory, int tenantId, int timeSlotId, string customerName, string email, string status = BookingStatus.Pending, string phone = "1122334455")
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var booking = new Booking
        {
            TenantId = tenantId,
            TimeSlotId = timeSlotId,
            CustomerName = customerName,
            CustomerPhone = phone,
            Email = email,
            CustomerEmailNormalized = email.Trim().ToLowerInvariant(),
            Subject = "Corte de pelo",
            Status = status
        };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();
        return booking;
    }

    public static async Task SetTimeSlotAvailabilityAsync(CustomWebApplicationFactory factory, int timeSlotId, bool isAvailable)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await db.TimeSlots.IgnoreQueryFilters().Where(t => t.Id == timeSlotId)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.IsAvailable, isAvailable));
    }

    public static async Task<TimeSlot?> GetTimeSlotIgnoringTenantAsync(CustomWebApplicationFactory factory, int timeSlotId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.TimeSlots.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == timeSlotId);
    }

    public static async Task<Booking?> GetBookingIgnoringTenantAsync(CustomWebApplicationFactory factory, int bookingId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.Bookings.IgnoreQueryFilters().FirstOrDefaultAsync(b => b.Id == bookingId);
    }

    public static async Task<Insumo> CreateInsumoAsync(CustomWebApplicationFactory factory, int tenantId, string name, int stock, int lowStockThreshold = 0)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var insumo = new Insumo
        {
            TenantId = tenantId,
            Name = name,
            Stock = stock,
            LowStockThreshold = lowStockThreshold,
            IsActive = true
        };
        db.Insumos.Add(insumo);
        await db.SaveChangesAsync();
        return insumo;
    }

    public static async Task<Insumo?> GetInsumoIgnoringTenantAsync(CustomWebApplicationFactory factory, int insumoId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.Insumos.IgnoreQueryFilters().FirstOrDefaultAsync(i => i.Id == insumoId);
    }

    public static async Task<SmartTag> CreateSmartTagAsync(CustomWebApplicationFactory factory, int tenantId, string name, string action = "BOOKING", bool isActive = true, string? token = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var tag = new SmartTag
        {
            TenantId = tenantId,
            Name = name,
            Action = action,
            IsActive = isActive,
            Token = token ?? $"TEST{Guid.NewGuid():N}".Substring(0, 12).ToUpperInvariant(),
        };
        db.SmartTags.Add(tag);
        await db.SaveChangesAsync();
        return tag;
    }

    public static async Task RecordSmartTagEventAsync(CustomWebApplicationFactory factory, int smartTagId, int tenantId, string action, string eventType, string? source = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.SmartTagEvents.Add(new SmartTagEvent
        {
            TenantId = tenantId,
            SmartTagId = smartTagId,
            Action = action,
            EventType = eventType,
            Source = source,
        });
        await db.SaveChangesAsync();
    }

    // Upsert: crea SiteConfig para el tenant si todavía no existe (mismo criterio
    // que SiteConfigController.Update, que hace GetAsync ?? new SiteConfig()).
    public static async Task SetGoogleReviewUrlAsync(CustomWebApplicationFactory factory, int tenantId, string url)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var config = await db.SiteConfigs.IgnoreQueryFilters().FirstOrDefaultAsync(s => s.TenantId == tenantId);
        if (config is null)
        {
            config = new SiteConfig { TenantId = tenantId };
            db.SiteConfigs.Add(config);
        }
        config.GoogleReviewUrl = url;
        await db.SaveChangesAsync();
    }

    public static async Task<CustomerProfile> CreateCustomerProfileAsync(CustomWebApplicationFactory factory, int tenantId, string phone, string name)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var profile = new CustomerProfile
        {
            TenantId = tenantId,
            Phone = phone,
            Name = name
        };
        db.CustomerProfiles.Add(profile);
        await db.SaveChangesAsync();
        return profile;
    }
}
