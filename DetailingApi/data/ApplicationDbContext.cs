using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using DetailingApi.Models;
using MercadoPago.Resource.Customer;

namespace DetailingApi.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
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

    //Clientes
    public DbSet<CustomerProfile> CustomerProfiles { get; set; }
    public DbSet<ScheduledReminder> ScheduledReminders { get; set; }
    public DbSet<ReminderLog> ReminderLogs { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configuración User
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(e => e.Email).IsUnique();
            // Postgres trata NULL como distinto de NULL, así que esto no molesta a las
            // cuentas (Admin/Client) que nunca configuran username.
            entity.HasIndex(e => e.Username).IsUnique();

            entity.HasOne(u => u.Professional)
                .WithMany()
                .HasForeignKey(u => u.ProfessionalId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // Configuración TimeSlot — índice único compuesto (antes era solo StartDateTime):
        // permite que distintos profesionales tengan turno a la misma hora.
        modelBuilder.Entity<TimeSlot>(entity =>
        {
            entity.HasIndex(e => new { e.StartDateTime, e.ProfessionalId }).IsUnique();
            entity.HasIndex(e => e.IsAvailable);

            entity.HasOne(t => t.Professional)
                .WithMany()
                .HasForeignKey(t => t.ProfessionalId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // Configuración Booking
        modelBuilder.Entity<Booking>(entity =>
        {
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.CustomerEmailNormalized);
            entity.HasIndex(e => e.TimeSlotId)
                .HasFilter("\"Status\" <> 'Cancelled'")
                .IsUnique();
            
            entity.HasOne(b => b.TimeSlot)
                .WithMany(t => t.Bookings)
                .HasForeignKey(b => b.TimeSlotId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(b => b.Professional)
                .WithMany()
                .HasForeignKey(b => b.ProfessionalId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ClientAccessCode>(entity =>
        {
            entity.HasIndex(e => e.Email);
            entity.HasIndex(e => e.ExpiresAt);
        });

        modelBuilder.Entity<NotificationLog>(entity =>
        {
            entity.HasIndex(e => e.BookingId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.NextRetryAt);

            entity.HasOne(e => e.Booking)
                .WithMany()
                .HasForeignKey(e => e.BookingId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Configuración BlockedDate — único compuesto: permite un bloqueo de negocio (ProfessionalId
        // null) y bloqueos individuales por profesional en la misma fecha sin chocar entre sí.
        modelBuilder.Entity<BlockedDate>(entity =>
        {
            entity.HasIndex(e => new { e.Date, e.ProfessionalId }).IsUnique();

            entity.HasOne(b => b.Professional)
                .WithMany()
                .HasForeignKey(b => b.ProfessionalId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // Configuración Service — Details y CustomFieldsSchema almacenados como JSON
        modelBuilder.Entity<Service>(entity =>
        {
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.Property(e => e.Description);
            entity.Property(e => e.Details)
                .HasColumnType("jsonb")
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>()
                );
            entity.Property(e => e.CustomFieldsSchema).HasColumnType("jsonb");
        });

        modelBuilder.Entity<GalleryItem>(entity =>
        {
            entity.HasIndex(e => e.IsActive);
            entity.HasIndex(e => e.Order);
        });

        // Configuración Professional — Schedule almacenado como JSON (jsonb),
        // relación M2M implícita con Service (sin tocar Service.cs).
        modelBuilder.Entity<Professional>(entity =>
        {
            entity.HasIndex(e => e.IsActive);
            entity.HasIndex(e => e.Order);
            entity.Property(e => e.Commission).HasColumnType("decimal(5,2)");
            entity.Property(e => e.Schedule).HasColumnType("jsonb");

            entity.HasMany(p => p.Services)
                  .WithMany()
                  .UsingEntity(j => j.ToTable("ProfessionalServices"));
        });

        modelBuilder.Entity<ContentVideo>(entity =>
        {
            entity.HasIndex(e => e.IsActive);
            entity.HasIndex(e => e.Order);
        });

        modelBuilder.Entity<Payment>(entity =>
        {
            entity.HasIndex(e => e.BookingId).IsUnique();
            entity.HasIndex(e => e.ExternalPaymentId);
            entity.HasIndex(e => e.ExternalPreferenceId);
            entity.HasIndex(e => e.Status);
            entity.Property(e => e.Amount).HasColumnType("decimal(18,2)");

            entity.HasOne(p => p.Booking)
                .WithOne(b => b.Payment)
                .HasForeignKey<Payment>(p => p.BookingId)
                .OnDelete(DeleteBehavior.Cascade);
        });

         modelBuilder.Entity<CustomerProfile>(e =>
    {
        e.HasIndex(x => x.Phone).IsUnique();
    });

    modelBuilder.Entity<ScheduledReminder>(e =>
    {
        e.HasIndex(x => x.Status);
        e.HasIndex(x => x.ScheduledFor);
        e.HasOne(x => x.CustomerProfile)
         .WithMany(x => x.ScheduledReminders)
         .HasForeignKey(x => x.CustomerProfileId)
         .OnDelete(DeleteBehavior.Cascade);
        e.HasOne(x => x.Booking)
         .WithMany()
         .HasForeignKey(x => x.BookingId)
         .OnDelete(DeleteBehavior.SetNull);
    });

    modelBuilder.Entity<ReminderLog>(e =>
    {
        e.HasIndex(x => x.ScheduledReminderId);
        e.HasOne(x => x.ScheduledReminder)
         .WithMany(x => x.Logs)
         .HasForeignKey(x => x.ScheduledReminderId)
         .OnDelete(DeleteBehavior.Cascade);
    });
    
    }
}
