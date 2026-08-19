namespace Turneo.Api.Core.Loyalty;

public record LoyaltyPrizeSummary(int Id, string Name);

public record LoyaltySpinRequest(string CustomerName, string WhatsApp);

public record LoyaltySpinResponse(
    int SpinId,
    string PrizeName,
    string? PrizeDescription,
    string Code,
    DateTime ExpiresAt,
    bool AlreadyParticipated);

public record LoyaltyPrizeAdminSummary(
    int Id,
    string Name,
    string? Description,
    string Type,
    decimal? Value,
    decimal Probability,
    int ValidityDays,
    bool IsActive,
    int Order,
    int SpinsCount);

public record SaveLoyaltyPrizeRequest(
    string Name,
    string? Description,
    string Type,
    decimal? Value,
    decimal Probability,
    int ValidityDays,
    bool IsActive,
    int Order);

public record LoyaltySpinSummary(
    int Id,
    string CustomerName,
    string WhatsApp,
    string PrizeName,
    string Code,
    DateTime SpunAt,
    DateTime ExpiresAt,
    string Status,
    DateTime? RedeemedAt);

public record RedeemLoyaltyCodeRequest(string Code);
