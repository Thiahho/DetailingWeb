namespace Turneo.Api.Core.Platform;

public record PlatformLoginRequest(string Email, string Password);

public record PlatformLoginResponse(string Token, string Email);

public record CreateTenantRequest(
    string Name,
    string Slug,
    string Vertical,
    CommercialModel CommercialModel,
    int? PlanId,
    string AdminEmail,
    string AdminPassword,
    bool AcceptedTerms);

public record TenantSummary(
    int Id,
    string Name,
    string Slug,
    string Vertical,
    CommercialModel CommercialModel,
    TenantStatus Status,
    int? PlanId,
    DateTime CreatedAt);

public record PlanSummary(int Id, string Name, decimal? PriceMonthly, decimal? PriceYearly);
