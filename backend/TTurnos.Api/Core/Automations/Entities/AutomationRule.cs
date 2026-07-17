namespace TTurnos.Api.Core.Automations;

// Regla configurable por el admin: trigger (+ condición embebida en InactiveDays
// cuando aplica) → acción (MessageTemplate) → espera (CooldownDays evita reenviar
// al mismo cliente antes de ese período). La evaluación diaria vive en
// AutomationRuleEvaluationJob; esta clase es solo el registro de configuración.
public class AutomationRule : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    // Nombre interno para identificar la regla en el admin (ej. "Regla winback V2") —
    // NO se muestra nunca al cliente. Lo que sí ve el cliente es ClientLabel.
    public string Name { get; set; } = string.Empty;
    public string TriggerType { get; set; } = string.Empty;

    // Solo aplica cuando TriggerType == AutomationTriggerType.ClientInactive.
    public int? InactiveDays { get; set; }

    // Texto pensado para el cliente (ej. "tu cumpleaños"): se guarda como
    // ScheduledReminder.ServiceLabel y alimenta el placeholder {servicio} del
    // mensaje — deliberadamente separado de Name para que un nombre interno tipo
    // "Regla winback V2" nunca se filtre al mensaje que recibe el cliente.
    public string ClientLabel { get; set; } = string.Empty;

    // Soporta los mismos placeholders {nombre}/{servicio} que ScheduledReminder.MessageTemplate
    // (ver HangfireReminderJob.BuildMessage).
    public string MessageTemplate { get; set; } = string.Empty;

    public int CooldownDays { get; set; } = 30;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Solo informativo para el admin — la deduplicación real vive en AutomationRuleExecution.
    public DateTime? LastRunAt { get; set; }
}
