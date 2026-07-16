using System.ComponentModel.DataAnnotations.Schema;

namespace TTurnos.Api.Core.Bookings;

[Table("BookingItems")]
public class BookingItem : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public int BookingId { get; set; }
    public Booking Booking { get; set; } = null!;
    public string ItemType { get; set; } = BookingItemType.Product;
    public int? ServiceId { get; set; }
    public Service? Service { get; set; }
    public int? ProductId { get; set; }
    public Product? Product { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Quantity { get; set; } = 1;
    public decimal UnitPrice { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
