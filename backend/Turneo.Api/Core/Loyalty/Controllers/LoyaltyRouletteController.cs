using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Core.Loyalty;

// Ruleta de fidelización de CADA negocio para sus propios clientes — no
// confundir con Marketing.Roulette (esa es la ruleta de captación de leads
// de Turneo, global). Acá el tenant se resuelve como en cualquier otro
// endpoint público del sitio (TenantResolutionMiddleware + query filter),
// y el catálogo de premios lo administra el Admin/Staff del negocio, no
// PlatformOwner.
[ApiController]
[Route("api/loyalty-roulette")]
public class LoyaltyRouletteController : ControllerBase
{
    private readonly LoyaltyRouletteService _service;
    private readonly ApplicationDbContext _context;

    public LoyaltyRouletteController(LoyaltyRouletteService service, ApplicationDbContext context)
    {
        _service = service;
        _context = context;
    }

    // GET: api/loyalty-roulette/prizes (público — arma los gajos de la rueda)
    [HttpGet("prizes")]
    [AllowAnonymous]
    [EnableRateLimiting("public-read")]
    public async Task<IActionResult> GetPrizes()
    {
        var prizes = await _context.LoyaltyPrizes
            .Where(p => p.IsActive)
            .OrderBy(p => p.Order)
            .ThenBy(p => p.Id)
            .Select(p => new LoyaltyPrizeSummary(p.Id, p.Name))
            .ToListAsync();

        return Ok(prizes);
    }

    // POST: api/loyalty-roulette/spin (público)
    [HttpPost("spin")]
    [AllowAnonymous]
    [EnableRateLimiting("roulette")]
    public async Task<IActionResult> Spin([FromBody] LoyaltySpinRequest request)
    {
        try
        {
            var result = await _service.SpinAsync(request);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    // GET: api/loyalty-roulette/prizes/all (admin — catálogo completo, activos e inactivos)
    [HttpGet("prizes/all")]
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Ruleta, PermissionActions.View, alsoCheckProfessional: true)]
    public async Task<IActionResult> GetPrizesAdmin()
    {
        var prizes = await _context.LoyaltyPrizes
            .OrderBy(p => p.Order)
            .ThenBy(p => p.Id)
            .Select(p => new LoyaltyPrizeAdminSummary(
                p.Id,
                p.Name,
                p.Description,
                p.Type.ToString(),
                p.Value,
                p.Probability,
                p.ValidityDays,
                p.IsActive,
                p.Order,
                _context.LoyaltySpins.Count(s => s.PrizeId == p.Id)))
            .ToListAsync();

        return Ok(prizes);
    }

    // POST: api/loyalty-roulette/prizes (admin)
    [HttpPost("prizes")]
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Ruleta, PermissionActions.Create, alsoCheckProfessional: true)]
    public async Task<IActionResult> CreatePrize([FromBody] SaveLoyaltyPrizeRequest request)
    {
        if (!Enum.TryParse<LoyaltyPrizeType>(request.Type, ignoreCase: true, out var type))
            return BadRequest(new { message = "Tipo de premio inválido" });

        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "El nombre del premio es requerido" });

        var prize = new LoyaltyPrize
        {
            Name = request.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            Type = type,
            Value = request.Value,
            Probability = request.Probability,
            ValidityDays = request.ValidityDays,
            IsActive = request.IsActive,
            Order = request.Order,
        };

        _context.LoyaltyPrizes.Add(prize);
        await _context.SaveChangesAsync();
        return Ok(new { id = prize.Id });
    }

    // PUT: api/loyalty-roulette/prizes/{id} (admin)
    // No hay DELETE a propósito: LoyaltySpin.PrizeId es Restrict, así que un
    // premio ya entregado no se puede borrar sin perder el historial de a
    // quién le tocó — desactivarlo (IsActive=false) lo saca de la rueda sin
    // romper esa referencia.
    [HttpPut("prizes/{id:int}")]
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Ruleta, PermissionActions.Edit, alsoCheckProfessional: true)]
    public async Task<IActionResult> UpdatePrize(int id, [FromBody] SaveLoyaltyPrizeRequest request)
    {
        var prize = await _context.LoyaltyPrizes.FindAsync(id);
        if (prize is null) return NotFound();

        if (!Enum.TryParse<LoyaltyPrizeType>(request.Type, ignoreCase: true, out var type))
            return BadRequest(new { message = "Tipo de premio inválido" });

        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "El nombre del premio es requerido" });

        prize.Name = request.Name.Trim();
        prize.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        prize.Type = type;
        prize.Value = request.Value;
        prize.Probability = request.Probability;
        prize.ValidityDays = request.ValidityDays;
        prize.IsActive = request.IsActive;
        prize.Order = request.Order;

        await _context.SaveChangesAsync();
        return Ok();
    }

    // GET: api/loyalty-roulette/spins (admin — historial de giros/ganadores)
    [HttpGet("spins")]
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Ruleta, PermissionActions.View, alsoCheckProfessional: true)]
    public async Task<IActionResult> GetSpins()
    {
        var spins = await _context.LoyaltySpins
            .Include(s => s.Prize)
            .OrderByDescending(s => s.SpunAt)
            .Select(s => new LoyaltySpinSummary(
                s.Id,
                s.CustomerName,
                s.WhatsApp,
                s.Prize!.Name,
                s.Code,
                s.SpunAt,
                s.ExpiresAt,
                s.Status.ToString(),
                s.RedeemedAt))
            .ToListAsync();

        return Ok(spins);
    }

    // POST: api/loyalty-roulette/spins/redeem (admin — canjear un código al mostrador)
    [HttpPost("spins/redeem")]
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Ruleta, PermissionActions.Edit, alsoCheckProfessional: true)]
    public async Task<IActionResult> Redeem([FromBody] RedeemLoyaltyCodeRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var (success, error) = await _service.RedeemAsync(request.Code, userId);
        return success ? Ok() : Conflict(new { message = error });
    }
}
