namespace Turneo.Api.Tests.Unit.HomeService;

// The at-home surcharge frozen on the booking is charged on top of the
// promotion price or, without one, the published service price.
public class PaymentAmountResolverSurchargeTests
{
    [Fact]
    public void Resolve_WithSurcharge_AddsItToServicePrice()
    {
        var booking = new Booking { HomeServiceSurcharge = 500m };

        Assert.Equal(1500m, PaymentAmountResolver.Resolve(booking, new Service { Price = "1.000" }));
    }

    [Fact]
    public void Resolve_WithSurcharge_AddsItToPromotionFinalPrice()
    {
        var booking = new Booking { FinalPrice = 800m, HomeServiceSurcharge = 250.50m };

        Assert.Equal(1050.50m, PaymentAmountResolver.Resolve(booking, new Service { Price = "1000" }));
    }

    [Fact]
    public void Resolve_WithZeroSurcharge_KeepsBasePrice()
    {
        var booking = new Booking { HomeServiceSurcharge = 0m };

        Assert.Equal(1000m, PaymentAmountResolver.Resolve(booking, new Service { Price = "1000" }));
    }

    [Fact]
    public void Resolve_WithSurchargeButNoBasePrice_ReturnsNull()
    {
        var booking = new Booking { HomeServiceSurcharge = 500m };

        Assert.Null(PaymentAmountResolver.Resolve(booking, null));
    }
}
