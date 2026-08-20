using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Turneo.Api.Core.Automations;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Staff,Professional")]
public class AutomationRulesController : ControllerBase
{
    private readonly IAutomationRulesRepository _repository;
    private readonly IPlanLimitsService _planLimits;

    public AutomationRulesController(IAutomationRulesRepository repository, IPlanLimitsService planLimits)
    {
        _repository = repository;
        _planLimits = planLimits;
    }

    private async Task<IActionResult?> CheckAutomationsAllowedAsync()
    {
        if (await _planLimits.IsFeatureEnabledAsync("CanUseAutomations"))
            return null;

        return StatusCode(StatusCodes.Status402PaymentRequired, new
        {
            message = "Las automatizaciones no están disponibles en tu plan actual."
        });
    }

    private static AutomationRuleResponse ToResponse(AutomationRule r) => new(
        r.Id, r.Name, r.TriggerType, r.InactiveDays, r.ClientLabel, r.MessageTemplate,
        r.CooldownDays, r.IsActive, r.CreatedAt, r.LastRunAt);

    [HttpGet]
    [RequirePermission(PermissionModules.Automatizaciones, PermissionActions.View, alsoCheckProfessional: true)]
    public async Task<IActionResult> GetRules()
    {
        var rules = await _repository.GetAllAsync();
        return Ok(rules.Select(ToResponse));
    }

    [HttpGet("{id:int}")]
    [RequirePermission(PermissionModules.Automatizaciones, PermissionActions.View, alsoCheckProfessional: true)]
    public async Task<IActionResult> GetRule(int id)
    {
        var rule = await _repository.GetByIdAsync(id);
        return rule is null ? NotFound() : Ok(ToResponse(rule));
    }

    [HttpPost]
    [RequirePermission(PermissionModules.Automatizaciones, PermissionActions.Create, alsoCheckProfessional: true)]
    public async Task<IActionResult> CreateRule([FromBody] CreateAutomationRuleRequest req)
    {
        if (await CheckAutomationsAllowedAsync() is { } forbidden) return forbidden;

        if (req.TriggerType == AutomationTriggerType.ClientInactive && req.InactiveDays is null)
            return BadRequest(new { error = "InactiveDays es requerido para el trigger ClientInactive." });

        var rule = new AutomationRule
        {
            Name = req.Name,
            TriggerType = req.TriggerType,
            InactiveDays = req.TriggerType == AutomationTriggerType.ClientInactive ? req.InactiveDays : null,
            ClientLabel = req.ClientLabel,
            MessageTemplate = req.MessageTemplate,
            CooldownDays = req.CooldownDays,
            IsActive = req.IsActive,
        };

        var created = await _repository.CreateAsync(rule);
        return CreatedAtAction(nameof(GetRule), new { id = created.Id }, ToResponse(created));
    }

    [HttpPut("{id:int}")]
    [RequirePermission(PermissionModules.Automatizaciones, PermissionActions.Edit, alsoCheckProfessional: true)]
    public async Task<IActionResult> UpdateRule(int id, [FromBody] UpdateAutomationRuleRequest req)
    {
        if (await CheckAutomationsAllowedAsync() is { } forbidden) return forbidden;

        if (req.TriggerType == AutomationTriggerType.ClientInactive && req.InactiveDays is null)
            return BadRequest(new { error = "InactiveDays es requerido para el trigger ClientInactive." });

        var updated = await _repository.UpdateAsync(id, rule =>
        {
            rule.Name = req.Name;
            rule.TriggerType = req.TriggerType;
            rule.InactiveDays = req.TriggerType == AutomationTriggerType.ClientInactive ? req.InactiveDays : null;
            rule.ClientLabel = req.ClientLabel;
            rule.MessageTemplate = req.MessageTemplate;
            rule.CooldownDays = req.CooldownDays;
            rule.IsActive = req.IsActive;
        });

        return updated is null ? NotFound() : Ok(ToResponse(updated));
    }

    [HttpDelete("{id:int}")]
    [RequirePermission(PermissionModules.Automatizaciones, PermissionActions.Delete, alsoCheckProfessional: true)]
    public async Task<IActionResult> DeleteRule(int id)
    {
        var deleted = await _repository.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }

    // Evalúa esta regla al instante — botón "Probar ahora" del admin, sin esperar
    // al cron diario. Usa el mismo IAutomationRulesRepository.EvaluateRuleAsync
    // que corre el job de Hangfire.
    [HttpPost("{id:int}/run-now")]
    [RequirePermission(PermissionModules.Automatizaciones, PermissionActions.Edit, alsoCheckProfessional: true)]
    public async Task<IActionResult> RunNow(int id)
    {
        if (await CheckAutomationsAllowedAsync() is { } forbidden) return forbidden;

        var rule = await _repository.GetByIdAsync(id);
        if (rule is null) return NotFound();

        var created = await _repository.EvaluateRuleAsync(rule);
        await _repository.UpdateAsync(id, r => r.LastRunAt = DateTime.UtcNow);

        return Ok(new RunRuleResult(created));
    }

    // Historial de envíos de esta regla: a quién le disparó y si el mensaje salió.
    [HttpGet("{id:int}/executions")]
    [RequirePermission(PermissionModules.Automatizaciones, PermissionActions.View, alsoCheckProfessional: true)]
    public async Task<IActionResult> GetExecutions(int id)
    {
        var rule = await _repository.GetByIdAsync(id);
        if (rule is null) return NotFound();

        var executions = await _repository.GetExecutionHistoryAsync(id);
        return Ok(executions);
    }
}
