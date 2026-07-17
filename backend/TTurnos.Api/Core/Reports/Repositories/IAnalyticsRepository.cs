namespace TTurnos.Api.Core.Reports;

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
}

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
