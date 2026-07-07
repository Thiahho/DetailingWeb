using Hangfire;
using Hangfire.PostgreSql;

namespace TTurnos.Api.Infrastructure.BackgroundJobs;

public static class BackgroundJobsSetup
{
    public static IServiceCollection AddBackgroundJobs(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddHangfire(config =>
            config.UsePostgreSqlStorage(o =>
                o.UseNpgsqlConnection(configuration.GetConnectionString("DefaultConnection"))));
        services.AddHangfireServer();

        return services;
    }

    public static WebApplication UseBackgroundJobs(this WebApplication app)
    {
        app.UseHangfireDashboard("/hangfire", new DashboardOptions
        {
            Authorization = [new HangfireAdminAuthFilter()]
        });

        RecurringJob.AddOrUpdate<HangfireReminderJob>(
            "process-pending-reminders",
            job => job.ProcessPendingRemindersAsync(),
            "*/5 * * * *" // cada 5 minutos
        );

        return app;
    }
}
