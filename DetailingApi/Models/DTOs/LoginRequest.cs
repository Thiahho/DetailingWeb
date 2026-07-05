using System.ComponentModel.DataAnnotations;

namespace DetailingApi.Models.DTOs;

public class LoginRequest
{
    [Required, EmailAddress, StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required, StringLength(200, MinimumLength = 1)]
    public string Password { get; set; } = string.Empty;
}
