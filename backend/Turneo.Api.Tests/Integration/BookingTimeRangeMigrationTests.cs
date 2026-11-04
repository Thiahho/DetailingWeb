using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace Turneo.Api.Tests.Integration;

// Migration AddBookingTimeRange backfills Booking.StartDateTime/EndDateTime
// from each booking's TimeSlot and then makes both columns NOT NULL. Runs on
// its own database in the shared container: migrate to the migration before,
// insert a booking the old way (no range columns), then migrate to the end.
[Collection("Integration")]
public class BookingTimeRangeMigrationTests
{
    private const string MigrationBefore = "AddServiceDurationMinutes";
    private readonly CustomWebApplicationFactory _factory;

    public BookingTimeRangeMigrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private string SharedConnectionString()
    {
        using var scope = _factory.Services.CreateScope();
        return scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.GetConnectionString()!;
    }

    private static ApplicationDbContext ContextFor(string connectionString) =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql(connectionString)
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
                .Options,
            new CurrentTenantService());

    [Fact]
    public async Task ExistingBookings_GetTheirSlotTimes_AndColumnsBecomeNotNull()
    {
        var shared = new NpgsqlConnectionStringBuilder(SharedConnectionString());
        var databaseName = $"turneo_backfill_{Guid.NewGuid():N}";
        await using (var admin = new NpgsqlConnection(shared.ConnectionString))
        {
            await admin.OpenAsync();
            await using var create = new NpgsqlCommand($"CREATE DATABASE \"{databaseName}\"", admin);
            await create.ExecuteNonQueryAsync();
        }

        var target = new NpgsqlConnectionStringBuilder(shared.ConnectionString) { Database = databaseName, Pooling = false };
        await using (var db = ContextFor(target.ConnectionString))
        {
            await db.GetService<IMigrator>().MigrateAsync(MigrationBefore);
        }

        var start = new DateTime(2030, 5, 10, 10, 0, 0);
        var end = new DateTime(2030, 5, 10, 10, 30, 0);
        int bookingId;
        await using (var connection = new NpgsqlConnection(target.ConnectionString))
        {
            await connection.OpenAsync();
            await using var insert = new NpgsqlCommand(@"
                WITH tenant AS (SELECT ""Id"" FROM ""Tenants"" ORDER BY ""Id"" LIMIT 1),
                slot AS (
                    INSERT INTO ""TimeSlots"" (""TenantId"", ""StartDateTime"", ""EndDateTime"", ""IsAvailable"", ""IsBlocked"", ""MaxBookings"", ""GeneratedAt"")
                    SELECT ""Id"", @start, @end, false, false, 1, now() FROM tenant
                    RETURNING ""Id"", ""TenantId"")
                INSERT INTO ""Bookings"" (""TenantId"", ""TimeSlotId"", ""CustomerName"", ""Description"", ""CustomerPhone"",
                    ""CustomerEmailNormalized"", ""Subject"", ""Status"", ""TermsAcceptedAt"", ""TermsVersion"", ""CreatedAt"")
                SELECT ""TenantId"", ""Id"", 'Cliente Viejo', '', '1122334455', 'viejo@test.com', 'Corte', 'Pending', now(), 'v1', now()
                FROM slot
                RETURNING ""Id"";", connection);
            insert.Parameters.AddWithValue("start", start);
            insert.Parameters.AddWithValue("end", end);
            bookingId = (int)(await insert.ExecuteScalarAsync())!;
        }

        await using (var db = ContextFor(target.ConnectionString))
        {
            await db.GetService<IMigrator>().MigrateAsync();
        }

        await using (var connection = new NpgsqlConnection(target.ConnectionString))
        {
            await connection.OpenAsync();
            await using var read = new NpgsqlCommand(@"SELECT ""StartDateTime"", ""EndDateTime"" FROM ""Bookings"" WHERE ""Id"" = @id", connection);
            read.Parameters.AddWithValue("id", bookingId);
            await using (var reader = await read.ExecuteReaderAsync())
            {
                Assert.True(await reader.ReadAsync());
                Assert.Equal(start, reader.GetDateTime(0));
                Assert.Equal(end, reader.GetDateTime(1));
            }

            await using var nullable = new NpgsqlCommand(@"
                SELECT count(*) FROM information_schema.columns
                WHERE table_name = 'Bookings' AND column_name IN ('StartDateTime', 'EndDateTime') AND is_nullable = 'NO'", connection);
            Assert.Equal(2L, (long)(await nullable.ExecuteScalarAsync())!);
        }

        await using (var admin = new NpgsqlConnection(shared.ConnectionString))
        {
            await admin.OpenAsync();
            await using var drop = new NpgsqlCommand($"DROP DATABASE \"{databaseName}\" WITH (FORCE)", admin);
            await drop.ExecuteNonQueryAsync();
        }
    }
}
