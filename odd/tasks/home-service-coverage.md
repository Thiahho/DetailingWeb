# Home service coverage

## Objective
Let a business offer services at the client's address (detailing, home services) with a coverage zone defined by a list of localities.

## Problem
- Turneo only models on-site services: there is no client address, no coverage zone and no travel time between bookings.
- `Modules/Automotive` exists but is empty; the only address in the domain is `Branch.Address`.
- AccFenix already has tested locality/address/Maps-link lookup (`web/lib/geo*.ts`, `web/app/api/geo/*`), but its geo proxies lack a rate limit (audit finding B2; Nominatim allows at most 1 req/s).

## Why
First vertical of the multi-niche platform (EMPRENDERS `guia-nichos/GUIA.md`, priority 1: services with booking). Reuses almost all of Turneo.

## Decisions
- Coverage is a list of localities (Georef), not a radius. Simpler for the business owner and reuses AccFenix geo.
- Generic module `Modules/HomeService`, not `Modules/Automotive`: addresses, zones and travel time apply to any home service. Automotive stays for vehicle-only data (later).
- Coverage check and surcharge are computed on the server; client-sent prices or zones are never trusted.

## Scope
- In: on-site/at-home service flag; per-tenant coverage localities with optional surcharge; client address on booking; server-side coverage check; fixed travel buffer between at-home bookings in slot calculation; geo lookup ported with rate limit; admin and booking screens; guide update.
- Out: quotes before booking, vehicle data, route optimization, radius-based coverage.

## Acceptance criteria
- A service can be marked on-site or at-home; existing services stay on-site.
- An admin can manage the tenant's coverage localities and an optional surcharge per locality; data is tenant-scoped.
- Booking an at-home service requires an address with a locality; a locality outside coverage is rejected by the server with a clear error.
- The final booking price includes the locality surcharge, computed on the server.
- Available slots for at-home services leave the configured travel buffer between consecutive at-home bookings of the same professional.
- Geo lookup endpoints are rate limited per client IP.
- Out-of-coverage clients see a WhatsApp contact option instead of booking.

## Tasks
- [x] T0 — Baseline: run full backend suite on the branch point and record result. Route: delegated (per-action test run). Result: 287/287 passed at `f2b57bb9` (Docker running, ~56 s with build).
- [x] T1 — Service location type (on-site/at-home) + tenant coverage localities with optional surcharge: model, migration, admin API, tests. Route: delegated (writer trigger: 2+ non-trivial files).
- [x] T2 — Client address on booking + server-side coverage check and surcharge in the final price + tests. Route: delegated (writer trigger).
- [x] T2b — Keep the home-service snapshot consistent when `UpdateBooking` changes the service (review follow-up, medium: switching AtHome/OnSite leaves address and surcharge out of sync). Decision (user, 2026-11-03): re-run the home-service policy on edit. Route: delegated (writer trigger: controller + policy + tests).
- [x] T2c — Block `UpdateBooking` when the booking is confirmed or has an approved payment (user decision 2026-11-03). Reschedule and status endpoints unchanged. Route: delegated (writer trigger: controller + tests).
- [x] T2d — Paid bookings cannot be cancelled by the client online (WhatsApp message instead); Admin cancels and registers the refund (payment marked Refunded + Caja "Refund" movement). User decision 2026-11-03, option A; automatic Mercado Pago refunds deferred. Route: delegated (writer trigger: bookings + payments + caja + tests).
- [x] T3 — Travel buffer between at-home bookings in slot calculation (`Core/Scheduling`) + tests. Decision (user, 2026-11-03): per-business setting, default 30 min, applied only between at-home bookings of the same professional. Route: delegated (writer trigger).
- [ ] T4 — Port AccFenix geo lookup (localities, addresses, Maps links) to the Turneo frontend with per-IP rate limit + tests. Route: delegated (writer trigger).
- [ ] T5 — Screens: admin coverage settings; address step in booking; out-of-coverage WhatsApp option. Route: delegated (writer trigger).
- [ ] T6 — Record day-1 scope for detailing and the locality decision in EMPRENDERS `guia-nichos/GUIA.md`. Route: inline (one passive doc).

