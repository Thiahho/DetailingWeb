namespace Turneo.Api.Core.Payments;

// Vista mínima de un pago de MercadoPago: lo que el webhook necesita para decidir.
public record MercadoPagoPaymentInfo(
    long? Id,
    string? Status,
    string? ExternalReference,
    decimal? TransactionAmount,
    string? CurrencyId,
    string? PaymentMethodId,
    string? PayerEmail);

// Seam sobre el SDK de MercadoPago para poder testear el webhook sin la API real.
public interface IMercadoPagoPaymentGateway
{
    // null = el pago no existe o MercadoPago lo rechazó de forma permanente (4xx).
    // Errores transitorios (red, 5xx, 429) se propagan como excepción.
    Task<MercadoPagoPaymentInfo?> GetPaymentAsync(long paymentId, CancellationToken cancellationToken = default);
}
