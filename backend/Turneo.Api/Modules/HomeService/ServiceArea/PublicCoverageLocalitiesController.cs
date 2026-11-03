using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Turneo.Api.Modules.HomeService.ServiceArea;

// Public read for the booking page: the localities the business covers for
// at-home services. Anonymous; the tenant comes from the host like every other
// public booking endpoint, and the query filter scopes the list to it. Only
// exposes what the client needs to pick a locality and see its surcharge.
[ApiController]
[Route("api/home-service/coverage-localities/active")]
public class PublicCoverageLocalitiesController : ControllerBase
{
    private readonly ICoverageLocalitiesRepository _repository;

    public PublicCoverageLocalitiesController(ICoverageLocalitiesRepository repository)
    {
        _repository = repository;
    }

    // GET: api/home-service/coverage-localities/active
    [HttpGet]
    [AllowAnonymous]
    [EnableRateLimiting("public-read")]
    public async Task<IActionResult> GetActive()
    {
        var localities = await _repository.GetActiveAsync();
        return Ok(localities.Select(c => new
        {
            c.Id,
            c.Name,
            c.Province,
            c.Surcharge
        }));
    }
}