## Checks
- `dotnet test backend/Turneo.Api.Tests`
- Frontend lint/tests/build for T4–T5 (exact commands confirmed in T4).

## Delivery
- Forecast: ~1,600 authored changed lines (above the ~400 budget). Strategy: `ask-on-risk`; chain strategy `feature-branch-chain` (user choice 2026-11-03): slice PRs merge into `feat/home-service-coverage`, which merges into `TurneoDV2-Belleza` once T5 is done.
- RDD: off for this clone (clone-local), so no native review.

## Progress
- 2026-11-03: Created. Branch `feat/home-service-coverage` from `TurneoDV2-Belleza` (`f2b57bb9`).

- 2026-11-03: T0 done, baseline 287/287 green. Suite output is Spanish-locale ("Superado", "Con error").

- 2026-11-03: T1 implemented (route: delegated writer, trigger: 2+ non-trivial files). `ServiceLocationType` (OnSite/AtHome) on `Service`; `Modules/HomeService/ServiceArea` with `CoverageLocality` + Admin-only CRUD at `api/home-service/coverage-localities`; migration `AddHomeServiceCoverage` (column default OnSite, new table with RLS policy). RED: 21/22 new tests failed (missing `locationType` key; 404 on the unmapped route). GREEN: 22/22 new tests; full suite 309/309. Review correction (one scoped pass): folder renamed `Coverage` → `ServiceArea` because `.gitignore` `coverage/` ignored it on Windows (`git check-ignore` now empty); unique-index violations (23505) on save map to the same 400 duplicate response via `TrySaveChangesAsync`; partial unique index `(TenantId, GeorefId) WHERE GeorefId IS NOT NULL`; migration regenerated as `20261103184203_AddHomeServiceCoverage` with RLS block kept. Added tests: case-only duplicate, 401/403 for PUT/DELETE, repository 23505 tests on real Postgres (mutation check: 2/3 fail without the 23505 filter), controller unit tests. Full suite 315/315; `dotnet build` OK (2 pre-existing warnings). Parent re-ran suite 315/315 and independent review (high risk tier, RDD off); review blocker fixed. Assessed tier: high; RDD off, so no native review. T1 commit: `a1d241d4`.

- 2026-11-03: T2 implemented, not yet committed (route: delegated writer, trigger: 2+ non-trivial files). `CreateBookingRequest.homeAddress` {street, details, notes, coverageLocalityId} is checked by `Modules/HomeService/BookingAddress/HomeServiceBookingPolicy` only when the booked service (slug) is AtHome, before the slot is claimed. Missing street, missing locality, too-long fields, and unknown/inactive/other-tenant localities each return 400 with a Spanish message. New snapshot columns on `Bookings`: HomeAddressStreet/Details/Notes, CoverageLocalityId/Name/Province, and HomeServiceSurcharge (0 when the locality has no surcharge; null means on site). `FinalPrice` still means the promotion price only. `PaymentAmountResolver` charges (promotion or service price) + HomeServiceSurcharge for both create-preference and the webhook. Public `GET api/home-service/coverage-localities/active` (anonymous, tenant from host, `public-read` policy) returns id/name/province/surcharge. `GET /api/bookings` now includes `homeServiceAddress`. Migration `20261103184938_AddBookingHomeServiceAddress` adds columns only, so no RLS block is needed. RED: 19/23 new tests failed (got 200 where 400 was expected, 405 on the unmapped public route, resolver ignored the surcharge). GREEN: full suite 337/337; `dotnet build` OK. About 694 authored lines, mostly tests, which is over the ~400 heuristic. Follow-up: the agenda payloads in `TimeSlotsController` (outside T2 surfaces) do not show the address yet. Parent: suite 337/337, rate limit switched to `public-read`, independent review PASS with follow-ups (tier high, RDD off).

