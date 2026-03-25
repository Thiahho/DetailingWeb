using DetailingApi.Data;
using DetailingApi.Models;
using DetailingApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace DetailingApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BookingsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly NotificationService _notificationService;

    public BookingsController(ApplicationDbContext context, NotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    // POST: api/bookings (público - para clientes)
    [HttpPost]
    [AllowAnonymous]
    public async Task<IActionResult> CreateBooking([FromBody] CreateBookingRequest request)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync();

        var updatedRows = await _context.TimeSlots
            .Where(t => t.Id == request.TimeSlotId && t.IsAvailable)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(t => t.IsAvailable, false));

        if (updatedRows == 0)
        {
            var exists = await _context.TimeSlots.AnyAsync(t => t.Id == request.TimeSlotId);

            if (!exists)
            {
                return NotFound(new { success = false, message = "Turno no encontrado" });
            }

            return Conflict(new { success = false, message = "turno ya reservado" });
        }

        var timeSlot = await _context.TimeSlots
            .AsNoTracking()
            .FirstAsync(t => t.Id == request.TimeSlotId);

        var selectedService = await _context.Services
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Slug == request.Service && s.IsActive);

        if (selectedService == null)
        {
            return BadRequest(new { success = false, message = "Servicio inválido o inactivo" });
        }

        var customizationValidationError = ValidateCustomization(
            selectedService.CustomizationSchemaJson,
            request.CustomizationJson);
        if (customizationValidationError != null)
        {
            return BadRequest(new { success = false, message = customizationValidationError });
        }

        var booking = new Booking
        {
            TimeSlotId = request.TimeSlotId,
            CustomerName = request.CustomerName,
            CustomerPhone = request.CustomerPhone,
            Email = request.Email,
            Vehicle = request.Vehicle,
            Service = request.Service,
            CustomizationJson = request.CustomizationJson,
            Message = request.Message,
            Status = BookingStatus.Pending
        };

        _context.Bookings.Add(booking);

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();
        await _notificationService.DispatchForBookingAsync(booking.Id, NotificationEventType.BookingCreated);

        return Ok(new
        {
            success = true,
            message = "Turno agendado exitosamente",
            booking = new
            {
                id = booking.Id,
                customerName = booking.CustomerName,
                vehicle = booking.Vehicle,
                service = booking.Service,
                customizationJson = booking.CustomizationJson,
                startDateTime = timeSlot.StartDateTime,
                endDateTime = timeSlot.EndDateTime
            }
        });
    }

    // GET: api/bookings (admin - todas las reservas)
    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAllBookings()
    {
        var bookings = await _context.Bookings
            .Include(b => b.TimeSlot)
            .GroupJoin(
                _context.NotificationLogs,
                b => b.Id,
                n => n.BookingId,
                (b, logs) => new { Booking = b, Logs = logs })
            .OrderByDescending(x => x.Booking.CreatedAt)
            .Select(x => new
            {
                id = x.Booking.Id,
                customerName = x.Booking.CustomerName,
                customerPhone = x.Booking.CustomerPhone,
                Email = x.Booking.Email,
                vehicle = x.Booking.Vehicle,
                service = x.Booking.Service,
                customizationJson = x.Booking.CustomizationJson,
                message = x.Booking.Message,
                status = x.Booking.Status == BookingStatus.LegacyReserved ? BookingStatus.Pending : x.Booking.Status,
                timeSlotId = x.Booking.TimeSlotId,
                startDateTime = x.Booking.TimeSlot.StartDateTime,
                endDateTime = x.Booking.TimeSlot.EndDateTime,
                isAvailable = x.Booking.TimeSlot.IsAvailable,
                createdAt = x.Booking.CreatedAt,
                cancelledAt = x.Booking.CancelledAt,
                notificationStatus = x.Logs.Any(l => l.Status == NotificationDeliveryStatus.Failed)
                    ? NotificationDeliveryStatus.Failed
                    : x.Logs.Any(l => l.Status == NotificationDeliveryStatus.Pending)
                        ? NotificationDeliveryStatus.Pending
                        : x.Logs.Any(l => l.Status == NotificationDeliveryStatus.Sent)
                            ? NotificationDeliveryStatus.Sent
                            : NotificationDeliveryStatus.Pending,
                notificationLogs = x.Logs
                    .OrderByDescending(l => l.CreatedAt)
                    .Select(l => new
                    {
                        channel = l.Channel,
                        eventType = l.EventType,
                        status = l.Status,
                        providerMessageId = l.ProviderMessageId,
                        errorMessage = l.ErrorMessage,
                        retryCount = l.RetryCount,
                        createdAt = l.CreatedAt,
                        lastAttemptAt = l.LastAttemptAt
                    })
            })
            .ToListAsync();

        return Ok(bookings);
    }

    // GET: api/bookings/{id} (público - ver detalle para cancelar)
    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetBooking(int id)
    {
        var booking = await _context.Bookings
            .Include(b => b.TimeSlot)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (booking == null)
            return NotFound(new { success = false, message = "Reserva no encontrada" });

        return Ok(new
        {
            id = booking.Id,
            customerName = booking.CustomerName,
            service = booking.Service,
            vehicle = booking.Vehicle,
            customizationJson = booking.CustomizationJson,
            startDateTime = booking.TimeSlot.StartDateTime,
            status = booking.Status == BookingStatus.LegacyReserved ? BookingStatus.Pending : booking.Status,
            cancelledAt = booking.CancelledAt
        });
    }

    // POST: api/bookings/{id}/cancel (público - cancelar por link de email)
    [HttpPost("{id}/cancel")]
    [AllowAnonymous]
    public async Task<IActionResult> CancelBooking(int id)
    {
        var booking = await _context.Bookings
            .Include(b => b.TimeSlot)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (booking == null)
            return NotFound(new { success = false, message = "Reserva no encontrada" });

        if (booking.Status == BookingStatus.Cancelled)
            return BadRequest(new { success = false, message = "Este turno ya fue cancelado" });

        if (booking.TimeSlot.EndDateTime < DateTime.UtcNow)
            return BadRequest(new { success = false, message = "Este turno ya expiró y no puede cancelarse" });

        booking.Status = BookingStatus.Cancelled;
        booking.CancelledAt = DateTime.UtcNow;
        booking.TimeSlot.IsAvailable = true;

        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Turno cancelado exitosamente" });
    }

    // DELETE: api/bookings/expired (admin)
    [HttpDelete("expired")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteExpiredBookings()
    {
        var now = DateTime.UtcNow;

        var deletedSlots = await _context.TimeSlots
            .Where(t => t.EndDateTime < now)
            .ExecuteDeleteAsync();

        return Ok(new { success = true, deletedTimeSlots = deletedSlots });
    }

    // PATCH: api/bookings/{id}/confirm (admin)
    [HttpPatch("{id}/confirm")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ConfirmBooking(int id)
    {
        var booking = await _context.Bookings.FindAsync(id);
        if (booking == null)
            return NotFound(new { success = false, message = "Reserva no encontrada" });

        booking.Status = BookingStatus.Confirmed;
        await _context.SaveChangesAsync();
        await _notificationService.DispatchForBookingAsync(booking.Id, NotificationEventType.BookingConfirmed);

        return Ok(new { success = true, message = "Turno confirmado exitosamente" });
    }

    private static string? ValidateCustomization(string? schemaJson, string? customizationJson)
    {
        if (string.IsNullOrWhiteSpace(schemaJson))
            return null;

        ServiceCustomizationSchema? schema;
        try
        {
            schema = JsonSerializer.Deserialize<ServiceCustomizationSchema>(schemaJson);
        }
        catch (JsonException)
        {
            return "El schema del servicio no es válido";
        }

        if (schema == null || schema.Fields.Count == 0)
            return null;

        Dictionary<string, JsonElement> values = new();
        if (!string.IsNullOrWhiteSpace(customizationJson))
        {
            try
            {
                values = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(customizationJson) ?? new();
            }
            catch (JsonException)
            {
                return "La personalización seleccionada no es un JSON válido";
            }
        }

        foreach (var field in schema.Fields)
        {
            var hasValue = values.TryGetValue(field.Key, out var valueElement);
            if (field.Required && !hasValue)
                return $"Falta completar el campo obligatorio '{field.Label}'";

            if (!hasValue)
                continue;

            switch (field.Type)
            {
                case "checkbox":
                    if (valueElement.ValueKind is not JsonValueKind.True and not JsonValueKind.False)
                        return $"El campo '{field.Label}' debe ser booleano";
                    break;
                case "number":
                    if (valueElement.ValueKind != JsonValueKind.Number)
                        return $"El campo '{field.Label}' debe ser numérico";
                    break;
                case "text":
                    if (valueElement.ValueKind != JsonValueKind.String)
                        return $"El campo '{field.Label}' debe ser texto";
                    break;
                case "select":
                    if (valueElement.ValueKind != JsonValueKind.String)
                        return $"El campo '{field.Label}' debe ser una opción válida";
                    var selected = valueElement.GetString();
                    if (field.Options == null || !field.Options.Contains(selected))
                        return $"La opción elegida para '{field.Label}' no es válida";
                    break;
            }
        }

        return null;
    }
}

// DTO
public class CreateBookingRequest
{
    public int TimeSlotId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Vehicle { get; set; } = string.Empty;
    public string Service { get; set; } = string.Empty;
    public string? CustomizationJson { get; set; }
    public string? Message { get; set; }
}
