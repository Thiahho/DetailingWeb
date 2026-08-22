namespace Turneo.Api.Core.Reports;

public interface IAnalyticsRepository
{
    Task<int> CountBookingsFromAsync(DateTime from);
    Task<int> CountBookingsFromAsync(DateTime from, string status);
    Task<int> CountBookingsBetweenAsync(DateTime from, DateTime to);
    Task<int> CountBookingsTotalAsync();
    Task<int> CountBookingsByStatusAsync(params string[] statuses);
    Task<int> CountTimeSlotsTotalAsync();
    Task<int> CountTimeSlotsAvailableAsync();
    Task<List<(string Service, int Count)>> GetTopServicesAsync(int take);
    Task<List<(DateTime CreatedAt, DateTime SlotStart)>> GetLeadTimesFromAsync(DateTime from);
    Task<List<(int Year, int Month, int Count)>> GetBookingsByMonthAsync(DateTime from);
    Task<List<UpcomingBookingSummary>> GetUpcomingBookingsAsync(DateTime from, DateTime to, int take, params string[] statuses);
    Task<List<ProfessionalStatsSummary>> GetProfessionalStatsAsync(DateTime monthStart, DateTime monthEnd);

    // Comisiones a nivel negocio (tablero del jefe): si professionalId es null, agrega
    // todo el negocio; si se pasa, acota el desglose por-profesional a ese único registro.
    Task<CommissionsSummary> GetCommissionsSummaryAsync(DateTime from, DateTime to, int? professionalId);

    // Movimiento de turnos de un día: sin professionalId agrega todo el negocio,
    // con professionalId equivale a la vista "Día Trabajado" de ese empleado.
    Task<ProfessionalDaySummary> GetDaySummaryAllAsync(DateTime date, int? professionalId);

    // Desglose diario/semanal/mensual a nivel negocio (todos los profesionales),
    // aplicando la comisión de cada uno bucket por bucket antes de sumar.
    Task<List<BusinessEarningsPeriod>> GetBusinessEarningsBreakdownAsync(EarningsGranularity granularity, DateTime from, DateTime to);
}

public record ProfessionalCommissionSummary(int ProfessionalId, string ProfessionalName, decimal CommissionRate, decimal ChargedTotal, decimal CommissionAmount);

public record CommissionsSummary(decimal BusinessChargedTotal, decimal BusinessCommissionAmount, List<ProfessionalCommissionSummary> ByProfessional);

public record BusinessEarningsPeriod(DateTime PeriodStart, decimal ChargedTotal, decimal CommissionAmount);

public record UpcomingBookingSummary(int Id, string CustomerName, string? Subject, string? Service, DateTime StartDateTime);

public record ProfessionalStatsSummary(
    int ProfessionalId,
    string ProfessionalName,
    decimal RevenueThisMonth,
    int PaidBookingsThisMonth,
    double OccupiedHours,
    double FreeHours,
    double OccupancyRate,
    int UpcomingAbsences
);
