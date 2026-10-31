using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Core.Promotions;

public record PromotionQuote(int PromotionId, string PromotionName, decimal OriginalPrice, decimal DiscountAmount, decimal FinalPrice);

public interface IPromotionPricingService
{
    // Mejor promoción vigente (sin acumular) de un profesional sobre un servicio,
    // o null si no hay ninguna o el precio del servicio no es numérico.
    Task<PromotionQuote?> QuoteAsync(int professionalId, Service service, DateTime nowUtc);

    // Igual que QuoteAsync pero con el slug que la reserva guarda en Booking.Service.
    Task<PromotionQuote?> QuoteBySlugAsync(int professionalId, string? serviceSlug, DateTime nowUtc);
}

// Único lugar que decide qué promo aplica y cuánto vale: la reserva pública,
// el endpoint de lectura y el cobro usan este mismo cálculo.
public class PromotionPricingService : IPromotionPricingService
{
    private readonly ApplicationDbContext _context;

    public PromotionPricingService(ApplicationDbContext context)
    {
        _context = context;
    }

    // Los precios de Service son texto con formato es-AR ("1.500,00").
    public static bool TryParsePrice(string? raw, out decimal price)
    {
        price = 0;
        return !string.IsNullOrWhiteSpace(raw)
            && decimal.TryParse(raw.Replace(".", "").Replace(",", "."),
                System.Globalization.NumberStyles.Number,
                System.Globalization.CultureInfo.InvariantCulture, out price);
    }

    public static decimal DiscountFor(Promotion promo, decimal price)
    {
        var discount = promo.DiscountType == PromotionDiscountType.Percent
            ? price * promo.Value / 100m
            : promo.Value;
        return Math.Round(Math.Min(Math.Max(discount, 0m), price), 2);
    }

    public async Task<PromotionQuote?> QuoteBySlugAsync(int professionalId, string? serviceSlug, DateTime nowUtc)
    {
        if (string.IsNullOrWhiteSpace(serviceSlug))
            return null;

        var service = await _context.Services.FirstOrDefaultAsync(s => s.Slug == serviceSlug);
        return service == null ? null : await QuoteAsync(professionalId, service, nowUtc);
    }

    public async Task<PromotionQuote?> QuoteAsync(int professionalId, Service service, DateTime nowUtc)
    {
        if (!TryParsePrice(service.Price, out var price) || price <= 0)
            return null;

        var candidates = await _context.Promotions
            .Where(p => p.ProfessionalId == professionalId
                && p.IsActive
                && p.StartsAt <= nowUtc && p.EndsAt >= nowUtc
                && p.ServiceIds.Contains(service.Id))
            .ToListAsync();

        var best = candidates
            .Select(p => (Promo: p, Discount: DiscountFor(p, price)))
            .Where(x => x.Discount > 0)
            .OrderByDescending(x => x.Discount)
            .ThenBy(x => x.Promo.Id)
            .FirstOrDefault();

        if (best.Promo == null)
            return null;

        return new PromotionQuote(best.Promo.Id, best.Promo.Name, price, best.Discount, price - best.Discount);
    }
}
