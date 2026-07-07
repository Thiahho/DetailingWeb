using DetailingApi.Data;
using DetailingApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace DetailingApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProfessionalsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public ProfessionalsController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET: api/professionals (público) — sin Commission, es dato interno
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var professionals = await _context.Professionals
            .Where(p => p.IsActive)
            .Include(p => p.Services)
            .OrderBy(p => p.Order)
            .ThenBy(p => p.CreatedAt)
            .Select(p => new
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
            })
            .ToListAsync();

        return Ok(professionals);
    }

    // GET: api/professionals/all (admin, incluye inactivos + Commission)
    [HttpGet("all")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAllAdmin()
    {
        var professionals = await _context.Professionals
            .Include(p => p.Services)
            .OrderBy(p => p.Order)
            .ThenBy(p => p.CreatedAt)
            .Select(p => new
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
                AccountEmail = _context.Users
                    .Where(u => u.ProfessionalId == p.Id && u.Role == "Professional")
                    .Select(u => u.Email)
                    .FirstOrDefault(),
                AccountUsername = _context.Users
                    .Where(u => u.ProfessionalId == p.Id && u.Role == "Professional")
                    .Select(u => u.Username)
                    .FirstOrDefault()
            })
            .ToListAsync();

        return Ok(professionals);
    }

    // GET: api/professionals/available?serviceId=X&timeSlotId=Y (público)
    // Profesionales activos que ofrecen el servicio y, según su horario semanal (si lo tienen cargado),
    // están trabajando en el día/franja horaria del turno elegido.
    [HttpGet("available")]
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

        var candidates = await _context.Professionals
            .Where(p => p.IsActive && p.Services.Any(s => s.Id == serviceId))
            .OrderBy(p => p.Order)
            .ThenBy(p => p.CreatedAt)
            .Select(p => new
            {
                p.Id,
                p.FirstName,
                p.LastName,
                p.PhotoUrl,
                p.CalendarColor,
                p.Specialty,
                p.Schedule
            })
            .ToListAsync();

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

    // GET: api/professionals/{id} (público)
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var professional = await _context.Professionals
            .Where(p => p.Id == id && p.IsActive)
            .Include(p => p.Services)
            .Select(p => new
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
            })
            .FirstOrDefaultAsync();

        if (professional == null)
            return NotFound(new { message = "Profesional no encontrado" });

        return Ok(professional);
    }

    // POST: api/professionals (admin)
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] ProfessionalRequest request)
    {
        var services = request.ServiceIds.Count > 0
            ? await _context.Services.Where(s => request.ServiceIds.Contains(s.Id)).ToListAsync()
            : new List<Service>();

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

        _context.Professionals.Add(professional);
        await _context.SaveChangesAsync();

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
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(int id, [FromBody] ProfessionalRequest request)
    {
        // Include(Services) para que el M2M quede trackeado y se pueda reconciliar
        var professional = await _context.Professionals
            .Include(p => p.Services)
            .FirstOrDefaultAsync(p => p.Id == id);

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

        var newServices = request.ServiceIds.Count > 0
            ? await _context.Services.Where(s => request.ServiceIds.Contains(s.Id)).ToListAsync()
            : new List<Service>();

        professional.Services.Clear();
        foreach (var service in newServices)
            professional.Services.Add(service);

        await _context.SaveChangesAsync();

        return Ok(new { message = "Profesional actualizado correctamente" });
    }

    // DELETE: api/professionals/{id} (admin)
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var professional = await _context.Professionals.FindAsync(id);
        if (professional == null)
            return NotFound(new { message = "Profesional no encontrado" });

        _context.Professionals.Remove(professional);
        await _context.SaveChangesAsync();

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
