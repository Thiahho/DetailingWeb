using System.ComponentModel.DataAnnotations;

namespace Turneo.Api.Core.Auth;

public class LoginRequest
{
    // Acepta email o username (se busca por ambos campos en AuthService.LoginAsync).
    [Required, StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required, StringLength(200, MinimumLength = 1)]
    public string Password { get; set; } = string.Empty;
}
