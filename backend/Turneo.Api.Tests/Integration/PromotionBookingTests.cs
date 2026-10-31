using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;

namespace Turneo.Api.Tests.Integration;

// Al reservar se congela la mejor promo vigente del profesional (sin acumular).
[Collection("Integration")]
public class PromotionBookingTests
{
    private readonly CustomWebApplicationFactory _factory;

    public PromotionBookingTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task SeedPromotionAsync(int tenantId, int professionalId, int serviceId,
        PromotionDiscountType type, decimal value, bool active = true, int startsDaysAgo = 1, int endsInDays = 7)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Promotions.Add(new Promotion
        {
            TenantId = tenantId,
            ProfessionalId = professionalId,
            Name = $"{type} {value}",
            DiscountType = type,
            Value = value,
            ServiceIds = new List<int> { serviceId },
            StartsAt = DateTime.UtcNow.AddDays(-startsDaysAgo),
            EndsAt = DateTime.UtcNow.AddDays(endsInDays),
            IsActive = active
        });
        await db.SaveChangesAsync();
    }

    private async Task<Booking> BookAsync(int tenantId, int professionalId, string serviceSlug)
    {
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId,
            DateTime.UtcNow.AddDays(1), DateTime.UtcNow.AddDays(1).AddHours(1), professionalId);

        var response = await _factory.CreateClient().PostAsJsonAsync("/api/bookings", new
        {
            timeSlotId = slot.Id,
            customerName = "Cliente Promo",
            customerPhone = "1122334455",
            email = $"promo-{Guid.NewGuid():N}@test.com",
            subject = "Corte",
            service = serviceSlug,
            professionalId,
            acceptedTerms = true
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var booking = await TestDataFactory.GetBookingIgnoringTenantAsync(
            _factory, body.GetProperty("booking").GetProperty("id").GetInt32());
        return booking!;
    }

    // Servicio de $1000 (TestDataFactory) y profesional que lo ofrece.
    private async Task<(int TenantId, Professional Professional, Service Service)> ArrangeAsync()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var professional = await TestDataFactory.CreateProfessionalAsync(_factory, tenantId);
        var service = await TestDataFactory.CreateServiceAsync(_factory, tenantId, "Servicio promo");
        return (tenantId, professional, service);
    }

    [Fact]
    public async Task Booking_WithActivePromotion_StoresSnapshot()
    {
        var (tenantId, professional, service) = await ArrangeAsync();
        await SeedPromotionAsync(tenantId, professional.Id, service.Id, PromotionDiscountType.Percent, 20);

        var booking = await BookAsync(tenantId, professional.Id, service.Slug);

        Assert.NotNull(booking.PromotionId);
        Assert.Equal(200m, booking.DiscountAmount);
        Assert.Equal(800m, booking.FinalPrice);
    }

    [Fact]
    public async Task Booking_WithSeveralPromotions_AppliesBestOneWithoutStacking()
    {
        var (tenantId, professional, service) = await ArrangeAsync();
        await SeedPromotionAsync(tenantId, professional.Id, service.Id, PromotionDiscountType.Percent, 10);
        await SeedPromotionAsync(tenantId, professional.Id, service.Id, PromotionDiscountType.FixedAmount, 300);

        var booking = await BookAsync(tenantId, professional.Id, service.Slug);

        Assert.Equal(300m, booking.DiscountAmount);
        Assert.Equal(700m, booking.FinalPrice);
    }

    [Fact]
    public async Task Booking_WithPausedOrExpiredPromotion_HasNoSnapshot()
    {
        var (tenantId, professional, service) = await ArrangeAsync();
        await SeedPromotionAsync(tenantId, professional.Id, service.Id, PromotionDiscountType.Percent, 50, active: false);
        await SeedPromotionAsync(tenantId, professional.Id, service.Id, PromotionDiscountType.Percent, 50, startsDaysAgo: 10, endsInDays: -2);

        var booking = await BookAsync(tenantId, professional.Id, service.Slug);

        Assert.Null(booking.PromotionId);
        Assert.Null(booking.DiscountAmount);
        Assert.Null(booking.FinalPrice);
    }

    [Fact]
    public async Task Booking_WithOtherProfessionalsPromotion_HasNoSnapshot()
    {
        var (tenantId, professional, service) = await ArrangeAsync();
        var other = await TestDataFactory.CreateProfessionalAsync(_factory, tenantId, "Otro");
        await SeedPromotionAsync(tenantId, other.Id, service.Id, PromotionDiscountType.Percent, 50);

        var booking = await BookAsync(tenantId, professional.Id, service.Slug);

        Assert.Null(booking.FinalPrice);
    }
}
