using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Turneo.Api.Core.Caja;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Staff,Professional")]
public class CajaController : ControllerBase
{
    private readonly ICajaRepository _repository;

    public CajaController(ICajaRepository repository)
    {
        _repository = repository;
    }

    private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    private static (decimal expectedCash, CajaTotals totals) ComputeTotals(CajaSession session)
    {
        decimal cashIn = 0, cashOut = 0, transferTotal = 0, chargeTotal = 0, depositTotal = 0, refundTotal = 0, manualTotal = 0;

        foreach (var m in session.Movements)
        {
            var signedAmount = m.Type is CajaMovementType.Refund or CajaMovementType.ManualOut ? -m.Amount : m.Amount;

            if (m.Method == CajaMovementMethod.Cash)
            {
                if (signedAmount >= 0) cashIn += signedAmount; else cashOut += -signedAmount;
            }
            else if (m.Method == CajaMovementMethod.Transfer)
            {
                transferTotal += signedAmount;
            }

            switch (m.Type)
            {
                case CajaMovementType.Charge: chargeTotal += m.Amount; break;
                case CajaMovementType.Deposit: depositTotal += m.Amount; break;
                case CajaMovementType.Refund: refundTotal += m.Amount; break;
                case CajaMovementType.ManualIn: manualTotal += m.Amount; break;
                case CajaMovementType.ManualOut: manualTotal -= m.Amount; break;
            }
        }

        var expectedCash = session.OpeningCashBalance + cashIn - cashOut;
        return (expectedCash, new CajaTotals(chargeTotal, depositTotal, refundTotal, transferTotal, manualTotal));
    }

    // GET: api/caja/current (admin - sesión de caja abierta, si hay)
    [HttpGet("current")]
    [RequirePermission(PermissionModules.Caja, PermissionActions.View, alsoCheckProfessional: true)]
    public async Task<IActionResult> GetCurrent()
    {
        var session = await _repository.GetOpenSessionAsync();
        if (session == null)
            return Ok(new { open = false });

        var (expectedCash, totals) = ComputeTotals(session);

        return Ok(new
        {
            open = true,
            id = session.Id,
            openedAt = session.OpenedAt,
            openingCashBalance = session.OpeningCashBalance,
            expectedCash,
            totals,
            movements = session.Movements.OrderByDescending(m => m.CreatedAt).Select(MapMovement)
        });
    }

    // POST: api/caja/open (admin)
    [HttpPost("open")]
    [RequirePermission(PermissionModules.Caja, PermissionActions.Create, alsoCheckProfessional: true)]
    public async Task<IActionResult> OpenSession([FromBody] OpenCajaSessionRequest request)
    {
        var existing = await _repository.GetOpenSessionAsync();
        if (existing != null)
            return BadRequest(new { success = false, message = "Ya hay una caja abierta" });

        var session = new CajaSession
        {
            OpenedByUserId = CurrentUserId,
            OpeningCashBalance = request.OpeningCashBalance
        };

        _repository.AddSession(session);
        await _repository.SaveChangesAsync();

        return Ok(new { success = true, id = session.Id, openedAt = session.OpenedAt });
    }

