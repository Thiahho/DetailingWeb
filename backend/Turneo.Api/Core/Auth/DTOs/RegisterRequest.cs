using System.ComponentModel.DataAnnotations;

namespace Turneo.Api.Core.Auth;

public class RegisterRequest
{
    [Required, EmailAddress, StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required, StringLength(100, MinimumLength = 8, ErrorMessage = "La contraseña debe tener al menos 8 caracteres.")]
    [RegularExpression(@"^(?=.*[A-Z])(?=.*\d).+$", ErrorMessage = "La contraseña debe incluir al menos una mayúscula y un número.")]
    public string Password { get; set; } = string.Empty;

    [Required, StringLength(100, MinimumLength = 8)]
    public string ConfirmPassword { get; set; } = string.Empty;
}
