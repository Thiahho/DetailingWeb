using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DetailingApi.Models;

[Table("Payments")]
public class Payment
{
    public int Id { get; set; }
    public int BookingId { get; set; }
    public Booking Booking { get; set; } = null!;

    [Range(0, 9_999_999)]
    public decimal Amount { get; set; }

    [MaxLength(10)]
    public string Currency { get; set; } = "ARS";

    [MaxLength(50)]
    public string Status { get; set; } = PaymentStatus.Pending;

    [MaxLength(50)]
    public string Provider { get; set; } = string.Empty;

    [MaxLength(255)]
    public string? ExternalPaymentId { get; set; }

    [MaxLength(255)]
    public string? ExternalPreferenceId { get; set; }

    [MaxLength(100)]
    public string? PaymentMethod { get; set; }

    [MaxLength(255)]
    [EmailAddress]
    public string? PayerEmail { get; set; }

    [MaxLength(2048)]
    public string? CheckoutUrl { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }
    public DateTime? RefundedAt { get; set; }
}
