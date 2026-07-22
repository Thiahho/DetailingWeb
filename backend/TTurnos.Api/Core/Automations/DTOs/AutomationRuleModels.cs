using System.ComponentModel.DataAnnotations;

namespace Turneo.Api.Core.Automations;

public record CreateAutomationRuleRequest(
    [Required, StringLength(200, MinimumLength = 1)] string Name,
    [Required, RegularExpression("^(ClientBirthday|ClientInactive)$")] string TriggerType,
    [Range(1, 3650)] int? InactiveDays,
    [Required, StringLength(200, MinimumLength = 1)] string ClientLabel,
    [Required, StringLength(2000, MinimumLength = 1)] string MessageTemplate,
    [Range(1, 3650)] int CooldownDays,
    bool IsActive
);

public record UpdateAutomationRuleRequest(
    [Required, StringLength(200, MinimumLength = 1)] string Name,
    [Required, RegularExpression("^(ClientBirthday|ClientInactive)$")] string TriggerType,
    [Range(1, 3650)] int? InactiveDays,
    [Required, StringLength(200, MinimumLength = 1)] string ClientLabel,
    [Required, StringLength(2000, MinimumLength = 1)] string MessageTemplate,
    [Range(1, 3650)] int CooldownDays,
    bool IsActive
);

public record AutomationRuleResponse(
    int Id,
    string Name,
    string TriggerType,
    int? InactiveDays,
    string ClientLabel,
    string MessageTemplate,
    int CooldownDays,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? LastRunAt
);

public record RunRuleResult(int RemindersCreated);

public record AutomationRuleExecutionSummary(
    string CustomerName,
    string CustomerPhone,
    DateTime ExecutedAt,
    string ReminderStatus,
    DateTime? SentAt
);
