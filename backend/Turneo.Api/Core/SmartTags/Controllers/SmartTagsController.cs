using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using QRCoder;

namespace Turneo.Api.Core.SmartTags;

[ApiController]
[Route("api/smart-tags")]
[Authorize(Roles = "Admin,Staff,Professional")]
public class SmartTagsController : ControllerBase
{
    private readonly ISmartTagsRepository _repository;
    private readonly IConfiguration _configuration;

    public SmartTagsController(ISmartTagsRepository repository, IConfiguration configuration)
    {
        _repository = repository;
        _configuration = configuration;
    }

    // TODO: gating por plan (Feature "CanUseSmartTags") cuando se habilite —
    // mismo lugar donde engancharía IPlanLimitsService.IsFeatureEnabledAsync,
    // ver AutomationRulesController.CheckAutomationsAllowedAsync.

    private string SmartLinkUrl(SmartTag t)
    {
        var baseUrl = _configuration["SmartTags:PublicBaseUrl"] ?? "https://gestion-turnos-kappa.vercel.app";
        return $"{baseUrl}/s/{t.Token}";
    }

    private SmartTagResponse ToResponse(SmartTag t)
    {
        var smartLinkUrl = SmartLinkUrl(t);
        return new SmartTagResponse(
            t.Id, t.Name, t.Location, t.Action, t.IsActive, t.Token,
            smartLinkUrl, t.CreatedAt, t.UpdatedAt,
            SmartTagSource.AppendTo(smartLinkUrl, SmartTagSource.Nfc),
            SmartTagSource.AppendTo(smartLinkUrl, SmartTagSource.Qr));
    }

    [HttpGet]
    [RequirePermission(PermissionModules.SmartTags, PermissionActions.View, alsoCheckProfessional: true)]
    public async Task<IActionResult> GetSmartTags()
    {
        var tags = await _repository.GetAllAsync();
        return Ok(tags.Select(ToResponse));
    }

    [HttpGet("{id:int}")]
    [RequirePermission(PermissionModules.SmartTags, PermissionActions.View, alsoCheckProfessional: true)]
    public async Task<IActionResult> GetSmartTag(int id)
    {
        var tag = await _repository.GetByIdAsync(id);
        return tag is null ? NotFound() : Ok(ToResponse(tag));
    }

    [HttpPost]
    [RequirePermission(PermissionModules.SmartTags, PermissionActions.Create, alsoCheckProfessional: true)]
    public async Task<IActionResult> CreateSmartTag([FromBody] CreateSmartTagRequest req)
    {
        if (!SmartTagAction.IsValid(req.Action))
            return BadRequest(new { error = $"Action inválida. Valores permitidos: {string.Join(", ", SmartTagAction.All)}" });

        var tag = new SmartTag
        {
            Name = req.Name,
            Location = req.Location,
            Action = req.Action,
            IsActive = true,
        };

        var created = await _repository.CreateAsync(tag);
        return CreatedAtAction(nameof(GetSmartTag), new { id = created.Id }, ToResponse(created));
    }

    [HttpPut("{id:int}")]
    [RequirePermission(PermissionModules.SmartTags, PermissionActions.Edit, alsoCheckProfessional: true)]
    public async Task<IActionResult> UpdateSmartTag(int id, [FromBody] UpdateSmartTagRequest req)
    {
        if (!SmartTagAction.IsValid(req.Action))
            return BadRequest(new { error = $"Action inválida. Valores permitidos: {string.Join(", ", SmartTagAction.All)}" });

        var updated = await _repository.UpdateAsync(id, tag =>
        {
            tag.Name = req.Name;
            tag.Location = req.Location;
            tag.Action = req.Action;
        });

        return updated is null ? NotFound() : Ok(ToResponse(updated));
    }

    [HttpPatch("{id:int}/status")]
    [RequirePermission(PermissionModules.SmartTags, PermissionActions.Edit, alsoCheckProfessional: true)]
    public async Task<IActionResult> SetStatus(int id, [FromBody] SetSmartTagStatusRequest req)
    {
        var updated = await _repository.SetActiveAsync(id, req.IsActive);
        return updated is null ? NotFound() : Ok(ToResponse(updated));
    }

    [HttpDelete("{id:int}")]
    [RequirePermission(PermissionModules.SmartTags, PermissionActions.Delete, alsoCheckProfessional: true)]
    public async Task<IActionResult> DeleteSmartTag(int id)
    {
        var deleted = await _repository.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }

    // PngByteQRCode devuelve un byte[] puro — a propósito, no la clase QRCode
    // (basada en System.Drawing/Bitmap), que no corre en Linux/Render.
    [HttpGet("{id:int}/qr")]
    [RequirePermission(PermissionModules.SmartTags, PermissionActions.View, alsoCheckProfessional: true)]
    public async Task<IActionResult> GetQrCode(int id)
    {
        var tag = await _repository.GetByIdAsync(id);
        if (tag is null) return NotFound();

        // El QR lleva ?src=qr para poder distinguir sus escaneos de los taps
        // NFC de la misma etiqueta (que usan ?src=nfc).
        var qrUrl = SmartTagSource.AppendTo(SmartLinkUrl(tag), SmartTagSource.Qr);

        using var generator = new QRCodeGenerator();
        using var qrData = generator.CreateQrCode(qrUrl, QRCodeGenerator.ECCLevel.Q);
        var qrCode = new PngByteQRCode(qrData);
        var bytes = qrCode.GetGraphic(20);

        return File(bytes, "image/png");
    }

    private static double ConversionRate(int interactions, int completions) =>
        interactions > 0 ? Math.Round((double)completions / interactions * 100, 1) : 0;

    private SmartTagAnalyticsResponse ToAnalyticsResponse(SmartTagAnalyticsRow row) => new(
        row.SmartTagId, row.Name, row.Action, row.Interactions, row.Completions,
        ConversionRate(row.Interactions, row.Completions),
        row.InteractionsBySource, row.CompletionsBySource);

    private static SmartTagSourceBreakdown Sum(IEnumerable<SmartTagSourceBreakdown> parts) =>
        parts.Aggregate(
            new SmartTagSourceBreakdown(0, 0, 0),
            (total, part) => new SmartTagSourceBreakdown(total.Nfc + part.Nfc, total.Qr + part.Qr, total.Unknown + part.Unknown));

    [HttpGet("{id:int}/analytics")]
    [RequirePermission(PermissionModules.SmartTags, PermissionActions.View, alsoCheckProfessional: true)]
    public async Task<IActionResult> GetTagAnalytics(int id)
    {
        var row = await _repository.GetAnalyticsForTagAsync(id);
        return row is null ? NotFound() : Ok(ToAnalyticsResponse(row));
    }

    [HttpGet("analytics")]
    [RequirePermission(PermissionModules.SmartTags, PermissionActions.View, alsoCheckProfessional: true)]
    public async Task<IActionResult> GetAnalyticsSummary()
    {
        var rows = await _repository.GetAnalyticsSummaryAsync();
        var totalInteractions = rows.Sum(r => r.Interactions);
        var totalCompletions = rows.Sum(r => r.Completions);

        return Ok(new SmartTagsAnalyticsSummaryResponse(
            totalInteractions,
            totalCompletions,
            ConversionRate(totalInteractions, totalCompletions),
            rows.Select(ToAnalyticsResponse).ToList(),
            Sum(rows.Select(r => r.InteractionsBySource)),
            Sum(rows.Select(r => r.CompletionsBySource))));
    }
}
