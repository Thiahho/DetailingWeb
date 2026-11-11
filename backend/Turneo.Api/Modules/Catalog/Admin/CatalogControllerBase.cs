using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Turneo.Api.Modules.Catalog.Admin;

// Shared plumbing of the catalog admin controllers. Every query goes through
// ApplicationDbContext, whose tenant query filters (plus RLS) scope it to the
// caller's tenant: an id from another tenant simply is not found.
[ApiController]
[Authorize(Roles = "Admin,Staff")]
public abstract class CatalogControllerBase : ControllerBase
{
    protected readonly ApplicationDbContext Db;

    protected CatalogControllerBase(ApplicationDbContext db)
    {
        Db = db;
    }

    protected NotFoundObjectResult NotFoundMessage(string message) =>
        NotFound(new { success = false, message });

    protected BadRequestObjectResult BadRequestMessage(string message) =>
        BadRequest(new { success = false, message });

    protected ConflictObjectResult ConflictMessage(string message) =>
        Conflict(new { success = false, message });

    // Slug from the explicit value or, when empty, from the name.
    protected static string ResolveSlug(string name, string? slug, int maxLength) =>
        CatalogSlug.From(string.IsNullOrWhiteSpace(slug) ? name : slug, maxLength);

    protected static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    // A unique index caught a concurrent duplicate that the pre-check missed.
    protected static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

    protected async Task<bool> ValuesInUseAsync(IReadOnlyCollection<int> valueIds) =>
        await Db.CatalogProductAllowedValues.AnyAsync(a => valueIds.Contains(a.AttributeValueId))
        || await Db.CatalogVariantValues.AnyAsync(v => valueIds.Contains(v.AttributeValueId));
}
