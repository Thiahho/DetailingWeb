
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Turneo.Api.Core.Services;

// Where the service is performed: at the business (OnSite) or at the client's
// address (AtHome). Serialized as text; numeric values are still accepted.
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ServiceLocationType
{
    OnSite = 0,
    AtHome = 1
}


[Table("Services")] 
public class Service : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Price { get; set; } = string.Empty;
    public string? Duration { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<string> Details { get; set; } = new();
    public string? CustomFieldsSchema { get; set; }
    public string? Category { get; set; }
    public int BufferMinutes { get; set; } = 0;
    public string Color { get; set; } = "#7c3aed";
    public ServiceLocationType LocationType { get; set; } = ServiceLocationType.OnSite;
    public bool IsActive { get; set; } = true;
    public int Order { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
