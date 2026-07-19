using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MercadoPago.Resource.Customer;

namespace TTurnos.Api.Infrastructure.Persistence;

public class ApplicationDbContext : DbContext
{
    private readonly ICurrentTenant _currentTenant;

    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options, ICurrentTenant currentTenant)
        : base(options)
    {
        _currentTenant = currentTenant;
    }

    // Completa TenantId automáticamente en cada entidad nueva antes de guardar,
    // así ningún Controller/Service tiene que acordarse de setearlo a mano.
    public override int SaveChanges()
    {
        ApplyTenantId();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyTenantId();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void ApplyTenantId()
    {
        foreach (var entry in ChangeTracker.Entries<ITenantScoped>())
        {
            if (entry.State == EntityState.Added && entry.Entity.TenantId == 0)
                entry.Entity.TenantId = _currentTenant.TenantId;
        }
    }

    // SaaS — no son tenant-scoped, son lo que un tenant referencia.
    public DbSet<Tenant> Tenants { get; set; }
    public DbSet<Module> Modules { get; set; }
    public DbSet<TenantModule> TenantModules { get; set; }
    public DbSet<Plan> Plans { get; set; }
    public DbSet<Subscription> Subscriptions { get; set; }
    public DbSet<License> Licenses { get; set; }
    public DbSet<UsageRecord> UsageRecords { get; set; }
    public DbSet<Feature> Features { get; set; }
    public DbSet<PlanFeature> PlanFeatures { get; set; }

    // Enterprise
    public DbSet<Branch> Branches { get; set; }
    public DbSet<Theme> Themes { get; set; }

    // Modules/Beauty
    public DbSet<Treatment> Treatments { get; set; }

    public DbSet<User> Users { get; set; }
    public DbSet<ModulePermission> ModulePermissions { get; set; }
    public DbSet<BusinessSettings> BusinessSettings { get; set; }
    public DbSet<BlockedDate> BlockedDates { get; set; }
    public DbSet<TimeSlot> TimeSlots { get; set; }
    public DbSet<Booking> Bookings { get; set; }
    public DbSet<Service> Services { get; set; }
    public DbSet<Professional> Professionals { get; set; }
    public DbSet<NotificationLog> NotificationLogs { get; set; }
    public DbSet<ClientAccessCode> ClientAccessCodes { get; set; }
    public DbSet<ContentVideo> ContentVideos { get; set; }
    public DbSet<SiteConfig> SiteConfigs { get; set; }
    public DbSet<GalleryItem> GalleryItems { get; set; }
    public DbSet<Payment> Payments { get; set; }
    public DbSet<Product> Products { get; set; }
    public DbSet<Insumo> Insumos { get; set; }
    public DbSet<ServiceInsumo> ServiceInsumos { get; set; }
    public DbSet<BookingItem> BookingItems { get; set; }
    public DbSet<CajaSession> CajaSessions { get; set; }
    public DbSet<CajaMovement> CajaMovements { get; set; }

    //Clientes
    public DbSet<CustomerProfile> CustomerProfiles { get; set; }
    public DbSet<ScheduledReminder> ScheduledReminders { get; set; }
    public DbSet<ReminderLog> ReminderLogs { get; set; }

    //Automatizaciones
    public DbSet<AutomationRule> AutomationRules { get; set; }
    public DbSet<AutomationRuleExecution> AutomationRuleExecutions { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ── SaaS ──────────────────────────────────────────────────────────
        modelBuilder.Entity<Tenant>(entity =>
        {
            entity.HasIndex(e => e.Slug).IsUnique();

            entity.HasOne(e => e.Plan)
                .WithMany()
                .HasForeignKey(e => e.PlanId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Module>(entity =>
        {
            entity.HasIndex(e => e.Key).IsUnique();
        });

        modelBuilder.Entity<TenantModule>(entity =>
        {
            entity.HasIndex(e => new { e.TenantId, e.ModuleId }).IsUnique();

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Module)
                .WithMany()
                .HasForeignKey(e => e.ModuleId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Subscription>(entity =>
        {
            entity.HasIndex(e => e.TenantId);

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Plan)
                .WithMany()
                .HasForeignKey(e => e.PlanId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<License>(entity =>
        {
            entity.HasIndex(e => e.TenantId);
            entity.HasIndex(e => e.LicenseKey).IsUnique();

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UsageRecord>(entity =>
        {
            entity.HasIndex(e => new { e.TenantId, e.Metric, e.Period });

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Feature>(entity =>
        {
            entity.HasIndex(e => e.Key).IsUnique();
        });

        modelBuilder.Entity<PlanFeature>(entity =>
        {
            entity.HasIndex(e => new { e.PlanId, e.FeatureId }).IsUnique();

            entity.HasOne(e => e.Plan)
                .WithMany()
                .HasForeignKey(e => e.PlanId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Feature)
                .WithMany()
                .HasForeignKey(e => e.FeatureId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ── Enterprise ───────────────────────────────────────────────────
        modelBuilder.Entity<Branch>(entity =>
        {
            entity.HasIndex(e => e.TenantId);

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasQueryFilter(e => e.TenantId == _currentTenant.TenantId);
        });

        modelBuilder.Entity<Theme>(entity =>
        {
            entity.HasIndex(e => e.TenantId).IsUnique();

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasQueryFilter(e => e.TenantId == _currentTenant.TenantId);
        });

        // ── Modules/Beauty ───────────────────────────────────────────────
        modelBuilder.Entity<Treatment>(entity =>
        {
            entity.HasIndex(e => e.ServiceId).IsUnique();

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Service)
                .WithMany()
                .HasForeignKey(e => e.ServiceId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasQueryFilter(e => e.TenantId == _currentTenant.TenantId);
        });

        // ── Core (todas tenant-scoped: FK a Tenant + query filter global) ──

        // Configuración User
        modelBuilder.Entity<User>(entity =>
        {
            // Únicos por tenant, no globales: dos tenants distintos pueden tener
            // cada uno un admin con el mismo email.
            entity.HasIndex(e => new { e.TenantId, e.Email }).IsUnique();
            // Postgres trata NULL como distinto de NULL, así que esto no molesta a las
            // cuentas (Admin/Client) que nunca configuran username.
            entity.HasIndex(e => new { e.TenantId, e.Username }).IsUnique();

            entity.HasOne(u => u.Tenant)
                .WithMany()
                .HasForeignKey(u => u.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(u => u.Professional)
                .WithMany()
                .HasForeignKey(u => u.ProfessionalId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasQueryFilter(e => e.TenantId == _currentTenant.TenantId);
        });

        modelBuilder.Entity<ModulePermission>(entity =>
        {
            entity.HasIndex(e => new { e.UserId, e.Module }).IsUnique();

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasQueryFilter(e => e.TenantId == _currentTenant.TenantId);
        });

        // Configuración TimeSlot — índice único compuesto (antes era solo StartDateTime):
        // permite que distintos profesionales tengan turno a la misma hora.
        modelBuilder.Entity<TimeSlot>(entity =>
        {
            entity.HasIndex(e => new { e.TenantId, e.StartDateTime, e.ProfessionalId }).IsUnique();
            entity.HasIndex(e => e.IsAvailable);

            entity.HasOne(t => t.Tenant)
                .WithMany()
                .HasForeignKey(t => t.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(t => t.Professional)
                .WithMany()
                .HasForeignKey(t => t.ProfessionalId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasQueryFilter(e => e.TenantId == _currentTenant.TenantId);
        });

        // Configuración Booking
        modelBuilder.Entity<Booking>(entity =>
        {
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.CustomerEmailNormalized);
            entity.HasIndex(e => e.TimeSlotId)
                .HasFilter("\"Status\" <> 'Cancelled'")
                .IsUnique();

            entity.Property(e => e.PhotoUrlsBefore).HasColumnType("jsonb");
            entity.Property(e => e.PhotoUrlsAfter).HasColumnType("jsonb");

            entity.HasOne(b => b.Tenant)
                .WithMany()
                .HasForeignKey(b => b.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(b => b.TimeSlot)
                .WithMany(t => t.Bookings)
                .HasForeignKey(b => b.TimeSlotId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(b => b.Professional)
                .WithMany()
                .HasForeignKey(b => b.ProfessionalId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasQueryFilter(e => e.TenantId == _currentTenant.TenantId);
        });

        modelBuilder.Entity<ClientAccessCode>(entity =>
        {
            entity.HasIndex(e => e.Email);
            entity.HasIndex(e => e.ExpiresAt);

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(e => e.TenantId == _currentTenant.TenantId);
        });

        modelBuilder.Entity<NotificationLog>(entity =>
        {
            entity.HasIndex(e => e.BookingId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.NextRetryAt);

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Booking)
                .WithMany()
                .HasForeignKey(e => e.BookingId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasQueryFilter(e => e.TenantId == _currentTenant.TenantId);
        });

        // Configuración BlockedDate — único compuesto: permite un bloqueo de negocio (ProfessionalId
        // null) y bloqueos individuales por profesional en la misma fecha sin chocar entre sí.
        modelBuilder.Entity<BlockedDate>(entity =>
        {
            entity.HasIndex(e => new { e.TenantId, e.Date, e.ProfessionalId }).IsUnique();

            entity.HasOne(b => b.Tenant)
                .WithMany()
                .HasForeignKey(b => b.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(b => b.Professional)
                .WithMany()
                .HasForeignKey(b => b.ProfessionalId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasQueryFilter(e => e.TenantId == _currentTenant.TenantId);
        });

        // Configuración Service — Details y CustomFieldsSchema almacenados como JSON
        modelBuilder.Entity<Service>(entity =>
        {
            entity.HasIndex(e => new { e.TenantId, e.Slug }).IsUnique();
            entity.Property(e => e.Description);
            entity.Property(e => e.Details)
                .HasColumnType("jsonb")
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>()
                );
            entity.Property(e => e.CustomFieldsSchema).HasColumnType("jsonb");

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(e => e.TenantId == _currentTenant.TenantId);
        });

        modelBuilder.Entity<GalleryItem>(entity =>
        {
            entity.HasIndex(e => e.IsActive);
            entity.HasIndex(e => e.Order);

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(e => e.TenantId == _currentTenant.TenantId);
        });

        // Configuración Professional — Schedule almacenado como JSON (jsonb),
        // relación M2M implícita con Service (sin tocar Service.cs).
        modelBuilder.Entity<Professional>(entity =>
        {
            entity.HasIndex(e => e.IsActive);
            entity.HasIndex(e => e.Order);
            entity.Property(e => e.Commission).HasColumnType("decimal(5,2)");
            entity.Property(e => e.Schedule).HasColumnType("jsonb");

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(p => p.Services)
                  .WithMany()
                  .UsingEntity(j => j.ToTable("ProfessionalServices"));

            entity.HasQueryFilter(e => e.TenantId == _currentTenant.TenantId);
        });

        modelBuilder.Entity<ContentVideo>(entity =>
        {
            entity.HasIndex(e => e.IsActive);
            entity.HasIndex(e => e.Order);

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(e => e.TenantId == _currentTenant.TenantId);
        });

        modelBuilder.Entity<Payment>(entity =>
        {
            entity.HasIndex(e => e.BookingId).IsUnique();
            entity.HasIndex(e => e.ExternalPaymentId);
            entity.HasIndex(e => e.ExternalPreferenceId);
            entity.HasIndex(e => e.Status);
            entity.Property(e => e.Amount).HasColumnType("decimal(18,2)");

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(p => p.Booking)
                .WithOne(b => b.Payment)
                .HasForeignKey<Payment>(p => p.BookingId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasQueryFilter(e => e.TenantId == _currentTenant.TenantId);
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.Property(e => e.Price).HasColumnType("decimal(18,2)");

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(e => e.TenantId == _currentTenant.TenantId);
        });

        modelBuilder.Entity<Insumo>(entity =>
        {
            entity.Property(e => e.UnitCost).HasColumnType("decimal(18,2)");

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(e => e.TenantId == _currentTenant.TenantId);
        });

        modelBuilder.Entity<ServiceInsumo>(entity =>
        {
            entity.HasIndex(e => new { e.TenantId, e.ServiceId, e.InsumoId }).IsUnique();

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Service)
                .WithMany()
                .HasForeignKey(e => e.ServiceId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Insumo)
                .WithMany()
                .HasForeignKey(e => e.InsumoId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(e => e.TenantId == _currentTenant.TenantId);
        });

        modelBuilder.Entity<BookingItem>(entity =>
        {
            entity.Property(e => e.UnitPrice).HasColumnType("decimal(18,2)");

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Booking)
                .WithMany(b => b.Items)
                .HasForeignKey(e => e.BookingId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Service)
                .WithMany()
                .HasForeignKey(e => e.ServiceId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.Product)
                .WithMany()
                .HasForeignKey(e => e.ProductId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.Insumo)
                .WithMany()
                .HasForeignKey(e => e.InsumoId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasQueryFilter(e => e.TenantId == _currentTenant.TenantId);
        });

        modelBuilder.Entity<CajaSession>(entity =>
        {
            entity.Property(e => e.OpeningCashBalance).HasColumnType("decimal(18,2)");
            entity.Property(e => e.ClosingCashCounted).HasColumnType("decimal(18,2)");

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(e => e.TenantId == _currentTenant.TenantId);
        });

        modelBuilder.Entity<CajaMovement>(entity =>
        {
            entity.Property(e => e.Amount).HasColumnType("decimal(18,2)");

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.CajaSession)
                .WithMany(s => s.Movements)
                .HasForeignKey(e => e.CajaSessionId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Booking)
                .WithMany()
                .HasForeignKey(e => e.BookingId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.RefundOfMovement)
                .WithMany()
                .HasForeignKey(e => e.RefundOfMovementId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasQueryFilter(e => e.TenantId == _currentTenant.TenantId);
        });

        modelBuilder.Entity<BusinessSettings>(entity =>
        {
            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(e => e.TenantId == _currentTenant.TenantId);
        });

        modelBuilder.Entity<SiteConfig>(entity =>
        {
            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(e => e.TenantId == _currentTenant.TenantId);
        });

        modelBuilder.Entity<CustomerProfile>(e =>
        {
            // Único por tenant: dos salones distintos pueden tener cada uno un
            // cliente con el mismo teléfono.
            e.HasIndex(x => new { x.TenantId, x.Phone }).IsUnique();
            e.Property(x => x.PhotoUrls).HasColumnType("jsonb");

            e.HasOne(x => x.Tenant)
                .WithMany()
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(x => x.FavoriteProfessional)
                .WithMany()
                .HasForeignKey(x => x.FavoriteProfessionalId)
                .OnDelete(DeleteBehavior.SetNull);

            e.HasQueryFilter(x => x.TenantId == _currentTenant.TenantId);
        });

        modelBuilder.Entity<ScheduledReminder>(e =>
        {
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.ScheduledFor);

            e.HasOne(x => x.Tenant)
                .WithMany()
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(x => x.CustomerProfile)
             .WithMany(x => x.ScheduledReminders)
             .HasForeignKey(x => x.CustomerProfileId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Booking)
             .WithMany()
             .HasForeignKey(x => x.BookingId)
             .OnDelete(DeleteBehavior.SetNull);

            e.HasQueryFilter(x => x.TenantId == _currentTenant.TenantId);
        });

        modelBuilder.Entity<ReminderLog>(e =>
        {
            e.HasIndex(x => x.ScheduledReminderId);

            e.HasOne(x => x.Tenant)
                .WithMany()
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(x => x.ScheduledReminder)
             .WithMany(x => x.Logs)
             .HasForeignKey(x => x.ScheduledReminderId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasQueryFilter(x => x.TenantId == _currentTenant.TenantId);
        });

        // ── Automatizaciones ──────────────────────────────────────────────
        modelBuilder.Entity<AutomationRule>(e =>
        {
            e.HasOne(x => x.Tenant)
                .WithMany()
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasQueryFilter(x => x.TenantId == _currentTenant.TenantId);
        });

        modelBuilder.Entity<AutomationRuleExecution>(e =>
        {
            e.HasIndex(x => new { x.AutomationRuleId, x.CustomerProfileId, x.ExecutedAt });

            e.HasOne(x => x.Tenant)
                .WithMany()
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(x => x.AutomationRule)
             .WithMany()
             .HasForeignKey(x => x.AutomationRuleId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.CustomerProfile)
             .WithMany()
             .HasForeignKey(x => x.CustomerProfileId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.ScheduledReminder)
             .WithMany()
             .HasForeignKey(x => x.ScheduledReminderId)
             .OnDelete(DeleteBehavior.SetNull);

            e.HasQueryFilter(x => x.TenantId == _currentTenant.TenantId);
        });
    }
}