- 2026-11-03: T2b implemented, not yet committed (route: delegated writer, trigger: controller + policy + tests). `UpdateBookingRequest.homeAddress` (same shape as on create). `UpdateBooking` calls the new `IHomeServiceBookingPolicy.ResolveForUpdateAsync` on the resulting service slug before any field is assigned: OnSite clears all snapshot fields (an address sent along is ignored); AtHome with an address validates it like on create and writes a fresh snapshot; AtHome without an address keeps the existing snapshot (no re-pricing) or returns 400 "Ingresá la dirección…" when the booking has none. A rejected edit changes nothing. `UpdateBooking` does not touch the promotion snapshot (PromotionId/DiscountAmount/FinalPrice) on a service change, and it has no rule for paid or approved bookings; both are unchanged by T2b (see Next step). RED: 7/8 new tests failed (the keep-snapshot case already passed because the old code never touched the snapshot). GREEN: full suite 345/345; `dotnet build` OK. Parent: suite 345/345; independent review PASS with follow-ups (tier high, RDD off).
- 2026-11-03: T2c implemented, not yet committed (route: delegated writer, trigger: controller + repository + tests). `UpdateBooking` returns 400 "No se puede editar una reserva confirmada o pagada" when `Status == Confirmed` or the booking has a `Payment` with `Status == Approved` (new `IBookingsRepository.HasApprovedPaymentAsync`), checked right after the 404 and before the home-service policy or any assignment; 400 mirrors the existing business-rule rejections ("Esta reserva ya fue pagada", "Los turnos confirmados deben reprogramarse por WhatsApp"). Reschedule, admin-reschedule, confirm, cancel and `UpdateBookingDetail` unchanged. New `HomeService/BookingEditLockTests.cs` (6 cases); no existing test edited a confirmed/paid booking. RED: 3/6 failed (confirmed, approved payment, lock-before-policy); GREEN: full suite 351/351; `dotnet build` OK. Parent: suite 351/351; independent review PASS (tier high, RDD off).
- 2026-11-03: T2d implemented, not yet committed (route: delegated writer, trigger: controller + repository + tests). Public `POST api/bookings/{id}/cancel` returns 400 "Esta reserva ya está pagada. Escribinos por WhatsApp para cancelarla" when the booking has an approved payment (after the cancelled/expired checks). New Admin-only `POST api/bookings/{id}/admin-cancel-refund` {amount?, method: Cash|Transfer (required, Caja values), note?}: one explicit transaction + single SaveChanges cancels the booking (shared `MarkCancelled` + cancel notification, same as public cancel), sets payment `Refunded` + `RefundedAt`, and adds a Caja `Refund` movement (BookingId link, `RefundOfMovementId` null since the MP payment has no Caja movement). 400 for no approved payment, already refunded, already cancelled, amount <= 0 or > payment, invalid method, and no open caja session (mirrors `POST api/caja/movements`, "No hay ninguna caja abierta"); 404 other tenant; 403 Staff; 401 anonymous. New `BookingCancelRefundTests.cs` (19 cases incl. DB-trigger-forced Caja insert failure → nothing saved). RED: 17/19 failed; GREEN: full suite 370/370; `dotnet build` OK. Review correction (double-refund race): new `IBookingsRepository.TryMarkPaymentRefundedAsync` (conditional `ExecuteUpdateAsync` Approved -> Refunded, tenant filter kept) is the first write inside the transaction; on false → rollback + 400 "El pago de esta reserva ya fue devuelto"; the tracked payment is no longer modified. +2 tests: concurrent `Task.WhenAll` (exactly one 200/one 400, one Caja movement) and repository guard (true then false; other tenant false). RED: concurrency test failed 3/3 with the guard removed; GREEN: 21/21 ×3 runs, full suite 372/372; trigger rollback test still asserts payment stays Approved. Parent: suite 372/372; independent review FAIL (double refund race) fixed with conditional update guard (tier high, RDD off).
- 2026-11-03: T3 implemented, not yet committed (route: delegated writer, trigger: scheduling + bookings + settings + tests). A booking claims exactly one `TimeSlot`; its time range is the slot's Start/End (`Service.Duration` is a free-text string and is not used; generated slots last `BusinessSettings.SlotDuration`). New `BusinessSettings.HomeServiceTravelBufferMinutes` (default 30, 0 disables, 0–240 else 400) in GET/PUT `api/businesssettings` (optional in PUT: omitted keeps the stored value); migration `20261103215412_AddHomeServiceTravelBuffer` (column DB default 30 for existing rows; no model default, so an explicit 0 is kept). One service `Modules/HomeService/TravelBuffer/HomeServiceTravelBuffer` (tenant query filters; at-home = `HomeServiceSurcharge != null`, not Cancelled; same professional, unassigned matches unassigned; no settings row = 30). Listing: `GET api/timeslots/available?serviceSlug=` hides inside-buffer slots only when the slug is an AtHome service. Enforced with 409 "Ese horario no deja tiempo de traslado con otro turno a domicilio" on create (after the claim, rolled back), public and admin reschedule of an at-home booking, and `UpdateBooking` switching an on-site booking to at-home. New `HomeServiceTravelBufferTests.cs` (16) + 5 settings tests; existing HomeService tests now give each random at-home slot its own professional (shared legacy tenant made them collide inside the buffer). RED: 12/21 new tests failed (the other 9 assert unchanged "allowed / not hidden" behavior); GREEN: 21/21, full suite 393/393 ×3; `dotnet build` OK. Parent: suite 393/393; independent review PASS with follow-ups (tier high, RDD off).

