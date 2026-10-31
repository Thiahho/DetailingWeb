using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace Turneo.Api.Core.Promotions;

// El propio profesional gestiona SUS promociones. El id sale del claim
// "professional_id", nunca del body, así que no puede tocar las de otro.
[ApiController]
[Route("api/professionals/me/promotions")]
[Authorize(Roles = "Professional")]
public class PromotionsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public PromotionsController(ApplicationDbContext context)
    {
        _context = context;
    }

    private int? GetOwnProfessionalId()
    {
        var claim = User.FindFirst("professional_id")?.Value;
        return int.TryParse(claim, out var id) ? id : null;
    }

    [HttpGet]
    public async Task<IActionResult> GetMine()
    {
        var professionalId = GetOwnProfessionalId();
        if (professionalId == null) return Unauthorized();

        var promos = await _context.Promotions
            .Where(p => p.ProfessionalId == professionalId.Value)
            .OrderByDescending(p => p.StartsAt)
            .ToListAsync();

        return Ok(promos.Select(ToResponse));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] PromotionRequest request)
    {
        var professionalId = GetOwnProfessionalId();
        if (professionalId == null) return Unauthorized();

        var error = await ValidateAsync(request, professionalId.Value);
        if (error != null) return BadRequest(new { message = error });

        var promo = new Promotion { ProfessionalId = professionalId.Value };
        Apply(promo, request);
        _context.Promotions.Add(promo);
        await _context.SaveChangesAsync();

        return Ok(ToResponse(promo));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] PromotionRequest request)
    {
        var professionalId = GetOwnProfessionalId();
        if (professionalId == null) return Unauthorized();

        var promo = await _context.Promotions
            .FirstOrDefaultAsync(p => p.Id == id && p.ProfessionalId == professionalId.Value);
        if (promo == null) return NotFound(new { message = "Promoción no encontrada" });

        var error = await ValidateAsync(request, professionalId.Value);
        if (error != null) return BadRequest(new { message = error });

        Apply(promo, request);
        await _context.SaveChangesAsync();

        return Ok(ToResponse(promo));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var professionalId = GetOwnProfessionalId();
        if (professionalId == null) return Unauthorized();

        var promo = await _context.Promotions
            .FirstOrDefaultAsync(p => p.Id == id && p.ProfessionalId == professionalId.Value);
        if (promo == null) return NotFound(new { message = "Promoción no encontrada" });

        _context.Promotions.Remove(promo);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private async Task<string?> ValidateAsync(PromotionRequest r, int professionalId)
    {
        if (r.EndsAt <= r.StartsAt)
            return "La fecha de fin debe ser posterior a la de inicio";
        if (r.DiscountType == PromotionDiscountType.Percent && (r.Value < 1 || r.Value > 100))
            return "El porcentaje debe estar entre 1 y 100";
        if (r.DiscountType == PromotionDiscountType.FixedAmount && r.Value <= 0)
            return "El monto debe ser mayor a 0";
        if (r.ServiceIds == null || r.ServiceIds.Count == 0)
            return "Elegí al menos un servicio";

        // Solo servicios que el propio profesional ofrece.
        var ids = r.ServiceIds.Distinct().ToList();
        var owned = await _context.Professionals
            .Where(p => p.Id == professionalId)
            .SelectMany(p => p.Services)
            .Where(s => ids.Contains(s.Id))
            .CountAsync();
        if (owned != ids.Count)
            return "Algún servicio no corresponde a este profesional";

        return null;
    }

    private static void Apply(Promotion promo, PromotionRequest r)
    {
        promo.Name = r.Name.Trim();
        promo.DiscountType = r.DiscountType;
        promo.Value = r.Value;
        promo.ServiceIds = r.ServiceIds.Distinct().ToList();
        promo.StartsAt = DateTime.SpecifyKind(r.StartsAt, DateTimeKind.Utc);
        promo.EndsAt = DateTime.SpecifyKind(r.EndsAt, DateTimeKind.Utc);
        promo.IsActive = r.IsActive;
        promo.UpdatedAt = DateTime.UtcNow;
    }

    private static object ToResponse(Promotion p) => new
    {
        p.Id,
        p.Name,
        DiscountType = p.DiscountType.ToString(),
        p.Value,
        p.ServiceIds,
        p.StartsAt,
        p.EndsAt,
        p.IsActive
    };
}

// Lectura pública para la reserva: un precio final por servicio con promo vigente.
// Solo expone montos, nunca los datos internos de la promoción.
[ApiController]
[Route("api/professionals/{professionalId:int}/promotions")]
public class PublicPromotionsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IPromotionPricingService _pricing;

    public PublicPromotionsController(ApplicationDbContext context, IPromotionPricingService pricing)
    {
        _context = context;
        _pricing = pricing;
    }

    [HttpGet]
    [AllowAnonymous]
    [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("public-read")]
    public async Task<IActionResult> GetActive(int professionalId)
    {
        var services = await _context.Professionals
            .Where(p => p.Id == professionalId && p.IsActive)
            .SelectMany(p => p.Services)
            .Where(s => s.IsActive)
            .ToListAsync();

        var now = DateTime.UtcNow;
        var result = new List<object>();
        foreach (var service in services)
        {
            var quote = await _pricing.QuoteAsync(professionalId, service, now);
            if (quote == null) continue;
            result.Add(new
            {
                serviceId = service.Id,
                serviceSlug = service.Slug,
                promotionName = quote.PromotionName,
                originalPrice = quote.OriginalPrice,
                discountAmount = quote.DiscountAmount,
                finalPrice = quote.FinalPrice
            });
        }

        return Ok(result);
    }
}

public class PromotionRequest
{
    [Required, StringLength(100, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    public PromotionDiscountType DiscountType { get; set; }

    public decimal Value { get; set; }

    public List<int> ServiceIds { get; set; } = new();

    public DateTime StartsAt { get; set; }

    public DateTime EndsAt { get; set; }

    public bool IsActive { get; set; } = true;
}
