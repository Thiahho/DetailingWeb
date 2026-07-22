using System.ComponentModel.DataAnnotations;

namespace Turneo.Api.Core.Roles;

public class ModulePermissionDto
{
    [Required]
    public string Module { get; set; } = string.Empty;
    public bool CanView { get; set; }
    public bool CanCreate { get; set; }
    public bool CanEdit { get; set; }
    public bool CanDelete { get; set; }
}

public class CreateStaffRequest
{
    [Required, EmailAddress, StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required, StringLength(100, MinimumLength = 6)]
    public string Password { get; set; } = string.Empty;

    [StringLength(100)]
    public string? Username { get; set; }
}

public class UpdateStaffPermissionsRequest
{
    public List<ModulePermissionDto> Permissions { get; set; } = new();
}

public class ChangeStaffPasswordRequest
{
    [Required, StringLength(100, MinimumLength = 6)]
    public string NewPassword { get; set; } = string.Empty;
}
