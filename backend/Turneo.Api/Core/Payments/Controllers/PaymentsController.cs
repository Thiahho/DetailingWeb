using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MercadoPago.Client.Preference;
using MercadoPago.Config;
using MercadoPago.Client.Payment;
using System.Security.Cryptography;
using System.Text;

namespace Turneo.Api.Core.Payments;

[ApiController]
[Route("api/[controller]")]
public class PaymentsController : ControllerBase
{
    private readonly IPaymentsRepository _repository;
    private readonly IConfiguration _configuration;
    private readonly IPlanLimitsService _planLimits;

    public PaymentsController(IPaymentsRepository repository, IConfiguration configuration, IPlanLimitsService planLimits)
    {
        _repository = repository;
        _configuration = configuration;
        _planLimits = planLimits;
    }

    // POST: api/payments/create-preference
    [HttpPost("create-preference")]
    [AllowAnonymous]
    [EnableRateLimiting("public-booking")]
    public async Task<IActionResult> CreateMercadoPagoPreference([FromBody] CreatePaymentRequest request)
    {
        var booking = await _repository.GetBookingWithPaymentAsync(request.BookingId);

        if (booking == null)
            return NotFound(new { success = false, message = "Reserva no encontrada" });

        if (booking.Status == BookingStatus.Cancelled)
            return BadRequest(new { success = false, message = "No se puede pagar una reserva cancelada" });

        // If there's already an approved payment, don't create another
        if (booking.Payment?.Status == PaymentStatus.Approved)
            return BadRequest(new { success = false, message = "Esta reserva ya fue pagada" });

        // Tenant explícito (booking.TenantId), no ambiental: el endpoint es
        // [AllowAnonymous], más seguro resolver el plan por el dato en sí.
        if (!await _planLimits.IsFeatureEnabledAsync(booking.TenantId, "CanUseMercadoPago"))
            return StatusCode(StatusCodes.Status402PaymentRequired, new { success = false, message = "Este negocio no tiene pagos online habilitados en su plan actual" });

        var accessToken = _configuration["MercadoPago:AccessToken"];
        if (string.IsNullOrEmpty(accessToken))
            return StatusCode(500, new { success = false, message = "Pasarela de pago no configurada" });

        MercadoPagoConfig.AccessToken = accessToken;

        // Parse service price
        var service = await _repository.GetServiceBySlugAsync(booking.Service);
        decimal amount;
        if (request.Amount > 0)
        {
            amount = request.Amount;
        }
        else if (service != null && decimal.TryParse(service.Price.Replace(".", "").Replace(",", "."), out var parsed))
        {
            amount = parsed;
        }
        else
        {
            return BadRequest(new { success = false, message = "No se pudo determinar el monto a cobrar" });
        }

        var baseUrl = _configuration["MercadoPago:BaseUrl"] ?? "https://gestion-turnos-kappa.vercel.app/";

        var preferenceRequest = new PreferenceRequest
        {
            Items = new List<PreferenceItemRequest>
            {
                new PreferenceItemRequest
                {
                    Title = $"Reserva - {service?.Title ?? booking.Service ?? "Servicio"}",
                    Description = $"Turno: {booking.TimeSlot.StartDateTime:dd/MM/yyyy HH:mm}",
                    Quantity = 1,
                    CurrencyId = "ARS",
                    UnitPrice = amount
                }
            },
            Payer = new PreferencePayerRequest
            {
                Email = booking.Email ?? booking.CustomerEmailNormalized
            },
            BackUrls = new PreferenceBackUrlsRequest
            {
                Success = $"{baseUrl}/mis-turnos?payment=success&bookingId={booking.Id}",
                Failure = $"{baseUrl}/mis-turnos?payment=failure&bookingId={booking.Id}",
                Pending = $"{baseUrl}/mis-turnos?payment=pending&bookingId={booking.Id}"
            },
            AutoReturn = "approved",
            ExternalReference = booking.Id.ToString(),
            NotificationUrl = $"{_configuration["MercadoPago:WebhookUrl"] ?? $"{baseUrl}/api/payments/webhook/mercadopago"}"
        };

        try
        {
            var client = new PreferenceClient();
            var preference = await client.CreateAsync(preferenceRequest);

            // Create or update payment record
            var payment = booking.Payment ?? new Payment
            {
                BookingId = booking.Id,
                Provider = "MercadoPago"
            };

            payment.Amount = amount;
            payment.Currency = "ARS";
            payment.Status = PaymentStatus.Pending;
            payment.ExternalPreferenceId = preference.Id;
            payment.CheckoutUrl = preference.InitPoint;
            payment.PayerEmail = booking.Email ?? booking.CustomerEmailNormalized;

            if (booking.Payment == null)
                _repository.AddPayment(payment);

            await _repository.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                preferenceId = preference.Id,
                checkoutUrl = preference.InitPoint,
                sandboxCheckoutUrl = preference.SandboxInitPoint,
                paymentId = payment.Id
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[MercadoPago] Error al crear preferencia: {ex.Message}");
            return StatusCode(500, new { success = false, message = "Error al crear preferencia de pago" });
        }
    }

