using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace Turneo.Api.Core.Professionals;

[ApiController]
[Route("api/[controller]")]
public class ProfessionalsController : ControllerBase
{
    private readonly IProfessionalsRepository _repository;
    private readonly IPlanLimitsService _planLimits;
    // Solo para GetAvailable: la búsqueda de TimeSlot es una consulta de
    // Scheduling, no de Professionals — ver nota en IProfessionalsRepository.
    private readonly ApplicationDbContext _context;
    private readonly CloudinaryAdminService _cloudinary;
    private readonly ILogger<ProfessionalsController> _logger;

    public ProfessionalsController(IProfessionalsRepository repository, IPlanLimitsService planLimits, ApplicationDbContext context, CloudinaryAdminService cloudinary, ILogger<ProfessionalsController> logger)
    {
        _repository = repository;
        _planLimits = planLimits;
        _context = context;
        _cloudinary = cloudinary;
        _logger = logger;
    }

    // GET: api/professionals (público) — sin Commission, es dato interno
    [HttpGet]
    [AllowAnonymous]
    [EnableRateLimiting("public-read")]
    public async Task<IActionResult> GetAll()
    {
        var professionals = await _repository.GetActiveWithServicesAsync();

        return Ok(professionals.Select(p => new
        {
            p.Id,
            p.FirstName,
            p.LastName,
            p.PhotoUrl,
            p.CalendarColor,
            p.Specialty,
            p.Schedule,
            p.IsActive,
            p.Order,
            Services = p.Services.Select(s => new { s.Id, s.Title })
        }));
    }

