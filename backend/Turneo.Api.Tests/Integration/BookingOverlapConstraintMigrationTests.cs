using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace Turneo.Api.Tests.Integration;

// Migration AddBookingOverlapConstraint never touches data: when existing
// bookings already break the new rules (overlapping active bookings of the
// same professional, or a range ending at or before its start) it fails with
// the conflicting booking ids per tenant, and the constraints are not added.
// Each test runs on its own database in the shared container.
[Collection("Integration")]
public class BookingOverlapConstraintMigrationTests
{
    private const string MigrationBefore = "AddBookingTimeRange";
    private readonly CustomWebApplicationFactory _factory;

    public BookingOverlapConstraintMigrationTests(CustomWebApplicationFactory factory)
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

    private async Task<(string Admin, string Target, string Name)> CreateDatabaseBeforeMigrationAsync()
    {
        var shared = new NpgsqlConnectionStringBuilder(SharedConnectionString());
        var databaseName = $"turneo_overlap_{Guid.NewGuid():N}";
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

        return (shared.ConnectionString, target.ConnectionString, databaseName);
    }

    private static async Task DropDatabaseAsync(string adminConnectionString, string databaseName)
    {
        await using var admin = new NpgsqlConnection(adminConnectionString);
        await admin.OpenAsync();
        await using var drop = new NpgsqlCommand($"DROP DATABASE \"{databaseName}\" WITH (FORCE)", admin);
        await drop.ExecuteNonQueryAsync();
    }

