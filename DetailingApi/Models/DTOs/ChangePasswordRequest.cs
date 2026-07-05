using System.ComponentModel.DataAnnotations;

namespace DetailingApi.Models.DTOs;

public class ChangePasswordRequest
{
    public string? Email { get; set; }

    [Required, StringLength(200, MinimumLength = 1)]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required, StringLength(100, MinimumLength = 6)]
    public string NewPassword { get; set; } = string.Empty;

    [Required, StringLength(100, MinimumLength = 6)]
    public string ConfirmNewPassword { get; set; } = string.Empty;
}
