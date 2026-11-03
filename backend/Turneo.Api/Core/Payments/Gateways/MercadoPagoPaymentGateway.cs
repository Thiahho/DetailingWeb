using MercadoPago.Client.Payment;
using MercadoPago.Error;

namespace Turneo.Api.Core.Payments;

// Usa MercadoPagoConfig.AccessToken (estático), que el controller setea antes de llamar.
public class MercadoPagoPaymentGateway : IMercadoPagoPaymentGateway
{
    public async Task<MercadoPagoPaymentInfo?> GetPaymentAsync(long paymentId, CancellationToken cancellationToken = default)
    {
        try
        {
            var mpPayment = await new PaymentClient().GetAsync(paymentId, cancellationToken: cancellationToken);
            if (mpPayment == null)
                return null;

            return new MercadoPagoPaymentInfo(
                mpPayment.Id,
                mpPayment.Status,
                mpPayment.ExternalReference,
                mpPayment.TransactionAmount,
                mpPayment.CurrencyId,
                mpPayment.PaymentMethodId,
                mpPayment.Payer?.Email);
        }
        catch (MercadoPagoApiException ex) when (IsPermanentClientError(ex.StatusCode))
        {
            // 4xx (salvo 429): reintentar no lo va a arreglar.
            return null;
        }
    }

    private static bool IsPermanentClientError(int? statusCode) =>
        statusCode is >= 400 and < 500 and not 429;
}
