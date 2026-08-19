using System.ComponentModel.DataAnnotations;

namespace Turneo.Api.Core.SmartTags;

public record CreateSmartTagRequest(
    [Required, StringLength(150, MinimumLength = 1)] string Name,
    [StringLength(150)] string? Location,
    [Required] string Action
);

public record UpdateSmartTagRequest(
    [Required, StringLength(150, MinimumLength = 1)] string Name,
    [StringLength(150)] string? Location,
    [Required] string Action
);

public record SetSmartTagStatusRequest(bool IsActive);

public record SmartTagResponse(
    int Id,
    string Name,
    string? Location,
    string Action,
    bool IsActive,
    string Token,
    string SmartLinkUrl,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

// Contrato del Smart Link público — pensado para que una fase futura (BOOKING/
// REBOOK/REVIEW en /s/[token] del frontend) lo consuma sin rediseño. No expone
// Token (ya está en la URL) ni el TenantId numérico interno.
public record SmartLinkResponse(
    int SmartTagId,
    string Name,
    string? Location,
    string Action,
    string TenantSlug,
    string BusinessName
);

// Fila interna del repo (sin ConversionRate — se calcula en el controller,
// mismo criterio que AnalyticsController.GetSummary()).
public record SmartTagAnalyticsRow(int SmartTagId, string Name, string Action, int Interactions, int Completions);

public record SmartTagAnalyticsResponse(
    int SmartTagId,
    string Name,
    string Action,
    int Interactions,
    int Completions,
    double ConversionRate
);

public record SmartTagsAnalyticsSummaryResponse(
    int TotalInteractions,
    int TotalCompletions,
    double ConversionRate,
    List<SmartTagAnalyticsResponse> Tags
);
