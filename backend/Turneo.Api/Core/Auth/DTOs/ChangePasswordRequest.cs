using System.ComponentModel.DataAnnotations;

namespace Turneo.Api.Core.Auth;

public class ChangePasswordRequest
{
    public string? Email { get; set; }

    [Required, StringLength(200, MinimumLength = 1)]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required, StringLength(100, MinimumLength = 8, ErrorMessage = "La contraseña debe tener al menos 8 caracteres.")]
    [RegularExpression(@"^(?=.*[A-Z])(?=.*\d).+$", ErrorMessage = "La contraseña debe incluir al menos una mayúscula y un número.")]
    public string NewPassword { get; set; } = string.Empty;

    [Required, StringLength(100, MinimumLength = 8)]
    public string ConfirmNewPassword { get; set; } = string.Empty;
}
