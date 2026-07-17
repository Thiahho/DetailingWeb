namespace TTurnos.Api.Core.Automations;

// Log de deduplicación (evita que la misma regla vuelva a disparar para el mismo
// cliente antes de que pase AutomationRule.CooldownDays) Y de auditoría — vía
// ScheduledReminderId se puede ver a quién le disparó cada regla y si el envío
// realmente salió (ScheduledReminder.Status/SentAt).
public class AutomationRuleExecution : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public int AutomationRuleId { get; set; }
    public AutomationRule? AutomationRule { get; set; }
    public int CustomerProfileId { get; set; }
    public CustomerProfile? CustomerProfile { get; set; }

    // Nullable por si en el futuro se llega a crear una ejecución sin recordatorio
    // asociado — hoy siempre se setea junto con el ScheduledReminder que dispara.
    public int? ScheduledReminderId { get; set; }
    public ScheduledReminder? ScheduledReminder { get; set; }

    public DateTime ExecutedAt { get; set; } = DateTime.UtcNow;
}
