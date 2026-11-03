# MercadoPago webhook hardening

## Objective
Close two payment defects found while reviewing the MercadoPago webhook, before `Payments:Enabled` is turned on in production.

## Problem
1. `create-preference` uses the client-supplied `request.Amount` when the booking has no `FinalPrice`, so an anonymous caller can choose the charged amount. The webhook then approves and confirms the booking without comparing `TransactionAmount`/currency to the expected amount.
2. The webhook `catch` always returns 200, so transient failures (DB, MercadoPago API) lose the notification: MercadoPago never retries and a paid booking stays Pending.

## Scope
- `backend/Turneo.Api/Core/Payments/**`, DI registration in `Program.cs`, payments tests.
- Out of scope: minor findings (charged_back/authorized states, missing x-request-id manifest, ILogger migration, payment created before booking include).

## Acceptance criteria
- The charged amount is decided only by the server (`FinalPrice`, else service price); `request.Amount` is ignored.
- The webhook only marks Approved/confirms the booking when `TransactionAmount >= payment.Amount` and currency is ARS; otherwise it leaves the payment Pending and logs a warning.
- Transient failures in the webhook return 500 so MercadoPago retries; non-applicable notifications still return 200.
- Tests cover each behavior.

## Tasks
- [x] T1 — Server-side amount resolution in `create-preference` + tests. Route: delegated (writer trigger: 2+ non-trivial files).
- [x] T2 — Webhook amount/currency check and transient-failure 500, via an injectable MercadoPago payment gateway seam + tests. Route: delegated (same writer).

## Checks
- `dotnet test backend/Turneo.Api.Tests --filter "FullyQualifiedName~Payments"`
- `dotnet build backend`

## Progress
- Created 2026-11-03.
- 2026-11-03: T1+T2 implemented by delegated writer (PaymentAmountResolver, IMercadoPagoPaymentGateway seam, webhook amount/currency check, 500 on transient failure). Build OK; 9 unit tests GREEN. 16 integration tests NOT RUN: Docker down (Testcontainers). RED observed only as compile failure. Not committed yet.
- Follow-up noted: when the webhook creates the Payment itself, Amount = TransactionAmount, so only the currency check applies there.

- 2026-11-03: Docker up. Payments filter: 25/25 passed. Full suite: 229/235; the 6 failures (4 PromotionsEndpointsTests, 2 BookingsEndpointsTests that only fail in the full run) fail identically on the base without these changes — pre-existing, out of scope.

- Commit 7d46ccf3 (T1+T2). Review assess: high (payments hot path); user declined native review for this candidate.

- [x] T3 — Webhook-created Payment uses PaymentAmountResolver for the expected amount (service looked up with explicit tenant), links the Booking so approval confirms it, and an unknown expected amount (0) is never approved. Route: inline (small, understood change). RED observed: 2 of 3 new tests failed ("Approved" instead of "Pending"); GREEN: payments filter 28/28; full suite 232/238 with the same 6 pre-existing failures.

## Next step
Investigate the 6 pre-existing test failures separately.
