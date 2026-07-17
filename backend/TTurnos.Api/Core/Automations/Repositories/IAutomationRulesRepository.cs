namespace TTurnos.Api.Core.Automations;

public interface IAutomationRulesRepository
{
    Task<List<AutomationRule>> GetAllAsync();
    Task<AutomationRule?> GetByIdAsync(int id);
    Task<AutomationRule> CreateAsync(AutomationRule rule);
    Task<AutomationRule?> UpdateAsync(int id, Action<AutomationRule> apply);
    Task<bool> DeleteAsync(int id);

    // Cross-tenant a propósito: usado por AutomationRuleEvaluationJob (sin HTTP context,
    // sin tenant resuelto). Ver ApplyTenantId/HangfireReminderJob para el mismo patrón.
    Task<List<AutomationRule>> GetActiveRulesCrossTenantAsync();

    // Evalúa una regla puntual (trigger + condición + dedup) y crea los
    // ScheduledReminder/AutomationRuleExecution que correspondan. Devuelve la
    // cantidad de recordatorios creados.
    Task<int> EvaluateRuleAsync(AutomationRule rule);

    // Historial de a quién le disparó esta regla y si el envío salió — lo que
    // alimenta el botón "Ver envíos" del admin.
    Task<List<AutomationRuleExecutionSummary>> GetExecutionHistoryAsync(int ruleId);
}
