using Microsoft.EntityFrameworkCore;

namespace TTurnos.Api.Core.Automations;

public class AutomationRulesRepository : IAutomationRulesRepository
{
    private readonly ApplicationDbContext _context;

    public AutomationRulesRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<List<AutomationRule>> GetAllAsync() =>
        _context.AutomationRules.OrderByDescending(r => r.CreatedAt).ToListAsync();

    public Task<AutomationRule?> GetByIdAsync(int id) =>
        _context.AutomationRules.FirstOrDefaultAsync(r => r.Id == id);

    public async Task<AutomationRule> CreateAsync(AutomationRule rule)
    {
        _context.AutomationRules.Add(rule);
        await _context.SaveChangesAsync();
        return rule;
    }

    public async Task<AutomationRule?> UpdateAsync(int id, Action<AutomationRule> apply)
    {
        var rule = await _context.AutomationRules.FirstOrDefaultAsync(r => r.Id == id);
        if (rule is null) return null;

        apply(rule);
        await _context.SaveChangesAsync();
        return rule;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var rule = await _context.AutomationRules.FirstOrDefaultAsync(r => r.Id == id);
        if (rule is null) return false;

        _context.AutomationRules.Remove(rule);
        await _context.SaveChangesAsync();
        return true;
    }

    // Cross-tenant a propósito: llamado desde AutomationRuleEvaluationJob (Hangfire,
    // sin HTTP context, sin tenant resuelto) — mismo patrón que HangfireReminderJob.
    public Task<List<AutomationRule>> GetActiveRulesCrossTenantAsync() =>
        _context.AutomationRules.IgnoreQueryFilters().Where(r => r.IsActive).ToListAsync();

    public async Task<int> EvaluateRuleAsync(AutomationRule rule)
    {
        // "Hoy" en hora de Argentina para decidir si aplica el trigger (cumpleaños /
        // días de inactividad); el timestamp que se guarda en ScheduledFor va en UTC
        // (ver comentario en ScheduledReminder/HangfireReminderJob).
        var nowArg = ArgentinaClock.Now();
        var nowUtc = DateTime.UtcNow;

        // IgnoreQueryFilters + filtro manual por TenantId: este método corre tanto
        // desde el job (tenant no resuelto) como desde el endpoint "Probar ahora"
        // (tenant sí resuelto) — filtrar a mano funciona en los dos casos por igual.
        List<CustomerProfile> matches;

        if (rule.TriggerType == AutomationTriggerType.ClientBirthday)
        {
            matches = await _context.CustomerProfiles
                .IgnoreQueryFilters()
                .Where(p => p.TenantId == rule.TenantId
                         && p.Birthday != null
                         && p.Birthday.Value.Month == nowArg.Month
                         && p.Birthday.Value.Day == nowArg.Day)
                .ToListAsync();
        }
        else if (rule.TriggerType == AutomationTriggerType.ClientInactive && rule.InactiveDays.HasValue)
        {
            var cutoff = nowArg.AddDays(-rule.InactiveDays.Value);

            // No hay FK Booking→CustomerProfile: el vínculo es siempre por teléfono
            // (mismo criterio que CustomerProfileService.GetCustomerHistoryAsync).
            var lastBookingByPhone = await _context.Bookings
                .IgnoreQueryFilters()
                .Include(b => b.TimeSlot)
                .Where(b => b.TenantId == rule.TenantId && b.Status != BookingStatus.Cancelled)
                .GroupBy(b => b.CustomerPhone)
                .Select(g => new { Phone = g.Key, LastBooking = g.Max(b => b.TimeSlot.StartDateTime) })
                .Where(x => x.LastBooking < cutoff)
                .ToListAsync();

            var inactivePhones = lastBookingByPhone.Select(x => x.Phone).ToHashSet();

            var tenantProfiles = await _context.CustomerProfiles
                .IgnoreQueryFilters()
                .Where(p => p.TenantId == rule.TenantId)
                .ToListAsync();

            matches = tenantProfiles.Where(p => inactivePhones.Contains(p.Phone)).ToList();
        }
        else
        {
            return 0;
        }

        if (matches.Count == 0) return 0;

        var cooldownCutoff = nowUtc.AddDays(-rule.CooldownDays);
        var matchIds = matches.Select(m => m.Id).ToList();
        var alreadyExecutedIds = await _context.AutomationRuleExecutions
            .IgnoreQueryFilters()
            .Where(e => e.AutomationRuleId == rule.Id
                     && matchIds.Contains(e.CustomerProfileId)
                     && e.ExecutedAt >= cooldownCutoff)
            .Select(e => e.CustomerProfileId)
            .ToListAsync();
        var alreadyExecutedSet = alreadyExecutedIds.ToHashSet();

        var created = 0;
        foreach (var profile in matches)
        {
            if (alreadyExecutedSet.Contains(profile.Id)) continue;

            // BookingId=null y IntervalDays=null a propósito: es un envío puntual,
            // la "recurrencia" la maneja esta misma regla re-evaluando a diario, no
            // el mecanismo de reprogramación de HangfireReminderJob.
            var scheduledReminder = new ScheduledReminder
            {
                TenantId = rule.TenantId,
                CustomerProfileId = profile.Id,
                BookingId = null,
                ServiceLabel = rule.ClientLabel,
                ScheduledFor = nowUtc,
                Status = ReminderStatus.Pending,
                MessageTemplate = rule.MessageTemplate,
                IntervalDays = null,
            };
            _context.ScheduledReminders.Add(scheduledReminder);

            // Navigation property en vez de un Id todavía inexistente — EF resuelve
            // el FK solo al guardar. Esto es lo que permite mostrar en el admin,
            // por cada ejecución, si el envío se mandó/falló (ver GetExecutionHistoryAsync).
            _context.AutomationRuleExecutions.Add(new AutomationRuleExecution
            {
                TenantId = rule.TenantId,
                AutomationRuleId = rule.Id,
                CustomerProfileId = profile.Id,
                ExecutedAt = nowUtc,
                ScheduledReminder = scheduledReminder,
            });

            created++;
        }

        if (created > 0)
            await _context.SaveChangesAsync();

        return created;
    }

    // Corre dentro de un request de admin autenticado (tenant ya resuelto por el
    // query filter normal) — a diferencia de EvaluateRuleAsync, acá no hace falta
    // IgnoreQueryFilters ni filtrar TenantId a mano.
    public Task<List<AutomationRuleExecutionSummary>> GetExecutionHistoryAsync(int ruleId) =>
        _context.AutomationRuleExecutions
            .Where(e => e.AutomationRuleId == ruleId)
            .OrderByDescending(e => e.ExecutedAt)
            .Take(200)
            .Select(e => new AutomationRuleExecutionSummary(
                e.CustomerProfile!.Name,
                e.CustomerProfile.Phone,
                e.ExecutedAt,
                e.ScheduledReminder != null ? e.ScheduledReminder.Status : "Unknown",
                e.ScheduledReminder != null ? e.ScheduledReminder.SentAt : null
            ))
            .ToListAsync();
}
