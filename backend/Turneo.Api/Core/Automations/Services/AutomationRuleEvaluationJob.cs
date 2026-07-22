namespace Turneo.Api.Core.Automations;

// Job diario (Hangfire, ver BackgroundJobsSetup): decide A QUIÉN dispararle cada
// regla activa y crea los ScheduledReminder correspondientes. El envío en sí lo
// hace el job existente "process-pending-reminders" (HangfireReminderJob) — este
// job no reimplementa el canal de envío, solo la parte de trigger+condición.
public class AutomationRuleEvaluationJob
{
    private readonly IAutomationRulesRepository _repository;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AutomationRuleEvaluationJob> _logger;

    public AutomationRuleEvaluationJob(
        IAutomationRulesRepository repository,
        ApplicationDbContext context,
        ILogger<AutomationRuleEvaluationJob> logger)
    {
        _repository = repository;
        _context = context;
        _logger = logger;
    }

    public async Task EvaluateAllActiveRulesAsync()
    {
        var rules = await _repository.GetActiveRulesCrossTenantAsync();
        if (rules.Count == 0) return;

        _logger.LogInformation("[Automatizaciones] Evaluando {Count} regla(s) activa(s)", rules.Count);

        foreach (var rule in rules)
        {
            try
            {
                var created = await _repository.EvaluateRuleAsync(rule);
                rule.LastRunAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                if (created > 0)
                    _logger.LogInformation("[Automatizaciones] Regla {RuleId} ({Name}): {Count} recordatorio(s) creado(s)",
                        rule.Id, rule.Name, created);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Automatizaciones] Error evaluando regla {RuleId} ({Name})", rule.Id, rule.Name);
            }
        }
    }
}
