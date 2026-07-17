using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace TTurnos.Api.Core.Reports;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class AnalyticsController : ControllerBase
{
    private readonly IAnalyticsRepository _repository;

    public AnalyticsController(IAnalyticsRepository repository)
    {
        _repository = repository;
    }

    // GET: api/analytics/summary
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary()
    {
        var now = DateTime.UtcNow;
        var startOfMonth = new DateTime(now.Year, now.Month, 1);
        var startOfLastMonth = startOfMonth.AddMonths(-1);

        // Total reservas del mes actual
        var bookingsThisMonth = await _repository.CountBookingsFromAsync(startOfMonth);

        // Reservas confirmadas/canceladas del mes actual
        var confirmedThisMonth = await _repository.CountBookingsFromAsync(startOfMonth, BookingStatus.Confirmed);
        var cancelledThisMonth = await _repository.CountBookingsFromAsync(startOfMonth, BookingStatus.Cancelled);

        // Total reservas del mes anterior
        var bookingsLastMonth = await _repository.CountBookingsBetweenAsync(startOfLastMonth, startOfMonth);

        // Total reservas históricas
        var totalBookings = await _repository.CountBookingsTotalAsync();

        // Tasa de confirmación y cancelación del mes actual
        var confirmationRate = bookingsThisMonth > 0
            ? Math.Round((double)confirmedThisMonth / bookingsThisMonth * 100, 1)
            : 0;

        var cancellationRate = bookingsThisMonth > 0
            ? Math.Round((double)cancelledThisMonth / bookingsThisMonth * 100, 1)
            : 0;

        // Reservas activas (pendientes o confirmadas)
        var activeBookings = await _repository.CountBookingsByStatusAsync(
            BookingStatus.Pending, BookingStatus.LegacyReserved, BookingStatus.Confirmed);

        // Turnos disponibles vs ocupados
        var totalSlots = await _repository.CountTimeSlotsTotalAsync();
        var availableSlots = await _repository.CountTimeSlotsAvailableAsync();
        var occupiedSlots = totalSlots - availableSlots;

        // Tasa de ocupación
        var occupancyRate = totalSlots > 0
            ? Math.Round((double)occupiedSlots / totalSlots * 100, 1)
            : 0;

        // Servicios más solicitados (top 5)
        var topServices = (await _repository.GetTopServicesAsync(5))
            .Select(s => new { s.Service, s.Count });

        // Anticipación promedio de reserva (en horas) del mes actual
        var leadTimes = await _repository.GetLeadTimesFromAsync(startOfMonth);
        var avgLeadTimeHours = leadTimes.Any()
            ? leadTimes.Average(b => (b.SlotStart - b.CreatedAt).TotalHours)
            : 0;

        // Reservas de los últimos 6 meses (por mes)
        var sixMonthsAgo = startOfMonth.AddMonths(-5);
        var bookingsByMonth = (await _repository.GetBookingsByMonthAsync(sixMonthsAgo))
            .Select(m => new { m.Year, m.Month, m.Count });

        // Próximos turnos reservados (próximos 7 días)
        var nextWeek = now.AddDays(7);
        var upcomingBookings = await _repository.GetUpcomingBookingsAsync(
            now, nextWeek, 5,
            BookingStatus.Pending, BookingStatus.LegacyReserved, BookingStatus.Confirmed);

        // Estadísticas por profesional del mes actual: ventas, horas ocupadas/libres, ausencias
        var endOfMonth = startOfMonth.AddMonths(1);
        var professionalStats = await _repository.GetProfessionalStatsAsync(startOfMonth, endOfMonth);

        return Ok(new
        {
            bookingsThisMonth,
            bookingsLastMonth,
            totalBookings,
            confirmedThisMonth,
            cancelledThisMonth,
            confirmationRate,
            cancellationRate,
            activeBookings,
            totalSlots,
            availableSlots,
            occupiedSlots,
            occupancyRate,
            avgLeadTimeHours = Math.Round(avgLeadTimeHours, 1),
            topServices,
            bookingsByMonth,
            upcomingBookings,
            professionalStats
        });
    }
}