    // POST: api/caja/close (admin)
    [HttpPost("close")]
    [RequirePermission(PermissionModules.Caja, PermissionActions.Edit, alsoCheckProfessional: true)]
    public async Task<IActionResult> CloseSession([FromBody] CloseCajaSessionRequest request)
    {
        var session = await _repository.GetOpenSessionAsync();
        if (session == null)
            return BadRequest(new { success = false, message = "No hay ninguna caja abierta" });

        var (expectedCash, _) = ComputeTotals(session);

        session.Status = CajaSessionStatus.Closed;
        session.ClosedAt = DateTime.UtcNow;
        session.ClosedByUserId = CurrentUserId;
        session.ClosingCashCounted = request.ClosingCashCounted;
        session.Notes = request.Notes;

        await _repository.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            expectedCash,
            closingCashCounted = request.ClosingCashCounted,
            difference = request.ClosingCashCounted - expectedCash
        });
    }

    // POST: api/caja/movements (admin - cobro/seña/devolución/movimiento manual)
    [HttpPost("movements")]
    [RequirePermission(PermissionModules.Caja, PermissionActions.Create, alsoCheckProfessional: true)]
    public async Task<IActionResult> CreateMovement([FromBody] CreateCajaMovementRequest request)
    {
        var session = await _repository.GetOpenSessionAsync();
        if (session == null)
            return BadRequest(new { success = false, message = "No hay ninguna caja abierta" });

        var movement = new CajaMovement
        {
            CajaSessionId = session.Id,
            Type = request.Type,
            Method = request.Method,
            Amount = request.Amount,
            BookingId = request.BookingId,
            RefundOfMovementId = request.RefundOfMovementId,
            Description = request.Description,
            CreatedByUserId = CurrentUserId
        };

        _repository.AddMovement(movement);
        await _repository.SaveChangesAsync();

        return Ok(new { success = true, id = movement.Id });
    }

    // GET: api/caja/sessions?year=&month= (admin - caja mensual, solo lectura)
    [HttpGet("sessions")]
    [RequirePermission(PermissionModules.Caja, PermissionActions.View, alsoCheckProfessional: true)]
    public async Task<IActionResult> GetSessionsInMonth([FromQuery] int year, [FromQuery] int month)
    {
        if (month is < 1 or > 12)
            return BadRequest(new { message = "Mes inválido" });

        var from = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var to = from.AddMonths(1);

        var sessions = await _repository.GetClosedSessionsInRangeAsync(from, to);
        var mercadoPagoTotal = await _repository.GetApprovedMercadoPagoTotalInRangeAsync(from, to);

        var sessionSummaries = sessions.Select(s =>
        {
            var (expectedCash, totals) = ComputeTotals(s);
            return new
            {
                s.Id,
                s.OpenedAt,
                s.ClosedAt,
                s.OpeningCashBalance,
                expectedCash,
                closingCashCounted = s.ClosingCashCounted,
                difference = (s.ClosingCashCounted ?? 0) - expectedCash,
                totals
            };
        }).ToList();

        return Ok(new
        {
            sessions = sessionSummaries,
            mercadoPagoTotal,
            totalCharges = sessionSummaries.Sum(s => s.totals.ChargeTotal),
            totalDeposits = sessionSummaries.Sum(s => s.totals.DepositTotal),
            totalRefunds = sessionSummaries.Sum(s => s.totals.RefundTotal),
            totalTransfers = sessionSummaries.Sum(s => s.totals.TransferTotal),
            totalDifference = sessionSummaries.Sum(s => s.difference)
        });
    }

    // GET: api/caja/pending-bookings (admin - turnos recientes con saldo pendiente de cobro)
    [HttpGet("pending-bookings")]
    [RequirePermission(PermissionModules.Caja, PermissionActions.View, alsoCheckProfessional: true)]
    public async Task<IActionResult> GetPendingBookings()
    {
        var since = DateTime.UtcNow.AddDays(-30);
        var bookings = await _repository.GetPendingChargeBookingsAsync(since);

        return Ok(bookings.Select(b => new
        {
            b.BookingId,
            b.CustomerName,
            b.Subject,
            b.StartDateTime,
            b.ItemsTotal,
            b.AlreadyCharged,
            balance = b.ItemsTotal - b.AlreadyCharged
        }));
    }

    private static object MapMovement(CajaMovement m) => new
    {
        m.Id,
        m.Type,
        m.Method,
        m.Amount,
        m.BookingId,
        m.RefundOfMovementId,
        m.Description,
        m.CreatedByUserId,
        m.CreatedAt
    };
}

public record CajaTotals(decimal ChargeTotal, decimal DepositTotal, decimal RefundTotal, decimal TransferTotal, decimal ManualTotal);

public class OpenCajaSessionRequest
{
    [Range(0, 99_999_999)]
    public decimal OpeningCashBalance { get; set; }
}

public class CloseCajaSessionRequest
{
    [Range(0, 99_999_999)]
    public decimal ClosingCashCounted { get; set; }

    [StringLength(1000)]
    public string? Notes { get; set; }
}

public class CreateCajaMovementRequest
{
    [Required, RegularExpression("^(Charge|Deposit|Refund|ManualIn|ManualOut)$")]
    public string Type { get; set; } = string.Empty;

    [Required, RegularExpression("^(Cash|Transfer)$")]
    public string Method { get; set; } = string.Empty;

    [Range(0.01, 9_999_999)]
    public decimal Amount { get; set; }

    public int? BookingId { get; set; }
    public int? RefundOfMovementId { get; set; }

    [StringLength(500)]
    public string? Description { get; set; }
}
