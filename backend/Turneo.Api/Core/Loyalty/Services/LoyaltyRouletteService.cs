using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Core.Loyalty;

// Misma lógica que Marketing.Roulette.RouletteService (weighted pick + código
// único), pero acá TODO queda automáticamente acotado al tenant actual por el
// query filter global de ApplicationDbContext — a diferencia de esa, no hace
// falta filtrar por TenantId a mano en ningún lado.
public class LoyaltyRouletteService
{
    // Sin caracteres ambiguos (0/O, 1/I) para que el código sea fácil de leer/tipear a mano.
    private const string CodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private readonly ApplicationDbContext _context;

    public LoyaltyRouletteService(ApplicationDbContext context)
    {
        _context = context;
    }

    // Un WhatsApp = una participación por negocio. Si ya jugó, se le devuelve
    // el mismo premio que ya ganó (idempotente ante un refresh de página).
    public async Task<LoyaltySpinResponse> SpinAsync(LoyaltySpinRequest request)
    {
        var whatsApp = NormalizePhone(request.WhatsApp);
        if (whatsApp is null)
            throw new ArgumentException("WhatsApp inválido");

        var customerName = request.CustomerName.Trim();
        if (customerName.Length == 0)
            throw new ArgumentException("Nombre requerido");

        var existing = await _context.LoyaltySpins
            .Include(s => s.Prize)
            .FirstOrDefaultAsync(s => s.WhatsApp == whatsApp);

        if (existing is not null)
        {
            return new LoyaltySpinResponse(
                existing.Id,
                existing.Prize!.Name,
                existing.Prize.Description,
                existing.Code,
                existing.ExpiresAt,
                AlreadyParticipated: true);
        }

        var prizes = await _context.LoyaltyPrizes.Where(p => p.IsActive).ToListAsync();
        if (prizes.Count == 0)
            throw new InvalidOperationException("No hay premios activos configurados");

        var prize = PickWeighted(prizes);
        var code = await GenerateUniqueCodeAsync();
        var now = DateTime.UtcNow;

        var spin = new LoyaltySpin
        {
            CustomerName = customerName,
            WhatsApp = whatsApp,
            PrizeId = prize.Id,
            Code = code,
            SpunAt = now,
            ExpiresAt = now.AddDays(prize.ValidityDays),
        };

        _context.LoyaltySpins.Add(spin);
        await _context.SaveChangesAsync();

        return new LoyaltySpinResponse(spin.Id, prize.Name, prize.Description, code, spin.ExpiresAt, AlreadyParticipated: false);
    }

    // Canje manual desde el panel admin (ej. al cobrar en el mostrador).
    public async Task<(bool Success, string? Error)> RedeemAsync(string code, int redeemedByUserId)
    {
        var normalized = code.Trim().ToUpperInvariant();
        var spin = await _context.LoyaltySpins.FirstOrDefaultAsync(s => s.Code == normalized);

        if (spin is null)
            return (false, "Código no encontrado");

        if (spin.Status == LoyaltySpinStatus.Redeemed)
            return (false, "Este código ya fue canjeado");

        if (spin.ExpiresAt < DateTime.UtcNow)
        {
            spin.Status = LoyaltySpinStatus.Expired;
            await _context.SaveChangesAsync();
            return (false, "Este código venció");
        }

        spin.Status = LoyaltySpinStatus.Redeemed;
        spin.RedeemedAt = DateTime.UtcNow;
        spin.RedeemedByUserId = redeemedByUserId;
        await _context.SaveChangesAsync();

        return (true, null);
    }

    private static LoyaltyPrize PickWeighted(List<LoyaltyPrize> prizes)
    {
        var total = prizes.Sum(p => p.Probability);
        var roll = (decimal)RandomNumberGenerator.GetInt32(0, 1_000_000) / 1_000_000m * total;

        decimal cumulative = 0;
        foreach (var prize in prizes.OrderBy(p => p.Id))
        {
            cumulative += prize.Probability;
            if (roll <= cumulative) return prize;
        }

        // Solo por redondeo de punto flotante — en la práctica el loop de arriba siempre matchea antes.
        return prizes[^1];
    }

    private async Task<string> GenerateUniqueCodeAsync()
    {
        for (var attempt = 0; attempt < 5; attempt++)
        {
            Span<char> suffix = stackalloc char[6];
            for (var i = 0; i < suffix.Length; i++)
                suffix[i] = CodeAlphabet[RandomNumberGenerator.GetInt32(CodeAlphabet.Length)];

            var code = $"BENEFICIO-{new string(suffix)}";

            if (!await _context.LoyaltySpins.AnyAsync(s => s.Code == code))
                return code;
        }

        throw new InvalidOperationException("No se pudo generar un código único, reintentar");
    }

    private static string? NormalizePhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return null;
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        return digits.Length < 8 ? null : digits;
    }
}
