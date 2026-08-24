using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Turneo.Api.Core.Reviews;

[ApiController]
[Route("api/reviews")]
public class ReviewsController : ControllerBase
{
    private readonly IReviewsRepository _repository;
    private readonly ISiteConfigRepository _siteConfigRepository;
    private readonly GooglePlacesService _googlePlaces;

    public ReviewsController(IReviewsRepository repository, ISiteConfigRepository siteConfigRepository, GooglePlacesService googlePlaces)
    {
        _repository = repository;
        _siteConfigRepository = siteConfigRepository;
        _googlePlaces = googlePlaces;
    }

    [HttpGet]
    [AllowAnonymous]
    [EnableRateLimiting("public-read")]
    public async Task<IActionResult> GetApproved()
    {
        var reviews = await _repository.GetApprovedAsync();
        return Ok(reviews.Select(r => new { r.Id, r.AuthorName, r.Rating, r.Comment, r.Source, r.Order, r.CreatedAt }));
    }

    [HttpGet("all")]
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Resenas, PermissionActions.View, alsoCheckProfessional: true)]
    public async Task<IActionResult> GetAll()
    {
        var reviews = await _repository.GetAllAsync();
        return Ok(reviews);
    }

    // Formulario público en la web (a diferencia del flujo de Smart Tag en
    // SmartLinkController, este endpoint sí corre con contexto ambiental de
    // tenant resuelto por host, así que no necesita TenantId explícito).
    [HttpPost]
    [AllowAnonymous]
    [EnableRateLimiting("review-submit")]
    public async Task<IActionResult> Create([FromBody] ReviewSubmitRequest request)
    {
        var review = new Review
        {
            AuthorName = string.IsNullOrWhiteSpace(request.AuthorName) ? null : request.AuthorName,
            Rating = request.Rating,
            Comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment,
            Source = ReviewSource.PublicForm,
            IsApproved = false,
            CreatedAt = DateTime.UtcNow
        };
        _repository.Add(review);
        await _repository.SaveChangesAsync();
        return Ok(review);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Resenas, PermissionActions.Edit, alsoCheckProfessional: true)]
    public async Task<IActionResult> Update(int id, [FromBody] ReviewUpdateRequest request)
    {
        var review = await _repository.FindAsync(id);
        if (review == null) return NotFound();

        review.AuthorName = string.IsNullOrWhiteSpace(request.AuthorName) ? null : request.AuthorName;
        review.Rating = request.Rating;
        review.Comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment;
        review.IsApproved = request.IsApproved;
        review.Order = request.Order;

        await _repository.SaveChangesAsync();
        return Ok(review);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Resenas, PermissionActions.Delete, alsoCheckProfessional: true)]
    public async Task<IActionResult> Delete(int id)
    {
        var review = await _repository.FindAsync(id);
        if (review == null) return NotFound();
        _repository.Remove(review);
        await _repository.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("google")]
    [AllowAnonymous]
    [EnableRateLimiting("public-read")]
    public async Task<IActionResult> GetGoogleReviews()
    {
        var config = await _siteConfigRepository.GetAsync();
        if (config is null || string.IsNullOrWhiteSpace(config.GooglePlaceId))
            return Ok(Array.Empty<GoogleReviewDto>());

        var reviews = await _googlePlaces.GetReviewsAsync(config.GooglePlaceId);
        return Ok(reviews);
    }
}
