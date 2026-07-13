using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace TTurnos.Api.Tests.Integration;

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

    public static async Task<Booking> CreateBookingAsync(CustomWebApplicationFactory factory, int tenantId, int timeSlotId, string customerName, string email, string status = BookingStatus.Pending)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var booking = new Booking
        {
            TenantId = tenantId,
            TimeSlotId = timeSlotId,
            CustomerName = customerName,
            CustomerPhone = "1122334455",
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
}
