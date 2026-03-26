using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using DetailingApi.Models;

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
    public DbSet<NotificationLog> NotificationLogs { get; set; }
    public DbSet<ClientAccessCode> ClientAccessCodes { get; set; }
    public DbSet<ContentVideo> ContentVideos { get; set; }
    public DbSet<SiteConfig> SiteConfigs { get; set; }
    public DbSet<GalleryItem> GalleryItems { get; set; }
    public DbSet<Payment> Payments { get; set; }


    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configuración User
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(e => e.Email).IsUnique();
        });

        // Configuración TimeSlot
        modelBuilder.Entity<TimeSlot>(entity =>
        {
            entity.HasIndex(e => e.StartDateTime).IsUnique();
            entity.HasIndex(e => e.IsAvailable);
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

        // Configuración BlockedDate
        modelBuilder.Entity<BlockedDate>(entity =>
        {
            entity.HasIndex(e => e.Date).IsUnique();
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
    }
}
