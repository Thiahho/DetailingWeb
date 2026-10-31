namespace Turneo.Api.Tests.Integration;

// Cálculo puro de precios con promoción: no toca la base, corre sin Docker.
public class PromotionPricingTests
{
    [Theory]
    [InlineData("1.500,00", 1500)]
    [InlineData("1000", 1000)]
    [InlineData("2.500", 2500)]
    [InlineData("99,50", 99.5)]
    public void TryParsePrice_UnderstandsArgentineFormat(string raw, double expected)
    {
        Assert.True(PromotionPricingService.TryParsePrice(raw, out var price));
        Assert.Equal((decimal)expected, price);
    }

    [Theory]
    [InlineData("")]
    [InlineData("consultar")]
    [InlineData(null)]
    public void TryParsePrice_RejectsNonNumeric(string? raw)
    {
        Assert.False(PromotionPricingService.TryParsePrice(raw, out _));
    }

    [Fact]
    public void DiscountFor_Percent_IsProportional()
    {
        var promo = new Promotion { DiscountType = PromotionDiscountType.Percent, Value = 20 };

        Assert.Equal(200m, PromotionPricingService.DiscountFor(promo, 1000m));
    }

    [Fact]
    public void DiscountFor_FixedAmount_IsCappedAtPrice()
    {
        var promo = new Promotion { DiscountType = PromotionDiscountType.FixedAmount, Value = 5000 };

        Assert.Equal(1000m, PromotionPricingService.DiscountFor(promo, 1000m));
    }

    [Fact]
    public void DiscountFor_FixedAmount_SubtractsExactValue()
    {
        var promo = new Promotion { DiscountType = PromotionDiscountType.FixedAmount, Value = 150 };

        Assert.Equal(150m, PromotionPricingService.DiscountFor(promo, 1000m));
    }
}
