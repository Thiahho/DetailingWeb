using System.ComponentModel.DataAnnotations.Schema;

namespace DetailingApi.Models;

[Table("ClientAccessCodes")] 
public class ClientAccessCode
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string CodeHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UsedAt { get; set; }
}
