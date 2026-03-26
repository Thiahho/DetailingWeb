using System.ComponentModel.DataAnnotations.Schema;

namespace DetailingApi.Models;

[Table("Users")] 
public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = "Admin";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}