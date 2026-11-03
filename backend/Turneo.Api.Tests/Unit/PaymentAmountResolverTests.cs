namespace Turneo.Api.Tests.Unit;

public class PaymentAmountResolverTests
{
    [Fact]
    public void Resolve_WithFinalPrice_UsesFinalPriceOverServicePrice()
    {
        var booking = new Booking { FinalPrice = 8500m };
        var service = new Service { Price = "10.000" };

        Assert.Equal(8500m, PaymentAmountResolver.Resolve(booking, service));
    }

    [Theory]
    [InlineData("10.000", 10000)]
    [InlineData("12.500,50", 12500.50)]
    [InlineData("7000", 7000)]
    public void Resolve_WithoutFinalPrice_UsesParsedServicePrice(string price, double expected)
    {
        var booking = new Booking { FinalPrice = null };
        var service = new Service { Price = price };

        Assert.Equal((decimal)expected, PaymentAmountResolver.Resolve(booking, service));
    }

    [Fact]
    public void Resolve_WithZeroFinalPrice_FallsBackToServicePrice()
    {
        var booking = new Booking { FinalPrice = 0m };
        var service = new Service { Price = "5.000" };

        Assert.Equal(5000m, PaymentAmountResolver.Resolve(booking, service));
    }

    [Theory]
    [InlineData("Consultar")]
    [InlineData("")]
    public void Resolve_WithUnparseableServicePrice_ReturnsNull(string price)
    {
        var booking = new Booking { FinalPrice = null };
        var service = new Service { Price = price };

        Assert.Null(PaymentAmountResolver.Resolve(booking, service));
    }

    [Fact]
    public void Resolve_WithoutFinalPriceOrService_ReturnsNull()
    {
        Assert.Null(PaymentAmountResolver.Resolve(new Booking(), null));
    }

    [Fact]
    public void Resolve_WithNonPositiveServicePrice_ReturnsNull()
    {
        Assert.Null(PaymentAmountResolver.Resolve(new Booking(), new Service { Price = "0" }));
    }
}
