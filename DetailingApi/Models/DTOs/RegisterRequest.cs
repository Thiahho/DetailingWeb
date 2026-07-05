using System.ComponentModel.DataAnnotations;

namespace DetailingApi.Models.DTOs;

public class RegisterRequest
{
    [Required, EmailAddress, StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required, StringLength(100, MinimumLength = 6)]
    public string Password { get; set; } = string.Empty;

    [Required, StringLength(100, MinimumLength = 6)]
    public string ConfirmPassword { get; set; } = string.Empty;
}
