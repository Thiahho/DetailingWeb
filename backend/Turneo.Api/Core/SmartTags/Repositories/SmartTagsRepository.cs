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

    public async Task RecordEventAsync(int smartTagId, int tenantId, string action, string eventType)
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
        });
        await _context.SaveChangesAsync();
    }

    private record EventCount(string EventType, int Count);

    public async Task<SmartTagAnalyticsRow?> GetAnalyticsForTagAsync(int smartTagId)
    {
        var tag = await _context.SmartTags.FirstOrDefaultAsync(t => t.Id == smartTagId);
        if (tag is null) return null;

        var counts = await _context.SmartTagEvents
            .Where(e => e.SmartTagId == smartTagId)
            .GroupBy(e => e.EventType)
            .Select(g => new EventCount(g.Key, g.Count()))
            .ToListAsync();

        return ToAnalyticsRow(tag, counts);
    }

    public async Task<List<SmartTagAnalyticsRow>> GetAnalyticsSummaryAsync()
    {
        var tags = await _context.SmartTags.ToListAsync();

        // (SmartTagId, EventType, Count) — se separa por tag en memoria abajo
        // (mismo criterio que AnalyticsRepository.GetProfessionalStatsAsync:
        // post-procesar tras el ToListAsync cuando agrupar dos veces no
        // aporta nada sobre traer todo junto una sola vez).
        var counts = await _context.SmartTagEvents
            .GroupBy(e => new { e.SmartTagId, e.EventType })
            .Select(g => new { g.Key.SmartTagId, g.Key.EventType, Count = g.Count() })
            .ToListAsync();

        return tags
            .Select(tag => ToAnalyticsRow(tag, counts
                .Where(c => c.SmartTagId == tag.Id)
                .Select(c => new EventCount(c.EventType, c.Count))))
            .ToList();
    }

    private static SmartTagAnalyticsRow ToAnalyticsRow(SmartTag tag, IEnumerable<EventCount> eventCounts)
    {
        int Sum(Func<string, bool> matches) =>
            eventCounts.Where(c => matches(c.EventType)).Sum(c => c.Count);

        var interactions = Sum(t => t == SmartTagEventType.Interaction);
        var completions = Sum(t => t == SmartTagEventType.BookingCompleted || t == SmartTagEventType.ReviewCompleted);

        return new SmartTagAnalyticsRow(tag.Id, tag.Name, tag.Action, interactions, completions);
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