## Next step
T2b (re-run policy on edit), then T3. Pre-existing follow-up (not candidate-caused): `GET /api/bookings` shows every tenant booking to Professionals, now including home address; consider limiting it to the assigned professional.

## Follow-ups (from reviews, not yet scheduled)
- Paid bookings: scheduled as T2c.
- Other actions on confirmed/paid bookings (unchanged by T2c): public reschedule allowed when paid but unconfirmed; admin reschedule allowed; public cancel allowed with no refund handling; `UpdateBookingDetail` unguarded. Cancelled and legacy "Reservado" bookings stay editable. Cancel of paid bookings scheduled as T2d.
- `UpdateBooking` checks only `Turnos.Edit`, not booking ownership for Professionals (unlike `ConfirmBooking`); pre-existing, widened by T2b.
- `UpdateBooking` never refreshes the promotion snapshot on service change, so the old promotion price carries over; pre-existing.
- A renamed/deleted service slug makes an edit of an old at-home booking clear its snapshot; no test for null/unknown slug.
- `GET /api/bookings` shows every tenant booking (now with address) to Professionals; pre-existing.
- Monthly Caja report sums only Approved MP payments; a refunded MP payment drops out while its Refund movement also lowers cash/transfer totals (possible double deduction). Accounting decision pending.
- Public cancel: an MP webhook approving the payment between the paid check and the save can still let a paid booking be cancelled (narrow race).
- Admin refund is allowed on expired bookings (assumed intended; confirm with user). Bookings cancelled before T2d with an approved payment cannot be refunded through the new endpoint.
- Travel buffer race: two simultaneous at-home bookings on adjacent slots of the same professional can both pass (fix: per-professional `pg_advisory_xact_lock` before the check).
- Slot listing without `professionalId` compares against unassigned slots, so it can show a slot that create then rejects with 409 (fails safe, inconsistent UX).
- Booking length = one TimeSlot (`BusinessSettings.SlotDuration`); `Service.Duration` is unused free text, so long detailing jobs are not modeled. Pre-existing.
- Reschedule to another professional's slot keeps the old `Booking.ProfessionalId`. Pre-existing.
