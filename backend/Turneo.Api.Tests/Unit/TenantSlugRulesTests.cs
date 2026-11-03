namespace Turneo.Api.Tests.Unit;

public class TenantSlugRulesTests
{
    [Theory]
    [InlineData("abc")]
    [InlineData("salon-belleza")]
    [InlineData("estetica-2024")]
    [InlineData("123")]
    [InlineData("a1b")]
    public void IsValidFormat_WithDnsLabelSlug_ReturnsTrue(string slug)
    {
        Assert.True(TenantSlugRules.IsValidFormat(slug));
    }

    [Fact]
    public void IsValidFormat_WithMaxLengthSlug_ReturnsTrue()
    {
        Assert.True(TenantSlugRules.IsValidFormat(new string('a', 63)));
    }

    [Theory]
    [InlineData("")]
    [InlineData("ab")]
    [InlineData("mi salon")]
    [InlineData("estética")]
    [InlineData("salon.belleza")]
    [InlineData("salon_belleza")]
    [InlineData("Salon")]
    [InlineData("-salon")]
    [InlineData("salon-")]
    [InlineData("salón")]
    public void IsValidFormat_WithInvalidSlug_ReturnsFalse(string slug)
    {
        Assert.False(TenantSlugRules.IsValidFormat(slug));
    }

    [Fact]
    public void IsValidFormat_WithTooLongSlug_ReturnsFalse()
    {
        Assert.False(TenantSlugRules.IsValidFormat(new string('a', 64)));
    }

    [Theory]
    [InlineData("www")]
    [InlineData("api")]
    [InlineData("admin")]
    [InlineData("platform")]
    [InlineData("legacy")]
    [InlineData("turneo")]
    [InlineData("API")]
    public void IsReserved_WithReservedSlug_ReturnsTrue(string slug)
    {
        Assert.True(TenantSlugRules.IsReserved(slug));
    }

    [Fact]
    public void IsReserved_WithRegularSlug_ReturnsFalse()
    {
        Assert.False(TenantSlugRules.IsReserved("salon-belleza"));
    }

    [Fact]
    public void Validate_WithValidSlug_ReturnsNull()
    {
        Assert.Null(TenantSlugRules.Validate("salon-belleza"));
    }

    [Theory]
    [InlineData("mi salon")]
    [InlineData("ab")]
    [InlineData("salon-")]
    public void Validate_WithInvalidFormat_ReturnsError(string slug)
    {
        Assert.False(string.IsNullOrWhiteSpace(TenantSlugRules.Validate(slug)));
    }

    [Fact]
    public void Validate_WithReservedSlug_ReturnsDifferentErrorThanFormat()
    {
        var reservedError = TenantSlugRules.Validate("admin");
        var formatError = TenantSlugRules.Validate("mi salon");

        Assert.False(string.IsNullOrWhiteSpace(reservedError));
        Assert.NotEqual(formatError, reservedError);
    }
}
