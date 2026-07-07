using System.ComponentModel.DataAnnotations.Schema;

namespace TTurnos.Api.Core.Users;

[Table("Users")] 
public class User : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public string Email { get; set; } = string.Empty;
    // Alternativa opcional al email para loguearse (ej: profesionales sin ganas de tipear el email completo).
    public string? Username { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = "Admin";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Solo se usa cuando Role == "Professional": liga la cuenta de acceso a su ficha.
    public int? ProfessionalId { get; set; }
    public Professional? Professional { get; set; }
}