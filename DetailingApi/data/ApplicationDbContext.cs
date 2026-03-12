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
            entity.HasIndex(e => e.TimeSlotId)
                .HasFilter("\"Status\" <> 'Cancelled'")
                .IsUnique();
            
            entity.HasOne(b => b.TimeSlot)
                .WithMany(t => t.Bookings)
                .HasForeignKey(b => b.TimeSlotId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Configuración BlockedDate
        modelBuilder.Entity<BlockedDate>(entity =>
        {
            entity.HasIndex(e => e.Date).IsUnique();
        });

        // Configuración Service — Details almacenado como JSON
        modelBuilder.Entity<Service>(entity =>
        {
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.Property(e=> e.Description);
            entity.Property(e => e.Details)
                .HasColumnType("jsonb")
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>()
                );
        });
    }
}
