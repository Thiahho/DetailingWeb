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

        RecurringJob.AddOrUpdate<AutomationRuleEvaluationJob>(
            "evaluate-automation-rules",
            job => job.EvaluateAllActiveRulesAsync(),
            "0 12 * * *" // 12:00 UTC ≈ 09:00 Argentina (sin horario de verano)
        );

        return app;
    }
}
