using System.ComponentModel.DataAnnotations;

namespace TTurnos.Api.Core.Clients;

public class ClientAccessRequest
{
    [Required, EmailAddress, StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [StringLength(200)]
    public string? Password { get; set; }
}

public class ClientOtpVerifyRequest
{
    [Required, EmailAddress, StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required, StringLength(6, MinimumLength = 6), RegularExpression(@"^\d{6}$")]
    public string OtpCode { get; set; } = string.Empty;
}

public class ClientPortalTokenRequest
{
    [Required, StringLength(2000, MinimumLength = 1)]
    public string AccessToken { get; set; } = string.Empty;
}
