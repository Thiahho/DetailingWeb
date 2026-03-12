using DetailingApi.Data;
using DetailingApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DetailingApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class AnalyticsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AnalyticsController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET: api/analytics/summary
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary()
    {
        var now = DateTime.UtcNow;
        var startOfMonth = new DateTime(now.Year, now.Month, 1);
        var startOfLastMonth = startOfMonth.AddMonths(-1);

        // Total reservas del mes actual
        var bookingsThisMonth = await _context.Bookings
            .Where(b => b.CreatedAt >= startOfMonth)
            .CountAsync();

        // Total reservas del mes anterior
        var bookingsLastMonth = await _context.Bookings
            .Where(b => b.CreatedAt >= startOfLastMonth && b.CreatedAt < startOfMonth)
            .CountAsync();

        // Total reservas históricas
        var totalBookings = await _context.Bookings.CountAsync();

        // Reservas activas (pendientes o confirmadas)
        var activeBookings = await _context.Bookings
            .Where(b => b.Status == BookingStatus.Pending || b.Status == BookingStatus.LegacyReserved || b.Status == BookingStatus.Confirmed)
            .CountAsync();

        // Turnos disponibles vs ocupados
        var totalSlots = await _context.TimeSlots.CountAsync();
        var availableSlots = await _context.TimeSlots.CountAsync(s => s.IsAvailable);
        var occupiedSlots = totalSlots - availableSlots;

        // Tasa de ocupación
        var occupancyRate = totalSlots > 0
            ? Math.Round((double)occupiedSlots / totalSlots * 100, 1)
            : 0;

        // Servicios más solicitados (top 5)
        var topServices = await _context.Bookings
            .Where(b => b.Service != null)
            .GroupBy(b => b.Service!)
            .Select(g => new { Service = g.Key, Count = g.Count() })
            .OrderByDescending(g => g.Count)
            .Take(5)
            .ToListAsync();

        // Reservas de los últimos 6 meses (por mes)
        var sixMonthsAgo = startOfMonth.AddMonths(-5);
        var bookingsByMonth = await _context.Bookings
            .Where(b => b.CreatedAt >= sixMonthsAgo)
            .GroupBy(b => new { b.CreatedAt.Year, b.CreatedAt.Month })
            .Select(g => new
            {
                Year = g.Key.Year,
                Month = g.Key.Month,
                Count = g.Count()
            })
            .OrderBy(g => g.Year).ThenBy(g => g.Month)
            .ToListAsync();

        // Próximos turnos reservados (próximos 7 días)
        var nextWeek = now.AddDays(7);
        var upcomingBookings = await _context.Bookings
            .Include(b => b.TimeSlot)
            .Where(b => b.TimeSlot.StartDateTime >= now
                     && b.TimeSlot.StartDateTime <= nextWeek
                     && (b.Status == BookingStatus.Pending || b.Status == BookingStatus.LegacyReserved || b.Status == BookingStatus.Confirmed))
            .OrderBy(b => b.TimeSlot.StartDateTime)
            .Select(b => new
            {
                b.Id,
                b.CustomerName,
                b.Vehicle,
                b.Service,
                StartDateTime = b.TimeSlot.StartDateTime
            })
            .Take(5)
            .ToListAsync();

        return Ok(new
        {
            bookingsThisMonth,
            bookingsLastMonth,
            totalBookings,
            activeBookings,
            totalSlots,
            availableSlots,
            occupiedSlots,
            occupancyRate,
            topServices,
            bookingsByMonth,
            upcomingBookings
        });
    }
}
