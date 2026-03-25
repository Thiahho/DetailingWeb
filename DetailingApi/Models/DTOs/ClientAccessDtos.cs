namespace DetailingApi.Models.DTOs;

public class ClientAccessRequest
{
    public string Email { get; set; } = string.Empty;
    public string? Password { get; set; }
}

public class ClientOtpVerifyRequest
{
    public string Email { get; set; } = string.Empty;
    public string OtpCode { get; set; } = string.Empty;
}

public class ClientPortalTokenRequest
{
    public string AccessToken { get; set; } = string.Empty;
}
