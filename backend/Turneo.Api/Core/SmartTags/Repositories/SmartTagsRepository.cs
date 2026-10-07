using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Core.SmartTags;

public class SmartTagsRepository : ISmartTagsRepository
{
    private readonly ApplicationDbContext _context;

    public SmartTagsRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<List<SmartTag>> GetAllAsync() =>
        _context.SmartTags.OrderByDescending(t => t.CreatedAt).ToListAsync();

    public Task<SmartTag?> GetByIdAsync(int id) =>
        _context.SmartTags.FirstOrDefaultAsync(t => t.Id == id);

    public async Task<SmartTag> CreateAsync(SmartTag tag)
    {
        tag.Token = await GenerateUniqueTokenAsync();
        _context.SmartTags.Add(tag);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Colisión de carrera pese a la verificación previa (dos requests generando
            // el mismo token al mismo tiempo): el índice único de Postgres la atrapó,
            // reintentar una vez con un token nuevo.
            tag.Token = await GenerateUniqueTokenAsync();
            await _context.SaveChangesAsync();
        }

        return tag;
    }

    public async Task<SmartTag?> UpdateAsync(int id, Action<SmartTag> apply)
    {
        var tag = await _context.SmartTags.FirstOrDefaultAsync(t => t.Id == id);
        if (tag is null) return null;

        apply(tag);
        tag.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return tag;
    }

    public async Task<SmartTag?> SetActiveAsync(int id, bool isActive)
    {
        var tag = await _context.SmartTags.FirstOrDefaultAsync(t => t.Id == id);
        if (tag is null) return null;

        tag.IsActive = isActive;
        tag.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return tag;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var tag = await _context.SmartTags.FirstOrDefaultAsync(t => t.Id == id);
        if (tag is null) return false;

        _context.SmartTags.Remove(tag);
        await _context.SaveChangesAsync();
        return true;
    }

    public Task<SmartTag?> FindActiveByTokenIgnoringTenantAsync(string token) =>
        _context.SmartTags
            .IgnoreQueryFilters()
            .Include(t => t.Tenant)
            .FirstOrDefaultAsync(t => t.Token == token && t.IsActive);

    public async Task RecordEventAsync(int smartTagId, int tenantId, string action, string eventType, string? source = null)
    {
        // TenantId explícito: este método corre desde el endpoint público, donde
        // ICurrentTenant no está resuelto de forma confiable (ver SmartLinkController).
        // ApplyTenantId no lo pisa porque solo completa TenantId cuando vale 0.
        _context.SmartTagEvents.Add(new SmartTagEvent
        {
            TenantId = tenantId,
            SmartTagId = smartTagId,
            Action = action,
            EventType = eventType,
            Source = source,
        });
        await _context.SaveChangesAsync();
    }

    private record EventCount(string EventType, string? Source, int Count);

    public async Task<SmartTagAnalyticsRow?> GetAnalyticsForTagAsync(int smartTagId)
    {
        var tag = await _context.SmartTags.FirstOrDefaultAsync(t => t.Id == smartTagId);
        if (tag is null) return null;

        var counts = await _context.SmartTagEvents
            .Where(e => e.SmartTagId == smartTagId)
            .GroupBy(e => new { e.EventType, e.Source })
            .Select(g => new EventCount(g.Key.EventType, g.Key.Source, g.Count()))
            .ToListAsync();

        return ToAnalyticsRow(tag, counts);
    }

    public async Task<List<SmartTagAnalyticsRow>> GetAnalyticsSummaryAsync()
    {
        var tags = await _context.SmartTags.ToListAsync();

        // (SmartTagId, EventType, Source, Count) — se separa por tag en memoria abajo
        // (mismo criterio que AnalyticsRepository.GetProfessionalStatsAsync:
        // post-procesar tras el ToListAsync cuando agrupar dos veces no
        // aporta nada sobre traer todo junto una sola vez).
        var counts = await _context.SmartTagEvents
            .GroupBy(e => new { e.SmartTagId, e.EventType, e.Source })
            .Select(g => new { g.Key.SmartTagId, g.Key.EventType, g.Key.Source, Count = g.Count() })
            .ToListAsync();

        return tags
            .Select(tag => ToAnalyticsRow(tag, counts
                .Where(c => c.SmartTagId == tag.Id)
                .Select(c => new EventCount(c.EventType, c.Source, c.Count))))
            .ToList();
    }

    private static SmartTagAnalyticsRow ToAnalyticsRow(SmartTag tag, IEnumerable<EventCount> eventCounts)
    {
        var interactions = eventCounts
            .Where(c => c.EventType == SmartTagEventType.Interaction)
            .ToList();
        var completions = eventCounts
            .Where(c => c.EventType == SmartTagEventType.BookingCompleted || c.EventType == SmartTagEventType.ReviewCompleted)
            .ToList();

        return new SmartTagAnalyticsRow(
            tag.Id, tag.Name, tag.Action,
            interactions.Sum(c => c.Count), completions.Sum(c => c.Count),
            ToSourceBreakdown(interactions), ToSourceBreakdown(completions));
    }

    // Unknown agrupa los eventos sin canal reconocido (null u otro valor), así
    // la suma de los tres siempre da el total.
    private static SmartTagSourceBreakdown ToSourceBreakdown(IReadOnlyCollection<EventCount> counts)
    {
        var nfc = counts.Where(c => c.Source == SmartTagSource.Nfc).Sum(c => c.Count);
        var qr = counts.Where(c => c.Source == SmartTagSource.Qr).Sum(c => c.Count);

        return new SmartTagSourceBreakdown(nfc, qr, counts.Sum(c => c.Count) - nfc - qr);
    }

    private async Task<string> GenerateUniqueTokenAsync()
    {
        for (var attempt = 0; attempt < 5; attempt++)
        {
            var candidate = SmartTagTokenGenerator.Generate();
            if (!await _context.SmartTags.IgnoreQueryFilters().AnyAsync(t => t.Token == candidate))
                return candidate;
        }

        throw new InvalidOperationException("No se pudo generar un Token único para el Smart Tag.");
    }
}
