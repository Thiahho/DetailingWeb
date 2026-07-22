namespace Turneo.Api.Core.Auth;

public class LoginResponse
{
    public string Token { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public string? PendingOtpCode { get; set; }
    public int? ProfessionalId { get; set; }
}