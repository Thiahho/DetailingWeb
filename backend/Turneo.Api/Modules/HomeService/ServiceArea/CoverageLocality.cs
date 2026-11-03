using System.ComponentModel.DataAnnotations.Schema;

namespace Turneo.Api.Modules.HomeService.ServiceArea;

// A locality where the tenant offers at-home services. Coverage is a list of
// localities (Georef), not a radius; Surcharge is an optional extra charged
// for travelling to that locality.
[Table("CoverageLocalities")]
public class CoverageLocality : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Province { get; set; } = string.Empty;
    public string? GeorefId { get; set; }
    public decimal? Surcharge { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
