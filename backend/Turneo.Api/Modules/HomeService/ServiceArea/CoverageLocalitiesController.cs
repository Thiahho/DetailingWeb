using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Turneo.Api.Modules.HomeService.ServiceArea;

// Admin management of the tenant's coverage zone for at-home services. Business
// configuration, so Admin-only like BusinessSettings.
[ApiController]
[Route("api/home-service/coverage-localities")]
[Authorize(Roles = "Admin")]
public class CoverageLocalitiesController : ControllerBase
{
    private readonly ICoverageLocalitiesRepository _repository;

    public CoverageLocalitiesController(ICoverageLocalitiesRepository repository)
    {
        _repository = repository;
    }

    // GET: api/home-service/coverage-localities
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var localities = await _repository.GetAllAsync();
        return Ok(localities.Select(ToResponse));
    }

    // POST: api/home-service/coverage-localities
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CoverageLocalityRequest request)
    {
        var (name, province, georefId) = Normalize(request);
        if (name.Length == 0 || province.Length == 0)
            return BadRequest(new { message = "Localidad y provincia son requeridas" });

        if (await _repository.ExistsAsync(name, province, georefId))
            return DuplicateLocality();

        var locality = new CoverageLocality();
        Apply(locality, request, name, province, georefId);

        _repository.Add(locality);
        if (!await _repository.TrySaveChangesAsync())
            return DuplicateLocality();

        return CreatedAtAction(nameof(GetAll), null, ToResponse(locality));
    }

    // PUT: api/home-service/coverage-localities/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] CoverageLocalityRequest request)
    {
        var locality = await _repository.FindAsync(id);
        if (locality == null)
            return NotFound(new { message = "Localidad no encontrada" });

        var (name, province, georefId) = Normalize(request);
        if (name.Length == 0 || province.Length == 0)
            return BadRequest(new { message = "Localidad y provincia son requeridas" });

        if (await _repository.ExistsAsync(name, province, georefId, excludeId: id))
            return DuplicateLocality();

        Apply(locality, request, name, province, georefId);
        if (!await _repository.TrySaveChangesAsync())
            return DuplicateLocality();

        return Ok(ToResponse(locality));
    }

    // DELETE: api/home-service/coverage-localities/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var locality = await _repository.FindAsync(id);
        if (locality == null)
            return NotFound(new { message = "Localidad no encontrada" });

        _repository.Remove(locality);
        await _repository.SaveChangesAsync();

        return NoContent();
    }

    // Returned both by the pre-check and when a unique index catches a concurrent duplicate.
    private BadRequestObjectResult DuplicateLocality() =>
        BadRequest(new { message = "Esa localidad ya está en tu zona de cobertura" });

    private static (string Name, string Province, string? GeorefId) Normalize(CoverageLocalityRequest r) =>
        (r.Name.Trim(), r.Province.Trim(), string.IsNullOrWhiteSpace(r.GeorefId) ? null : r.GeorefId.Trim());

    private static void Apply(CoverageLocality locality, CoverageLocalityRequest r, string name, string province, string? georefId)
    {
        locality.Name = name;
        locality.Province = province;
        locality.GeorefId = georefId;
        locality.Surcharge = r.Surcharge;
        locality.IsActive = r.IsActive;
        locality.UpdatedAt = DateTime.UtcNow;
    }

    private static object ToResponse(CoverageLocality c) => new
    {
        c.Id,
        c.Name,
        c.Province,
        c.GeorefId,
        c.Surcharge,
        c.IsActive
    };
}

public class CoverageLocalityRequest
{
    [Required, StringLength(150, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    [Required, StringLength(100, MinimumLength = 1)]
    public string Province { get; set; } = string.Empty;

    [StringLength(20)]
    public string? GeorefId { get; set; }

    [Range(0, 9_999_999_999.99)]
    public decimal? Surcharge { get; set; }

    public bool IsActive { get; set; } = true;
}