    private static async Task<int> ScalarIntAsync(NpgsqlConnection connection, string sql, params (string Name, object Value)[] parameters)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        foreach (var (name, value) in parameters)
            command.Parameters.AddWithValue(name, value);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }

    private static Task<int> TenantAsync(NpgsqlConnection connection) =>
        ScalarIntAsync(connection, @"SELECT ""Id"" FROM ""Tenants"" ORDER BY ""Id"" LIMIT 1");

    private static Task<int> ProfessionalAsync(NpgsqlConnection connection, int tenantId) =>
        ScalarIntAsync(connection, @"
            INSERT INTO ""Professionals"" (""TenantId"", ""FirstName"", ""LastName"", ""CalendarColor"", ""PhotoUrl"", ""Commission"", ""IsActive"", ""Order"", ""CreatedAt"", ""UpdatedAt"")
            VALUES (@tenant, 'Pro', 'Migracion', '#7c3aed', '', 10, true, 0, now(), now())
            RETURNING ""Id"";", ("tenant", tenantId));

    // A slot plus a booking with an explicit range, written the way the
    // database looks right before the migration.
    private static async Task<int> BookingAsync(NpgsqlConnection connection, int tenantId, int? professionalId,
        DateTime start, DateTime end, string status = "Pending")
    {
        var slotId = await ScalarIntAsync(connection, @"
            INSERT INTO ""TimeSlots"" (""TenantId"", ""StartDateTime"", ""EndDateTime"", ""IsAvailable"", ""IsBlocked"", ""MaxBookings"", ""GeneratedAt"")
            VALUES (@tenant, @start, @start + interval '30 minutes', false, false, 1, now())
            RETURNING ""Id"";", ("tenant", tenantId), ("start", start));

        await using var insert = new NpgsqlCommand(@"
            INSERT INTO ""Bookings"" (""TenantId"", ""TimeSlotId"", ""ProfessionalId"", ""CustomerName"", ""Description"", ""CustomerPhone"",
                ""CustomerEmailNormalized"", ""Subject"", ""Status"", ""TermsAcceptedAt"", ""TermsVersion"", ""CreatedAt"",
                ""StartDateTime"", ""EndDateTime"")
            VALUES (@tenant, @slot, @professional, 'Cliente Viejo', '', '1122334455', 'viejo@test.com', 'Corte', @status, now(), 'v1', now(),
                @start, @end)
            RETURNING ""Id"";", connection);
        insert.Parameters.AddWithValue("tenant", tenantId);
        insert.Parameters.AddWithValue("slot", slotId);
        insert.Parameters.AddWithValue("professional", (object?)professionalId ?? DBNull.Value);
        insert.Parameters.AddWithValue("status", status);
        insert.Parameters.AddWithValue("start", start);
        insert.Parameters.AddWithValue("end", end);
        return (int)(await insert.ExecuteScalarAsync())!;
    }

    private static Task<int> ConstraintCountAsync(NpgsqlConnection connection) =>
        ScalarIntAsync(connection, @"
            SELECT count(*) FROM pg_constraint
            WHERE conname IN ('CK_Bookings_EndAfterStart', 'EX_Bookings_ProfessionalTimeOverlap')");

    [Fact]
    public async Task ExistingViolations_FailTheMigration_ListingTheBookingIds()
    {
        var (adminConnection, target, name) = await CreateDatabaseBeforeMigrationAsync();
        var day = new DateTime(2031, 3, 10, 10, 0, 0);
        int tenantId, overlapA, overlapB, nullA, nullB, invalid;
        await using (var connection = new NpgsqlConnection(target))
        {
            await connection.OpenAsync();
            tenantId = await TenantAsync(connection);
            var professionalId = await ProfessionalAsync(connection, tenantId);
            overlapA = await BookingAsync(connection, tenantId, professionalId, day, day.AddHours(3));
            overlapB = await BookingAsync(connection, tenantId, professionalId, day.AddHours(1), day.AddHours(2), "Confirmed");
            nullA = await BookingAsync(connection, tenantId, null, day, day.AddHours(1), "Reservado");
            nullB = await BookingAsync(connection, tenantId, null, day.AddMinutes(30), day.AddHours(1));
            invalid = await BookingAsync(connection, tenantId, professionalId, day.AddDays(1), day.AddDays(1));
        }

        var error = await Assert.ThrowsAsync<PostgresException>(async () =>
        {
            await using var db = ContextFor(target);
            await db.GetService<IMigrator>().MigrateAsync();
        });

        Assert.Contains("AddBookingOverlapConstraint", error.MessageText);
        Assert.Contains($"tenant {tenantId}: bookings {overlapA} and {overlapB}", error.MessageText);
        Assert.Contains($"tenant {tenantId}: bookings {nullA} and {nullB}", error.MessageText);
        Assert.Contains($"tenant {tenantId}: booking {invalid}", error.MessageText);

        await using (var connection = new NpgsqlConnection(target))
        {
            await connection.OpenAsync();
            Assert.Equal(0, await ConstraintCountAsync(connection));
            // Nothing was modified or cancelled.
            Assert.Equal(5, await ScalarIntAsync(connection, @"SELECT count(*) FROM ""Bookings"" WHERE ""Status"" <> 'Cancelled'"));
        }

        await DropDatabaseAsync(adminConnection, name);
    }

    [Fact]
    public async Task CleanData_MigrationAddsBothConstraints()
    {
        var (adminConnection, target, name) = await CreateDatabaseBeforeMigrationAsync();
        var day = new DateTime(2031, 3, 10, 10, 0, 0);
        await using (var connection = new NpgsqlConnection(target))
        {
            await connection.OpenAsync();
            var tenantId = await TenantAsync(connection);
            var professionalId = await ProfessionalAsync(connection, tenantId);
            var otherProfessionalId = await ProfessionalAsync(connection, tenantId);
            // Adjacent, different professional, cancelled overlap, no professional.
            await BookingAsync(connection, tenantId, professionalId, day, day.AddHours(1));
            await BookingAsync(connection, tenantId, professionalId, day.AddHours(1), day.AddHours(2));
            await BookingAsync(connection, tenantId, otherProfessionalId, day, day.AddHours(2));
            await BookingAsync(connection, tenantId, professionalId, day.AddMinutes(30), day.AddHours(1), "Cancelled");
            await BookingAsync(connection, tenantId, null, day, day.AddHours(1));
        }

        await using (var db = ContextFor(target))
        {
            await db.GetService<IMigrator>().MigrateAsync();
        }

        await using (var connection = new NpgsqlConnection(target))
        {
            await connection.OpenAsync();
            Assert.Equal(2, await ConstraintCountAsync(connection));
        }

        await DropDatabaseAsync(adminConnection, name);
    }
}
