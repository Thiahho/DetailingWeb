using Hangfire;
using Hangfire.PostgreSql;
using Npgsql;

namespace Turneo.Api.Infrastructure.BackgroundJobs;

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

        var logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("BackgroundJobsSetup");

        AddOrUpdateSafely(logger, "process-pending-reminders", () =>
            RecurringJob.AddOrUpdate<HangfireReminderJob>(
                "process-pending-reminders",
                job => job.ProcessPendingRemindersAsync(),
                "*/5 * * * *" // cada 5 minutos
            ));

        AddOrUpdateSafely(logger, "evaluate-automation-rules", () =>
            RecurringJob.AddOrUpdate<AutomationRuleEvaluationJob>(
                "evaluate-automation-rules",
                job => job.EvaluateAllActiveRulesAsync(),
                "0 12 * * *" // 12:00 UTC ≈ 09:00 Argentina (sin horario de verano)
            ));

        AddOrUpdateSafely(logger, "check-low-stock-insumos", () =>
            RecurringJob.AddOrUpdate<LowStockAlertJob>(
                "check-low-stock-insumos",
                job => job.CheckLowStockAsync(),
                "0 12 * * *" // mismo horario que evaluate-automation-rules — un solo chequeo diario alcanza
            ));

        return app;
    }

    // Hangfire.PostgreSql puede lanzar "duplicate key value violates unique
    // constraint jobparameter_pkey" (SqlState 23505) cuando dos instancias
    // registran el mismo recurring job casi al mismo tiempo (p. ej. durante
    // un rolling deploy en Render, donde la instancia vieja y la nueva
    // conviven unos segundos). El registro es idempotente, así que si el
    // conflicto es por esa causa lo ignoramos en vez de tumbar el arranque.
    private static void AddOrUpdateSafely(ILogger logger, string jobId, Action register)
    {
        try
        {
            register();
        }
        catch (Exception ex) when (IsDuplicateKeyRace(ex))
        {
            logger.LogWarning(ex,
                "Recurring job '{JobId}' ya fue registrado por otra instancia concurrente; se ignora la violación de constraint.",
                jobId);
        }
        // AddOrUpdate toma un lock distribuido por job y espera 15s. Si otra
        // instancia lo tiene tomado (rolling deploy) o quedó huérfano en
        // hangfire.lock tras una caída, vence el timeout. El job ya está
        // registrado por arranques anteriores y sigue corriendo, así que no
        // tumbamos el arranque: un cambio de cron o de método en este deploy
        // recién se aplica en el próximo arranque que consiga el lock.
        catch (PostgreSqlDistributedLockException ex)
        {
            logger.LogWarning(ex,
                "No se pudo tomar el lock para registrar el recurring job '{JobId}'; se mantiene la definición ya registrada.",
                jobId);
        }
    }

    private static bool IsDuplicateKeyRace(Exception ex) =>
        ex is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } ||
        (ex.InnerException is not null && IsDuplicateKeyRace(ex.InnerException));
}
