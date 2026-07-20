using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace TTurnos.Api.Core.Platform;

// Alta de tenants — exclusivo del dueño de la plataforma. Ningún Admin de
// tenant, por más permisos que tenga dentro de su negocio, puede pegarle a
// este controller (el rol PlatformOwner no existe para ellos).
[ApiController]
[Route("api/platform")]
[Authorize(Roles = "PlatformOwner")]
public class PlatformTenantsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public PlatformTenantsController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET: api/platform/tenants
    [HttpGet("tenants")]
    public async Task<IActionResult> GetTenants()
    {
        var tenants = await _context.Tenants
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new TenantSummary(t.Id, t.Name, t.Slug, t.Vertical, t.CommercialModel, t.Status, t.PlanId, t.CreatedAt))
            .ToListAsync();

        return Ok(tenants);
    }

    // GET: api/platform/plans
    [HttpGet("plans")]
    public async Task<IActionResult> GetPlans()
    {
        var plans = await _context.Plans
            .Where(p => p.IsActive)
            .Select(p => new PlanSummary(p.Id, p.Name, p.PriceMonthly, p.PriceYearly))
            .ToListAsync();

        return Ok(plans);
    }

    // POST: api/platform/tenants
    [HttpPost("tenants")]
    public async Task<IActionResult> CreateTenant([FromBody] CreateTenantRequest request)
    {
        var slug = request.Slug.Trim().ToLowerInvariant();

        if (await _context.Tenants.AnyAsync(t => t.Slug == slug))
            return BadRequest(new { message = "Ya existe un tenant con ese slug" });

        if (request.AdminPassword.Length < 6)
            return BadRequest(new { message = "La contraseña debe tener al menos 6 caracteres" });

        await using var transaction = await _context.Database.BeginTransactionAsync();

        var tenant = new Tenant
        {
            Name = request.Name.Trim(),
            Slug = slug,
            Vertical = request.Vertical.Trim(),
            CommercialModel = request.CommercialModel,
            Status = TenantStatus.Active,
            PlanId = request.PlanId
        };
        _context.Tenants.Add(tenant);
        await _context.SaveChangesAsync();

        var admin = new User
        {
            TenantId = tenant.Id,
            Email = request.AdminEmail.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.AdminPassword),
            Role = "Admin"
        };
        _context.Users.Add(admin);
        await _context.SaveChangesAsync();

        await transaction.CommitAsync();

        return Ok(new { tenantId = tenant.Id, slug = tenant.Slug, adminEmail = admin.Email });
    }
}
