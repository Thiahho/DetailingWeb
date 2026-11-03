using System.Globalization;

namespace Turneo.Api.Core.Payments;

// El monto a cobrar lo decide solo el servidor: nunca el cliente.
public static class PaymentAmountResolver
{
    // FinalPrice (precio con promoción acordado al reservar) gana; si no hay,
    // el precio publicado del servicio ("10.000" / "12.500,50"). null = no se
    // pudo determinar un monto positivo.
    public static decimal? Resolve(Booking booking, Service? service)
    {
        if (booking.FinalPrice is > 0)
            return booking.FinalPrice.Value;

        if (service == null || string.IsNullOrWhiteSpace(service.Price))
            return null;

        var normalized = service.Price.Replace(".", "").Replace(",", ".");
        if (decimal.TryParse(normalized, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed) && parsed > 0)
            return parsed;

        return null;
    }
}
