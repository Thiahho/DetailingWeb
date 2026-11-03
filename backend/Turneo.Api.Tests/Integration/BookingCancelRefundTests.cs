using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Turneo.Api.Core.Caja;

namespace Turneo.Api.Tests.Integration;

// Paid bookings (approved payment) cannot be cancelled by the client online:
// the public cancel is rejected with a WhatsApp hint. The Admin cancels them via
// POST /api/bookings/{id}/admin-cancel-refund, which in one transaction cancels
// the booking, marks the payment Refunded and records a Caja "Refund" movement.
[Collection("Integration")]
public class BookingCancelRefundTests
{
    private const string PaidPublicCancelMessage = "Esta reserva ya está pagada. Escribinos por WhatsApp para cancelarla";
    private readonly CustomWebApplicationFactory _factory;

    public BookingCancelRefundTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<Booking> CreateBookingAsync(int tenantId)
    {
        var start = DateTime.UtcNow.AddDays(20).AddMinutes(Random.Shared.Next(1, 100_000));
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, start, start.AddHours(1));
        await TestDataFactory.SetTimeSlotAvailabilityAsync(_factory, slot.Id, isAvailable: false);
        return await TestDataFactory.CreateBookingAsync(_factory, tenantId, slot.Id, "Cliente Pagado", $"refund-{Guid.NewGuid():N}@test.com");
    }

    private async Task<(int TenantId, HttpClient Admin)> NewTenantWithAdminAsync(bool openCaja = true)
    {
        var tenant = await TestDataFactory.CreateTenantAsync(_factory, $"refund-{Guid.NewGuid():N}", "Negocio Refund");
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenant.Id, $"admin-refund-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenant.Id));
        if (openCaja)
            Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/caja/open", new { openingCashBalance = 0 })).StatusCode);
        return (tenant.Id, client);
    }

    private static Task<HttpResponseMessage> AdminCancelRefundAsync(HttpClient client, int bookingId, object body) =>
        client.PostAsJsonAsync($"/api/bookings/{bookingId}/admin-cancel-refund", body);

    private async Task<List<CajaMovement>> GetMovementsAsync(int bookingId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.CajaMovements.IgnoreQueryFilters().Where(m => m.BookingId == bookingId).ToListAsync();
    }

    private async Task AssertUnchangedAsync(int bookingId, string expectedPaymentStatus)
    {
        var booking = await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, bookingId);
        Assert.NotEqual(BookingStatus.Cancelled, booking!.Status);
        Assert.Null(booking.CancelledAt);
        var slot = await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, booking.TimeSlotId);
        Assert.False(slot!.IsAvailable);
        var payment = await TestDataFactory.GetPaymentByBookingIgnoringTenantAsync(_factory, bookingId);
        if (payment is not null)
            Assert.Equal(expectedPaymentStatus, payment.Status);
        Assert.Empty(await GetMovementsAsync(bookingId));
    }

    private static async Task<string?> MessageAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.TryGetProperty("message", out var message) ? message.GetString() : null;
    }

    // ---- Public cancel ----

    [Fact]
    public async Task PublicCancel_PaidBooking_IsRejectedWithWhatsAppHintAndChangesNothing()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var booking = await CreateBookingAsync(tenantId);
        await TestDataFactory.CreatePaymentAsync(_factory, tenantId, booking.Id, 2000m, PaymentStatus.Approved);

        var response = await _factory.CreateClient().PostAsync($"/api/bookings/{booking.Id}/cancel", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(PaidPublicCancelMessage, await MessageAsync(response));
        await AssertUnchangedAsync(booking.Id, PaymentStatus.Approved);
    }

    [Fact]
    public async Task PublicCancel_BookingWithPendingPayment_StillCancels()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var booking = await CreateBookingAsync(tenantId);
        await TestDataFactory.CreatePaymentAsync(_factory, tenantId, booking.Id, 2000m, PaymentStatus.Pending);

        var response = await _factory.CreateClient().PostAsync($"/api/bookings/{booking.Id}/cancel", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var reloaded = await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(BookingStatus.Cancelled, reloaded!.Status);
        Assert.True((await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, reloaded.TimeSlotId))!.IsAvailable);
    }

    // ---- Admin cancel + refund ----

    [Fact]
    public async Task AdminCancelRefund_DefaultsToFullAmount_CancelsBookingRefundsPaymentAndRecordsCajaRefund()
    {
        var (tenantId, admin) = await NewTenantWithAdminAsync();
        var booking = await CreateBookingAsync(tenantId);
        await TestDataFactory.CreatePaymentAsync(_factory, tenantId, booking.Id, 2500m, PaymentStatus.Approved);

        var response = await AdminCancelRefundAsync(admin, booking.Id, new { method = "Transfer", note = "Cliente avisó por WhatsApp" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("success").GetBoolean());
        Assert.Equal(2500m, body.GetProperty("refund").GetProperty("amount").GetDecimal());
        Assert.Equal(PaymentStatus.Refunded, body.GetProperty("payment").GetProperty("status").GetString());
        Assert.NotEqual(JsonValueKind.Null, body.GetProperty("payment").GetProperty("refundedAt").ValueKind);

        var reloaded = await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(BookingStatus.Cancelled, reloaded!.Status);
        Assert.NotNull(reloaded.CancelledAt);
        Assert.True((await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, reloaded.TimeSlotId))!.IsAvailable);

        var payment = await TestDataFactory.GetPaymentByBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(PaymentStatus.Refunded, payment!.Status);
        Assert.NotNull(payment.RefundedAt);

        var movement = Assert.Single(await GetMovementsAsync(booking.Id));
        Assert.Equal(CajaMovementType.Refund, movement.Type);
        Assert.Equal(CajaMovementMethod.Transfer, movement.Method);
        Assert.Equal(2500m, movement.Amount);
        Assert.Equal(tenantId, movement.TenantId);
        Assert.Null(movement.RefundOfMovementId);
        Assert.Equal("Cliente avisó por WhatsApp", movement.Description);
        Assert.Equal(body.GetProperty("refund").GetProperty("cajaMovementId").GetInt32(), movement.Id);
    }

    [Fact]
    public async Task AdminCancelRefund_PartialAmount_RecordsMovementWithThatAmount()
    {
        var (tenantId, admin) = await NewTenantWithAdminAsync();
        var booking = await CreateBookingAsync(tenantId);
        await TestDataFactory.CreatePaymentAsync(_factory, tenantId, booking.Id, 2500m, PaymentStatus.Approved);

        var response = await AdminCancelRefundAsync(admin, booking.Id, new { amount = 1000m, method = "Cash" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var movement = Assert.Single(await GetMovementsAsync(booking.Id));
        Assert.Equal(1000m, movement.Amount);
        Assert.Equal(CajaMovementMethod.Cash, movement.Method);
        Assert.False(string.IsNullOrWhiteSpace(movement.Description));
        Assert.Equal(PaymentStatus.Refunded, (await TestDataFactory.GetPaymentByBookingIgnoringTenantAsync(_factory, booking.Id))!.Status);
        Assert.Equal(BookingStatus.Cancelled, (await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id))!.Status);
    }

    [Theory]
    [InlineData(2500.01)]
    [InlineData(0)]
    [InlineData(-10)]
    public async Task AdminCancelRefund_InvalidAmount_IsRejectedAndChangesNothing(double amount)
    {
        var (tenantId, admin) = await NewTenantWithAdminAsync();
        var booking = await CreateBookingAsync(tenantId);
        await TestDataFactory.CreatePaymentAsync(_factory, tenantId, booking.Id, 2500m, PaymentStatus.Approved);

        var response = await AdminCancelRefundAsync(admin, booking.Id, new { amount = (decimal)amount, method = "Cash" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertUnchangedAsync(booking.Id, PaymentStatus.Approved);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(PaymentStatus.Pending)]
    [InlineData(PaymentStatus.Rejected)]
    public async Task AdminCancelRefund_WithoutApprovedPayment_IsRejected(string? paymentStatus)
    {
        var (tenantId, admin) = await NewTenantWithAdminAsync();
        var booking = await CreateBookingAsync(tenantId);
        if (paymentStatus is not null)
            await TestDataFactory.CreatePaymentAsync(_factory, tenantId, booking.Id, 2500m, paymentStatus);

        var response = await AdminCancelRefundAsync(admin, booking.Id, new { method = "Cash" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("Esta reserva no tiene un pago aprobado para devolver", await MessageAsync(response));
        await AssertUnchangedAsync(booking.Id, paymentStatus ?? string.Empty);
    }

    [Fact]
    public async Task AdminCancelRefund_AlreadyRefundedPayment_IsRejected()
    {
        var (tenantId, admin) = await NewTenantWithAdminAsync();
        var booking = await CreateBookingAsync(tenantId);
        await TestDataFactory.CreatePaymentAsync(_factory, tenantId, booking.Id, 2500m, PaymentStatus.Refunded);

        var response = await AdminCancelRefundAsync(admin, booking.Id, new { method = "Cash" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("El pago de esta reserva ya fue devuelto", await MessageAsync(response));
        await AssertUnchangedAsync(booking.Id, PaymentStatus.Refunded);
    }

    [Fact]
    public async Task AdminCancelRefund_SecondCallAfterSuccess_IsRejectedAndRecordsNoSecondMovement()
    {
        var (tenantId, admin) = await NewTenantWithAdminAsync();
        var booking = await CreateBookingAsync(tenantId);
        await TestDataFactory.CreatePaymentAsync(_factory, tenantId, booking.Id, 2500m, PaymentStatus.Approved);
        Assert.Equal(HttpStatusCode.OK, (await AdminCancelRefundAsync(admin, booking.Id, new { method = "Cash" })).StatusCode);

        var second = await AdminCancelRefundAsync(admin, booking.Id, new { method = "Cash" });

        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
        Assert.Single(await GetMovementsAsync(booking.Id));
    }

    [Fact]
    public async Task AdminCancelRefund_AlreadyCancelledBooking_IsRejected()
    {
        var (tenantId, admin) = await NewTenantWithAdminAsync();
        var start = DateTime.UtcNow.AddDays(20).AddMinutes(Random.Shared.Next(1, 100_000));
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, start, start.AddHours(1));
        var booking = await TestDataFactory.CreateBookingAsync(_factory, tenantId, slot.Id, "Cancelado", $"refund-{Guid.NewGuid():N}@test.com", BookingStatus.Cancelled);
        await TestDataFactory.CreatePaymentAsync(_factory, tenantId, booking.Id, 2500m, PaymentStatus.Approved);

        var response = await AdminCancelRefundAsync(admin, booking.Id, new { method = "Cash" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("Este turno ya fue cancelado", await MessageAsync(response));
        Assert.Equal(PaymentStatus.Approved, (await TestDataFactory.GetPaymentByBookingIgnoringTenantAsync(_factory, booking.Id))!.Status);
        Assert.Empty(await GetMovementsAsync(booking.Id));
    }

    [Fact]
    public async Task AdminCancelRefund_WithoutOpenCajaSession_IsRejectedAndChangesNothing()
    {
        var (tenantId, admin) = await NewTenantWithAdminAsync(openCaja: false);
        var booking = await CreateBookingAsync(tenantId);
        await TestDataFactory.CreatePaymentAsync(_factory, tenantId, booking.Id, 2500m, PaymentStatus.Approved);

        var response = await AdminCancelRefundAsync(admin, booking.Id, new { method = "Cash" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("No hay ninguna caja abierta", await MessageAsync(response));
        await AssertUnchangedAsync(booking.Id, PaymentStatus.Approved);
    }

    [Fact]
    public async Task AdminCancelRefund_MissingOrInvalidMethod_IsRejected()
    {
        var (tenantId, admin) = await NewTenantWithAdminAsync();
        var booking = await CreateBookingAsync(tenantId);
        await TestDataFactory.CreatePaymentAsync(_factory, tenantId, booking.Id, 2500m, PaymentStatus.Approved);

        Assert.Equal(HttpStatusCode.BadRequest, (await AdminCancelRefundAsync(admin, booking.Id, new { })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await AdminCancelRefundAsync(admin, booking.Id, new { method = "MercadoPago" })).StatusCode);
        await AssertUnchangedAsync(booking.Id, PaymentStatus.Approved);
    }

    [Fact]
    public async Task AdminCancelRefund_StaffUser_IsForbidden()
    {
        var (tenantId, _) = await NewTenantWithAdminAsync();
        var booking = await CreateBookingAsync(tenantId);
        await TestDataFactory.CreatePaymentAsync(_factory, tenantId, booking.Id, 2500m, PaymentStatus.Approved);
        var staff = await TestDataFactory.CreateStaffUserAsync(_factory, tenantId, $"staff-refund-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, staff.Id, staff.Email, "Staff", tenantId));

        var response = await AdminCancelRefundAsync(client, booking.Id, new { method = "Cash" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await AssertUnchangedAsync(booking.Id, PaymentStatus.Approved);
    }

    [Fact]
    public async Task AdminCancelRefund_Anonymous_IsUnauthorized()
    {
        var (tenantId, _) = await NewTenantWithAdminAsync();
        var booking = await CreateBookingAsync(tenantId);
        await TestDataFactory.CreatePaymentAsync(_factory, tenantId, booking.Id, 2500m, PaymentStatus.Approved);

        var response = await AdminCancelRefundAsync(_factory.CreateClient(), booking.Id, new { method = "Cash" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        await AssertUnchangedAsync(booking.Id, PaymentStatus.Approved);
    }

    [Fact]
    public async Task AdminCancelRefund_BookingOfAnotherTenant_ReturnsNotFoundAndChangesNothing()
    {
        var (tenantA, _) = await NewTenantWithAdminAsync();
        var booking = await CreateBookingAsync(tenantA);
        await TestDataFactory.CreatePaymentAsync(_factory, tenantA, booking.Id, 2500m, PaymentStatus.Approved);
        var (_, adminB) = await NewTenantWithAdminAsync();

        var response = await AdminCancelRefundAsync(adminB, booking.Id, new { method = "Cash" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        await AssertUnchangedAsync(booking.Id, PaymentStatus.Approved);
    }

    // Two simultaneous submits on separate clients: the conditional Approved ->
    // Refunded update lets exactly one through, so only one refund is recorded.
    [Fact]
    public async Task AdminCancelRefund_ConcurrentRequests_OnlyOneSucceedsAndOneMovementIsRecorded()
    {
        var (tenantId, admin) = await NewTenantWithAdminAsync();
        var booking = await CreateBookingAsync(tenantId);
        await TestDataFactory.CreatePaymentAsync(_factory, tenantId, booking.Id, 2500m, PaymentStatus.Approved);
        var adminUser = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin2-refund-{Guid.NewGuid():N}@test.com", "Password123");
        var secondAdmin = _factory.CreateClient();
        secondAdmin.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, adminUser.Id, adminUser.Email, "Admin", tenantId));

        var responses = await Task.WhenAll(
            AdminCancelRefundAsync(admin, booking.Id, new { method = "Cash" }),
            AdminCancelRefundAsync(secondAdmin, booking.Id, new { method = "Cash" }));

        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.BadRequest);
        var movement = Assert.Single(await GetMovementsAsync(booking.Id));
        Assert.Equal(2500m, movement.Amount);
        Assert.Equal(PaymentStatus.Refunded, (await TestDataFactory.GetPaymentByBookingIgnoringTenantAsync(_factory, booking.Id))!.Status);
        Assert.Equal(BookingStatus.Cancelled, (await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id))!.Status);
    }

    // Deterministic counterpart of the concurrency test: the guard itself only
    // succeeds once, and respects the tenant query filter.
    [Fact]
    public async Task TryMarkPaymentRefunded_SucceedsOnceThenFails_AndIgnoresOtherTenants()
    {
        var (tenantId, _) = await NewTenantWithAdminAsync(openCaja: false);
        var booking = await CreateBookingAsync(tenantId);
        var payment = await TestDataFactory.CreatePaymentAsync(_factory, tenantId, booking.Id, 2500m, PaymentStatus.Approved);
        var otherTenant = await TestDataFactory.CreateTenantAsync(_factory, $"refund-other-{Guid.NewGuid():N}", "Otro");

        using (var otherScope = _factory.Services.CreateScope())
        {
            otherScope.ServiceProvider.GetRequiredService<CurrentTenantService>().SetTenant(otherTenant.Id);
            var otherRepository = new BookingsRepository(otherScope.ServiceProvider.GetRequiredService<ApplicationDbContext>());
            Assert.False(await otherRepository.TryMarkPaymentRefundedAsync(payment.Id, DateTime.UtcNow));
        }
        Assert.Equal(PaymentStatus.Approved, (await TestDataFactory.GetPaymentByBookingIgnoringTenantAsync(_factory, booking.Id))!.Status);

        using var scope = _factory.Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<CurrentTenantService>().SetTenant(tenantId);
        var repository = new BookingsRepository(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>());

        Assert.True(await repository.TryMarkPaymentRefundedAsync(payment.Id, DateTime.UtcNow));
        Assert.False(await repository.TryMarkPaymentRefundedAsync(payment.Id, DateTime.UtcNow));
        var reloaded = await TestDataFactory.GetPaymentByBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(PaymentStatus.Refunded, reloaded!.Status);
        Assert.NotNull(reloaded.RefundedAt);
    }

    // Forces the Caja insert to fail at the database (a temporary trigger that
    // only fires for this test's marker description) and checks that the
    // booking cancellation and payment refund were rolled back with it.
    [Fact]
    public async Task AdminCancelRefund_WhenCajaInsertFails_NothingIsSaved()
    {
        var (tenantId, admin) = await NewTenantWithAdminAsync();
        var booking = await CreateBookingAsync(tenantId);
        await TestDataFactory.CreatePaymentAsync(_factory, tenantId, booking.Id, 2500m, PaymentStatus.Approved);
        var marker = $"fail-{Guid.NewGuid():N}";
        var function = $"t2d_fail_{Guid.NewGuid():N}";

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.Database.ExecuteSqlRawAsync($@"
                CREATE FUNCTION {function}() RETURNS trigger AS $$
                BEGIN
                    IF NEW.""Description"" = '{marker}' THEN
                        RAISE EXCEPTION 'forced caja failure';
                    END IF;
                    RETURN NEW;
                END; $$ LANGUAGE plpgsql;
                CREATE TRIGGER {function} BEFORE INSERT ON ""CajaMovements""
                    FOR EACH ROW EXECUTE FUNCTION {function}();");
        }

        try
        {
            // Depending on the host environment the failure surfaces either as a
            // 500 response or as the exception rethrown by TestServer; both are fine.
            HttpResponseMessage? response = null;
            try
            {
                response = await AdminCancelRefundAsync(admin, booking.Id, new { method = "Cash", note = marker });
            }
            catch (Exception ex) when (ex.ToString().Contains("forced caja failure"))
            {
            }

            if (response is not null)
                Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
            await AssertUnchangedAsync(booking.Id, PaymentStatus.Approved);
        }
        finally
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.Database.ExecuteSqlRawAsync($@"
                DROP TRIGGER IF EXISTS {function} ON ""CajaMovements"";
                DROP FUNCTION IF EXISTS {function}();");
        }
    }
}
