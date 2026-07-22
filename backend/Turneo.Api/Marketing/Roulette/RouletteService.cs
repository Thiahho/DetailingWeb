using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Marketing.Roulette;

public class RouletteService
{
    // Sin caracteres ambiguos (0/O, 1/I) para que el código sea fácil de leer/tipear a mano.
    private const string CodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private readonly ApplicationDbContext _context;

    public RouletteService(ApplicationDbContext context)
    {
        _context = context;
    }

    // Un WhatsApp = una participación (ver sección 18 del PDF). Si ya jugó,
    // no vuelve a girar: se le devuelve el mismo premio que ya ganó, así un
    // refresh de página no lo deja afuera ni le da una segunda chance.
    public async Task<SpinResponse> SpinAsync(SpinRequest request, string? ipAddress)
    {
        var whatsApp = NormalizePhone(request.WhatsApp);
        if (whatsApp is null)
            throw new ArgumentException("WhatsApp inválido");

        var nombreNegocio = request.NombreNegocio.Trim();
        if (nombreNegocio.Length == 0)
            throw new ArgumentException("Nombre del negocio requerido");

        var existing = await _context.RouletteLeads
            .Include(l => l.Prize)
            .FirstOrDefaultAsync(l => l.WhatsApp == whatsApp);

        if (existing is not null)
        {
            return new SpinResponse(
                existing.Id,
                existing.Prize!.Name,
                existing.Prize.Description,
                existing.CodigoPromocional,
                existing.CodigoVenceAt,
                YaHabiaParticipado: true);
        }

        var prizes = await _context.RoulettePrizes.Where(p => p.IsActive).ToListAsync();
        if (prizes.Count == 0)
            throw new InvalidOperationException("No hay premios activos configurados");

        var prize = PickWeighted(prizes);
        var code = await GenerateUniqueCodeAsync(prize);
        var now = DateTime.UtcNow;

        var lead = new RouletteLead
        {
            NombreNegocio = nombreNegocio,
            NombreResponsable = NullIfBlank(request.NombreResponsable),
            WhatsApp = whatsApp,
            PrizeId = prize.Id,
            CodigoPromocional = code,
            FechaParticipacion = now,
            CodigoVenceAt = now.AddDays(prize.ValidityDays),
            Fuente = NullIfBlank(request.Fuente),
            Campaign = NullIfBlank(request.Campaign),
            IpAddress = ipAddress,
        };

        _context.RouletteLeads.Add(lead);
        await _context.SaveChangesAsync();

        return new SpinResponse(lead.Id, prize.Name, prize.Description, code, lead.CodigoVenceAt, YaHabiaParticipado: false);
    }

    // No bloquea el premio por pedir más datos (sección 14 del PDF): siempre
    // pisa solo los campos que vengan con valor, nunca borra lo que ya había.
    public async Task<bool> AddAdditionalDataAsync(int leadId, AdditionalDataRequest request)
    {
        var lead = await _context.RouletteLeads.FindAsync(leadId);
        if (lead is null) return false;

        if (NullIfBlank(request.Email) is { } email) lead.Email = email;
        if (NullIfBlank(request.Instagram) is { } instagram) lead.Instagram = instagram;
        if (NullIfBlank(request.TipoNegocio) is { } tipoNegocio) lead.TipoNegocio = tipoNegocio;
        if (NullIfBlank(request.CantidadProfesionales) is { } cantidad) lead.CantidadProfesionales = cantidad;
        if (NullIfBlank(request.ProblemaPrincipal) is { } problema) lead.ProblemaPrincipal = problema;

        await _context.SaveChangesAsync();
        return true;
    }

    private static RoulettePrize PickWeighted(List<RoulettePrize> prizes)
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

    private async Task<string> GenerateUniqueCodeAsync(RoulettePrize prize)
    {
        for (var attempt = 0; attempt < 5; attempt++)
        {
            Span<char> suffix = stackalloc char[4];
            for (var i = 0; i < suffix.Length; i++)
                suffix[i] = CodeAlphabet[RandomNumberGenerator.GetInt32(CodeAlphabet.Length)];

            var code = $"TURNEO-{prize.CodeSlug}-{new string(suffix)}";

            if (!await _context.RouletteLeads.AnyAsync(l => l.CodigoPromocional == code))
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

    private static string? NullIfBlank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
