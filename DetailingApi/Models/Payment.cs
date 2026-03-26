namespace DetailingApi.Models;

public class Payment
{
    public int Id { get; set; }
    public int BookingId { get; set; }
    public Booking Booking { get; set; } = null!;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "ARS";
    public string Status { get; set; } = PaymentStatus.Pending;
    public string Provider { get; set; } = string.Empty; // "MercadoPago" or "Stripe"
    public string? ExternalPaymentId { get; set; }
    public string? ExternalPreferenceId { get; set; }
    public string? PaymentMethod { get; set; }
    public string? PayerEmail { get; set; }
    public string? CheckoutUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }
    public DateTime? RefundedAt { get; set; }
}
