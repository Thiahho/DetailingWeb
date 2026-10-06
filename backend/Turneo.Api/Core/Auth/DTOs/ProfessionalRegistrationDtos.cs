using System.ComponentModel.DataAnnotations;

namespace Turneo.Api.Core.Auth;

public class ProfessionalRegistrationRequest
{
    [Required, EmailAddress, StringLength(256)]
    public string Email { get; set; } = string.Empty;
}

public class ProfessionalRegistrationVerifyRequest
{
    [Required, EmailAddress, StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required, StringLength(6, MinimumLength = 6), RegularExpression(@"^\d{6}$")]
    public string OtpCode { get; set; } = string.Empty;
}

public class ProfessionalRegistrationCompleteRequest
{
    [Required, StringLength(2000, MinimumLength = 1)]
    public string RegistrationToken { get; set; } = string.Empty;

    [Required, StringLength(200, MinimumLength = 1)]
    public string Password { get; set; } = string.Empty;

    [Required, StringLength(200, MinimumLength = 1)]
    public string ConfirmPassword { get; set; } = string.Empty;
}

public class ProfessionalGoogleLoginRequest
{
    [Required, StringLength(4000, MinimumLength = 1)]
    public string IdToken { get; set; } = string.Empty;
}