    // GET: api/professionals/all (admin, incluye inactivos + Commission)
    [HttpGet("all")]
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Profesionales, PermissionActions.View, alsoCheckProfessional: true)]
    public async Task<IActionResult> GetAllAdmin()
    {
        var professionals = await _repository.GetAllWithServicesAsync();
        var accounts = await _repository.GetProfessionalAccountsAsync();

        return Ok(professionals.Select(p =>
        {
            accounts.TryGetValue(p.Id, out var account);
            return new
            {
                p.Id,
                p.FirstName,
                p.LastName,
                p.PhotoUrl,
                p.CalendarColor,
                p.Specialty,
                p.Commission,
                p.Schedule,
                p.IsActive,
                p.Order,
                p.CreatedAt,
                p.UpdatedAt,
                Services = p.Services.Select(s => new { s.Id, s.Title }),
                AccountUserId = account.Email != null ? (int?)account.UserId : null,
                AccountEmail = account.Email,
                AccountUsername = account.Username,
                AccountTelegramChatId = account.TelegramChatId
            };
        }));
    }

    // GET: api/professionals/available?serviceId=X&timeSlotId=Y (público)
    // Profesionales activos que ofrecen el servicio y, según su horario semanal (si lo tienen cargado),
    // están trabajando en el día/franja horaria del turno elegido.
    [HttpGet("available")]
    [AllowAnonymous]
    [EnableRateLimiting("public-read")]
    public async Task<IActionResult> GetAvailable([FromQuery] int serviceId, [FromQuery] int timeSlotId)
    {
        if (serviceId <= 0 || timeSlotId <= 0)
            return BadRequest(new { message = "serviceId y timeSlotId son requeridos" });

        var timeSlot = await _context.TimeSlots
            .Where(t => t.Id == timeSlotId)
            .Select(t => new { t.StartDateTime, t.EndDateTime })
            .FirstOrDefaultAsync();

        if (timeSlot == null)
            return NotFound(new { message = "Turno no encontrado" });

        var candidates = await _repository.GetActiveByServiceAsync(serviceId);

        var dayOfWeek = (int)timeSlot.StartDateTime.DayOfWeek;
        var slotStart = timeSlot.StartDateTime.TimeOfDay;
        var slotEnd = timeSlot.EndDateTime.TimeOfDay;

        var available = candidates
            .Where(p => IsWorkingDuringSlot(p.Schedule, dayOfWeek, slotStart, slotEnd))
            .Select(p => new
            {
                p.Id,
                p.FirstName,
                p.LastName,
                p.PhotoUrl,
                p.CalendarColor,
                p.Specialty
            });

        return Ok(available);
    }

    private static readonly JsonSerializerOptions ScheduleJsonOptions = new(JsonSerializerDefaults.Web);

    // Si el profesional no tiene horario cargado todavía, se lo considera disponible por defecto.
    private static bool IsWorkingDuringSlot(string? scheduleJson, int dayOfWeek, TimeSpan slotStart, TimeSpan slotEnd)
    {
        if (string.IsNullOrWhiteSpace(scheduleJson))
            return true;

        List<WeeklyScheduleDay>? schedule;
        try
        {
            schedule = JsonSerializer.Deserialize<List<WeeklyScheduleDay>>(scheduleJson, ScheduleJsonOptions);
        }
        catch (JsonException)
        {
            return true;
        }

        if (schedule == null || schedule.Count == 0)
            return true;

        return schedule.Any(day =>
            day.Enabled &&
            day.DayOfWeek == dayOfWeek &&
            TimeSpan.TryParse(day.Start, out var start) &&
            TimeSpan.TryParse(day.End, out var end) &&
            slotStart >= start &&
            slotEnd <= end);
    }

    // GET: api/professionals/me (el propio profesional ve sus datos básicos)
    [HttpGet("me")]
    [Authorize(Roles = "Professional")]
    public async Task<IActionResult> GetMyProfile()
    {
        var professionalId = GetOwnProfessionalId();
        if (professionalId == null)
            return Unauthorized();

        var professional = await _repository.GetByIdAsync(professionalId.Value);
        if (professional == null)
            return NotFound(new { message = "Profesional no encontrado" });

        return Ok(new
        {
            professional.Id,
            professional.FirstName,
            professional.LastName,
            professional.Specialty
        });
    }

    // PUT: api/professionals/me (el propio profesional edita nombre/especialidad —
    // no comisión, estado, orden ni servicios: eso sigue siendo config del admin)
    [HttpPut("me")]
    [Authorize(Roles = "Professional")]
    public async Task<IActionResult> UpdateMyProfile([FromBody] UpdateMyProfileRequest request)
    {
        var professionalId = GetOwnProfessionalId();
        if (professionalId == null)
            return Unauthorized();

        var professional = await _repository.GetByIdAsync(professionalId.Value);
        if (professional == null)
            return NotFound(new { message = "Profesional no encontrado" });

        professional.FirstName = request.FirstName;
        professional.LastName = request.LastName;
        professional.Specialty = request.Specialty;
        professional.UpdatedAt = DateTime.UtcNow;

        await _repository.SaveChangesAsync();
        return Ok(new { message = "Datos actualizados" });
    }

    // GET: api/professionals/me/earnings?year=&month= (el propio profesional ve su comisión del mes)
    [HttpGet("me/earnings")]
    [Authorize(Roles = "Professional")]
    public async Task<IActionResult> GetMyEarnings([FromQuery] int year, [FromQuery] int month)
    {
        if (month is < 1 or > 12)
            return BadRequest(new { message = "Mes inválido" });

        var professionalId = GetOwnProfessionalId();
        if (professionalId == null)
            return Unauthorized();

        var professional = await _repository.GetByIdAsync(professionalId.Value);
        if (professional == null)
            return NotFound(new { message = "Profesional no encontrado" });

        var from = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var to = from.AddMonths(1);

        var chargedTotal = await _repository.GetChargedTotalInRangeAsync(professionalId.Value, from, to);
        var commissionAmount = chargedTotal * (professional.Commission / 100m);

        return Ok(new
        {
            year,
            month,
            commissionRate = professional.Commission,
            chargedTotal,
            commissionAmount
        });
    }

    // GET: api/professionals/me/day?date= (movimiento de turnos del día para "Día Trabajado")
    [HttpGet("me/day")]
    [Authorize(Roles = "Professional")]
    public async Task<IActionResult> GetMyDay([FromQuery] DateTime date)
    {
        var professionalId = GetOwnProfessionalId();
        if (professionalId == null)
            return Unauthorized();

        var summary = await _repository.GetDaySummaryAsync(professionalId.Value, date);
        return Ok(summary);
    }

    // GET: api/professionals/me/earnings/breakdown?granularity=day|week|month&from=&to=
    [HttpGet("me/earnings/breakdown")]
    [Authorize(Roles = "Professional")]
    public async Task<IActionResult> GetMyEarningsBreakdown([FromQuery] string granularity, [FromQuery] DateTime from, [FromQuery] DateTime to)
    {
        if (!Enum.TryParse<EarningsGranularity>(granularity, ignoreCase: true, out var parsedGranularity))
            return BadRequest(new { message = "granularity inválido (day, week o month)" });

        if (to <= from)
            return BadRequest(new { message = "El rango de fechas es inválido" });

        var professionalId = GetOwnProfessionalId();
        if (professionalId == null)
            return Unauthorized();

        var professional = await _repository.GetByIdAsync(professionalId.Value);
        if (professional == null)
            return NotFound(new { message = "Profesional no encontrado" });

        var breakdown = await _repository.GetEarningsBreakdownAsync(professionalId.Value, parsedGranularity, from, to);

        return Ok(breakdown.Select(period => new
        {
            periodStart = period.PeriodStart,
            chargedTotal = period.ChargedTotal,
            commissionAmount = period.ChargedTotal * (professional.Commission / 100m)
        }));
    }

    private int? GetOwnProfessionalId()
    {
        var claim = User.FindFirst("professional_id")?.Value;
        return int.TryParse(claim, out var id) ? id : null;
    }

    // GET: api/professionals/{id} (público)
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var professional = await _repository.GetActiveByIdWithServicesAsync(id);

        if (professional == null)
            return NotFound(new { message = "Profesional no encontrado" });

        return Ok(new
        {
            professional.Id,
            professional.FirstName,
            professional.LastName,
            professional.PhotoUrl,
            professional.CalendarColor,
            professional.Specialty,
            professional.Schedule,
            professional.IsActive,
            professional.Order,
            Services = professional.Services.Select(s => new { s.Id, s.Title })
        });
    }

    // POST: api/professionals (admin)
    [HttpPost]
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Profesionales, PermissionActions.Create, alsoCheckProfessional: true)]
    public async Task<IActionResult> Create([FromBody] ProfessionalRequest request)
    {
        var activeCount = await _repository.CountActiveAsync();
        if (!await _planLimits.IsWithinLimitAsync("MaxProfessionals", activeCount))
        {
            return StatusCode(StatusCodes.Status402PaymentRequired, new
            {
                message = "Alcanzaste el límite de profesionales de tu plan. Actualizá tu plan para agregar más."
            });
        }

        var services = await _repository.GetServicesByIdsAsync(request.ServiceIds);

        var professional = new Professional
        {
            FirstName = request.FirstName,
            LastName = request.LastName,
            PhotoUrl = request.PhotoUrl ?? string.Empty,
            CalendarColor = request.CalendarColor,
            Specialty = request.Specialty,
            Commission = request.Commission,
            Schedule = request.Schedule,
            IsActive = request.IsActive,
            Order = request.Order,
            Services = services
        };

        _repository.Add(professional);
        await _repository.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = professional.Id }, new
        {
            professional.Id,
            professional.FirstName,
            professional.LastName,
            professional.PhotoUrl,
            professional.CalendarColor,
            professional.Specialty,
            professional.Commission,
            professional.Schedule,
            professional.IsActive,
            professional.Order,
            Services = professional.Services.Select(s => new { s.Id, s.Title })
        });
    }

    // PUT: api/professionals/{id} (admin)
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Profesionales, PermissionActions.Edit, alsoCheckProfessional: true)]
    public async Task<IActionResult> Update(int id, [FromBody] ProfessionalRequest request)
    {
        // Include(Services) para que el M2M quede trackeado y se pueda reconciliar
        var professional = await _repository.GetByIdWithServicesAsync(id);

        if (professional == null)
            return NotFound(new { message = "Profesional no encontrado" });

        professional.FirstName = request.FirstName;
        professional.LastName = request.LastName;
        professional.PhotoUrl = request.PhotoUrl ?? string.Empty;
        professional.CalendarColor = request.CalendarColor;
        professional.Specialty = request.Specialty;
        professional.Commission = request.Commission;
        professional.Schedule = request.Schedule;
        professional.IsActive = request.IsActive;
        professional.Order = request.Order;
        professional.UpdatedAt = DateTime.UtcNow;

        var newServices = await _repository.GetServicesByIdsAsync(request.ServiceIds);

        professional.Services.Clear();
        foreach (var service in newServices)
            professional.Services.Add(service);

        await _repository.SaveChangesAsync();

        return Ok(new { message = "Profesional actualizado correctamente" });
    }

    // DELETE: api/professionals/{id} (admin)
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Profesionales, PermissionActions.Delete, alsoCheckProfessional: true)]
    public async Task<IActionResult> Delete(int id)
    {
        var professional = await _repository.GetByIdAsync(id);
        if (professional == null)
            return NotFound(new { message = "Profesional no encontrado" });

        _repository.Remove(professional);
        await _repository.SaveChangesAsync();

        if (!string.IsNullOrWhiteSpace(professional.PhotoUrl))
        {
            var (deleted, error) = await _cloudinary.TryDestroyAsync(professional.PhotoUrl);
            if (!deleted)
                _logger.LogWarning("[Professionals] No se pudo borrar {PhotoUrl} de Cloudinary tras eliminar profesional {Id}: {Error}", professional.PhotoUrl, id, error);
        }

        return Ok(new { message = "Profesional eliminado correctamente" });
    }
}

public class ProfessionalRequest
{
    [Required, StringLength(100, MinimumLength = 1)]
    public string FirstName { get; set; } = string.Empty;

    [Required, StringLength(100, MinimumLength = 1)]
    public string LastName { get; set; } = string.Empty;

    [StringLength(500)]
    public string? PhotoUrl { get; set; }

    [Required, RegularExpression("^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$",
        ErrorMessage = "CalendarColor debe ser un color hexadecimal (#RRGGBB)")]
    public string CalendarColor { get; set; } = "#7c3aed";

    [StringLength(100)]
    public string? Specialty { get; set; }

    [Range(0, 100)]
    public decimal Commission { get; set; } = 0;

    [StringLength(4000)]
    public string? Schedule { get; set; }

    public bool IsActive { get; set; } = true;

    [Range(0, int.MaxValue)]
    public int Order { get; set; } = 0;

    public List<int> ServiceIds { get; set; } = new();
}

public class UpdateMyProfileRequest
{
    [Required, StringLength(100, MinimumLength = 1)]
    public string FirstName { get; set; } = string.Empty;

    [Required, StringLength(100, MinimumLength = 1)]
    public string LastName { get; set; } = string.Empty;

    [StringLength(100)]
    public string? Specialty { get; set; }
}