    // POST: api/payments/webhook/mercadopago
    [HttpPost("webhook/mercadopago")]
    [AllowAnonymous]
    [EnableRateLimiting("payments-webhook")]
    [TenantContextBypass]
    public async Task<IActionResult> MercadoPagoWebhook()
    {
        var accessToken = _configuration["MP_ACCESS_TOKEN:AccessToken"];
        if (string.IsNullOrEmpty(accessToken))
            return StatusCode(500);

        MercadoPagoConfig.AccessToken = accessToken;

        // Read body first (needed for signature validation)
        string body;
        using (var reader = new StreamReader(Request.Body))
            body = await reader.ReadToEndAsync();

        // Validate webhook signature (HMAC-SHA256) if secret is configured
        var webhookSecret = _configuration["MercadoPago:WebhookSecret"];
        if (!string.IsNullOrEmpty(webhookSecret))
        {
            var xSignature = Request.Headers["x-signature"].ToString();
            var xRequestId = Request.Headers["x-request-id"].ToString();
            var sigDataId = Request.Query["data.id"].ToString();

            if (string.IsNullOrEmpty(xSignature))
                return Unauthorized(new { message = "Missing signature" });

            // Extract ts and v1 from x-signature header: "ts=...,v1=..."
            string? ts = null, v1 = null;
            foreach (var part in xSignature.Split(','))
            {
                var kv = part.Trim().Split('=', 2);
                if (kv.Length == 2)
                {
                    if (kv[0] == "ts") ts = kv[1];
                    else if (kv[0] == "v1") v1 = kv[1];
                }
            }

            if (ts == null || v1 == null)
                return Unauthorized(new { message = "Invalid signature format" });

            var manifest = $"id:{sigDataId};request-id:{xRequestId};ts:{ts};";
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(webhookSecret));
            var computed = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(manifest))).ToLower();

            if (!CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(computed),
                Encoding.UTF8.GetBytes(v1.ToLower())))
            {
                Console.WriteLine("[MP Webhook] Firma inválida — posible solicitud falsa");
                return Unauthorized(new { message = "Invalid signature" });
            }
        }

        // Read query params (MP sends type and data.id)
        var type = Request.Query["type"].ToString();
        var dataIdParam = Request.Query["data.id"].ToString();

        // Also try reading from body for newer webhook format
        if (string.IsNullOrEmpty(type) || string.IsNullOrEmpty(dataIdParam))
        {
            try
            {
                if (!string.IsNullOrEmpty(body))
                {
                    var json = System.Text.Json.JsonDocument.Parse(body);
                    type = json.RootElement.TryGetProperty("type", out var t) ? t.GetString() ?? "" : type;
                    if (json.RootElement.TryGetProperty("data", out var data) && data.TryGetProperty("id", out var id))
                        dataIdParam = id.ToString();
                }
            }
            catch { /* ignore parse errors */ }
        }

        if (type != "payment" || string.IsNullOrEmpty(dataIdParam))
            return Ok(); // Acknowledge but ignore non-payment notifications

        var dataId = dataIdParam;

        try
        {
            var paymentClient = new PaymentClient();
            var mpPayment = await paymentClient.GetAsync(long.Parse(dataId));

            if (mpPayment == null)
                return Ok();

            var bookingId = int.TryParse(mpPayment.ExternalReference, out var bid) ? bid : 0;
            if (bookingId == 0)
                return Ok();

            // IgnoreQueryFilters: MercadoPago llama a este webhook directo, sin pasar
            // por el proxy del frontend — no hay tenant ambiental resuelto acá. El
            // bookingId (via ExternalReference) ya identifica un tenant sin ambigüedad.
            var payment = await _repository.GetPaymentByBookingIgnoringTenantAsync(bookingId);

            if (payment == null)
            {
                var booking = await _repository.GetBookingByIdIgnoringTenantAsync(bookingId);
                if (booking == null)
                    return Ok();

                // Create payment record if webhook arrives before preference response was saved
                payment = new Payment
                {
                    TenantId = booking.TenantId,
                    BookingId = bookingId,
                    Provider = "MercadoPago",
                    Amount = mpPayment.TransactionAmount ?? 0
                };
                _repository.AddPayment(payment);
            }

            payment.ExternalPaymentId = mpPayment.Id?.ToString();
            payment.PaymentMethod = mpPayment.PaymentMethodId;
            payment.PayerEmail = mpPayment.Payer?.Email;

            switch (mpPayment.Status)
            {
                case "approved":
                    payment.Status = PaymentStatus.Approved;
                    payment.PaidAt = DateTime.UtcNow;
                    // Auto-confirm the booking when payment is approved
                    if (payment.Booking != null && payment.Booking.Status == BookingStatus.Pending)
                    {
                        payment.Booking.Status = BookingStatus.Confirmed;
                    }
                    break;
                case "rejected":
                case "cancelled":
                    payment.Status = PaymentStatus.Rejected;
                    break;
                case "refunded":
                    payment.Status = PaymentStatus.Refunded;
                    payment.RefundedAt = DateTime.UtcNow;
                    break;
                case "in_process":
                case "pending":
                    payment.Status = PaymentStatus.Pending;
                    break;
            }

            await _repository.SaveChangesAsync();
            return Ok();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[MercadoPago Webhook] Error: {ex.Message}");
            return Ok(); // Always return 200 to prevent MP from retrying excessively
        }
    }

    // GET: api/payments/{bookingId}
    [HttpGet("{bookingId}")]
    [AllowAnonymous]
    [EnableRateLimiting("public-booking")]
    public async Task<IActionResult> GetPaymentByBooking(int bookingId)
    {
        var payment = await _repository.GetPaymentByBookingAsync(bookingId);

        if (payment == null)
            return NotFound(new { success = false, message = "No hay pago registrado para esta reserva" });

        return Ok(new
        {
            id = payment.Id,
            bookingId = payment.BookingId,
            amount = payment.Amount,
            currency = payment.Currency,
            status = payment.Status,
            provider = payment.Provider,
            paymentMethod = payment.PaymentMethod,
            checkoutUrl = payment.CheckoutUrl,
            paidAt = payment.PaidAt,
            createdAt = payment.CreatedAt
        });
    }

    // GET: api/payments (admin - all payments)
    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAllPayments()
    {
        var payments = await _repository.GetAllWithBookingAsync();
        return Ok(payments);
    }
}

// DTOs
public class CreatePaymentRequest
{
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.Range(1, int.MaxValue, ErrorMessage = "BookingId inválido")]
    public int BookingId { get; set; }

    [System.ComponentModel.DataAnnotations.Range(0, 9_999_999, ErrorMessage = "Monto inválido")]
    public decimal Amount { get; set; }
}
