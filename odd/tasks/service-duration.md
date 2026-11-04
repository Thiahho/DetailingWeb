# Service duration

## Objective
A booking blocks the real time of its service: a long service cannot be overlapped by any other booking of the same professional, whatever service it is.

## Problem
- A booking occupies exactly one `TimeSlot` and has no start/end of its own; every reader derives times from `Booking.TimeSlot`.
- `Service.Duration` is free text ("4-6 hs"); `Service.BufferMinutes` is unused.
- Slots are created client-side (admin/turnos generator, professional agenda, calendar drag) with variable length (15–120 min), optional gaps, and can overlap (only same start is unique). Claiming "N consecutive slots" would not block an overlapping manual slot.
- The only double-booking guard is the partial unique index `Bookings.TimeSlotId WHERE Status <> 'Cancelled'` plus the atomic `IsAvailable` claim.
- Booking → TimeSlot and Payment → Booking are `ON DELETE CASCADE`: deleting a slot (manual delete, expired cleanup, regeneration of available slots with cancelled bookings) deletes bookings and payments.

## Why
Detailing (first niche) has multi-hour services; the agenda must not sell overlapping time. Follow-up of `home-service-coverage`.

## Decisions (user, 2026-11-03)
- Fusion design: slots stay as how the business opens its agenda and where a booking may start; occupancy is time-based.
- `Service.DurationMinutes` (nullable int). Null = the booking lasts its start slot (current behavior). Text `Duration` stays for display.
- `Booking.StartDateTime` / `EndDateTime` snapshot (start = slot start, end = start + duration).
- A start slot is offered only if `[start, end)` overlaps no active booking of the same professional and is fully covered by the business' open slots (contiguous coverage, gaps allowed only between the business' own slots if they are adjacent within tolerance — exact rule in T5).
- Database guarantee: exclusion constraint (`btree_gist`) so two active bookings of the same professional can never overlap; violations map to 409.
- Fix the cascade delete first.
- Travel buffer uses the booking's real range.

## Scope
- In: cascade fix; duration field (backend + admin form); booking time snapshot + backfill; exclusion constraint; availability and booking/reschedule/edit/cancel/release with ranges; travel buffer on ranges; frontend booking flows send `serviceSlug` always; admin agenda/calendar/dashboard/professional agenda/mis-turnos show the booking's real range; EMPRENDERS guide.
- Out: dynamic availability without slots (working hours), per-service cleanup buffer (`BufferMinutes`), professional schedule enforcement.

## Acceptance criteria
- A 3 h service booked at 10:00 makes any other booking of the same professional between 10:00 and 13:00 impossible (listing hides it; API rejects it; concurrent requests: exactly one wins).
- A service whose range is not fully covered by open agenda is not offered and is rejected.
- Services without duration behave exactly as today.
- Deleting or cleaning up slots never deletes bookings or payments.
- Existing bookings get start/end from their slot.

## Tasks
- [x] T0 — Baseline: branch point `07721809` = merged home-service module, last observed backend 419/419, frontend pnpm test 137/137, tsc and build OK. Route: inline (recorded evidence, same commit).
- [x] T1 — Stop cascade deletes: Booking → TimeSlot and Payment → Booking no longer cascade; slot delete, expired cleanup and regeneration never remove slots that have bookings (any status). Migration + tests. Route: delegated (writer trigger: 2+ non-trivial files).
- [x] T2 — `Service.DurationMinutes` (nullable, 5–1440) in entity, DTOs, admin service form (always sent, like `locationType`). Route: delegated.
- [x] T3 — `Booking.StartDateTime` / `EndDateTime` snapshot: migration with backfill from TimeSlot; set on create, reschedule, and service change. Route: delegated.
- [x] T4 — Exclusion constraint (`btree_gist`) on active bookings per tenant + professional (null professional as one resource) over `[start, end)`; map violation to 409. Also add a DB CHECK `EndDateTime > StartDateTime` (review: a forgotten range would store 0001-01-01 silently). Route: delegated.
- [ ] T4b — Deleting a professional with active future bookings (FK SET NULL can now hit the overlap constraint → 500). Pending user decision: block the delete vs map to a clear 409.
- [ ] T5 — Range-based availability and booking: `GET api/timeslots/available?serviceSlug=` for all services; create/reschedule/edit validate overlap and coverage; slots overlapped by a booking marked unavailable and freed on cancel/release only when no other active booking overlaps; travel buffer on booking ranges. Route: delegated.
- [ ] T6 — Frontend: booking flows send `serviceSlug` for every service; admin agenda, calendar, dashboard, professional agenda and mis-turnos show the booking's real range. Route: delegated.
- [ ] T7 — EMPRENDERS `guia-nichos/GUIA.md`: record the module. Route: inline.

## Checks
- `dotnet test backend/Turneo.Api.Tests` (Docker)
- `frontend/turneo-web`: `pnpm test`, `pnpm exec tsc --noEmit -p .`, `pnpm build`

## Delivery
- Forecast: well above ~400 authored lines. Strategy reused from the previous feature: `feature-branch-chain` (slice PRs into `feat/service-duration`, one merge into `TurneoDV2-Belleza`). Push/PRs are user decisions.
- RDD: off for this clone.
- Production check needed before deploy: `btree_gist` available on the production Postgres (`SELECT name FROM pg_available_extensions WHERE name = 'btree_gist';`).

## Progress
- 2026-11-03: Created. Branch `feat/service-duration` from `TurneoDV2-Belleza` (`07721809`). Mapping done by a read-only explorer (see Problem).
- 2026-11-03: T1 implemented (uncommitted, delegated writer). Booking → TimeSlot and Payment → Booking are `Restrict` (migration `20261104021430_StopCascadeDeletesOnBookings`). Manual slot delete returns 400 "Este horario tiene reservas registradas y no se puede borrar" when the slot has any booking; expired cleanup (`DELETE api/bookings/expired`, now Argentina wall-clock), regeneration (`RegenerateAllSlotsAsync`, unused `CleanOldSlotsAsync`) and blocked dates skip slots with bookings; release cancels (instead of deleting) a Pending booking that has a payment. Tests: `SlotDeletionKeepsBookingsTests` (11; RED 8 failed / 3 passed before the fix), full suite 430/430; no existing test changed. Parent: release now leaves already-cancelled bookings untouched (no re-stamp, no delete); backend 430/430; independent review PASS (tier high, RDD off).
- 2026-11-03: T2 implemented (uncommitted, delegated writer). `Service.DurationMinutes` (nullable int, `[Range(5, 1440)]` → 400 "La duración del turno debe estar entre 5 y 1440 minutos") in entity, migration `20261104022327_AddServiceDurationMinutes`, every service read/create response and `ServiceRequest`. PUT stays a full replace like `locationType`: omitted or null clears it; the admin form and bulk activate always send it via `withDurationMinutes` (`src/lib/services/serviceDuration.ts`, null when empty). Form field "Duración del turno (minutos)" with the helper text and inline validation that blocks submit. Tests: `ServiceDurationTests` (12; RED 12/12 failed), vitest `serviceDuration.test.ts` (11; RED: module missing).
- 2026-11-03: T3 implemented (uncommitted, delegated writer). `Booking.StartDateTime`/`EndDateTime` (NOT NULL, Argentina wall-clock); migration `20261104022612_AddBookingTimeRange` adds them nullable, backfills from TimeSlot under `SET LOCAL app.tenant_id = 'bypass'` (FORCE RLS), then SET NOT NULL. Rule in `Core/Bookings/Services/BookingTimeRange.cs` (end = start + service DurationMinutes looked up by slug within the tenant, else slot end), applied through `BookingsController.ResolveTimeRangeAsync` by create, public and admin reschedule (`MoveToSlotAsync`) and `UpdateBooking` only when the service changes (start kept). Readers unchanged; the range is exposed additively as `bookingStartDateTime`/`bookingEndDateTime` (admin list, mine, by-email, by id) because `startDateTime`/`endDateTime` already carry slot times. `TestDataFactory.CreateBookingAsync` now stores the slot range. Tests: integration `BookingTimeRangeTests` (11; RED 10 failed), unit `BookingTimeRangeTests` (6), `BookingTimeRangeMigrationTests` (own database; fails with 23502 when the backfill UPDATE is disabled). Backend 459/459, frontend 148/148, tsc and build OK.
- 2026-11-03: T4 implemented (uncommitted, delegated writer). Migration `20261104024508_AddBookingOverlapConstraint`: detection first (under `SET LOCAL app.tenant_id = 'bypass'`) raises "AddBookingOverlapConstraint: existing bookings break the new rules…" listing `tenant X: bookings A and B` overlaps and `tenant X: booking C` ranges with End <= Start, never modifying data; then `btree_gist` (`HasPostgresExtension`), `CK_Bookings_EndAfterStart` (EF `HasCheckConstraint`) and raw-SQL `EX_Bookings_ProfessionalTimeOverlap` = `EXCLUDE USING gist ("TenantId" WITH =, (COALESCE("ProfessionalId", 0)) WITH =, tsrange("StartDateTime","EndDateTime",'[)') WITH &&) WHERE ("Status" <> 'Cancelled')` (Pending, Confirmed, legacy Reservado occupy time). Down drops both constraints, keeps the extension. `Core/Bookings/Services/BookingWriteConflict` maps 23P01 → 409 "Ese horario se superpone con otro turno del mismo profesional" and 23514 → 400 "El horario del turno no es válido" (matched by constraint name) through `BookingsController.TrySaveBookingAsync` (create, public/admin reschedule, UpdateBooking); open transactions roll back the slot claim/release. Tests: `BookingOverlapConstraintTests` (14) + `BookingOverlapConstraintMigrationTests` (2); RED 12 failed / 4 passed (the allowed cases). Fixtures changed: `HomeServiceTravelBufferTests.ExistingBookingAsync` now stores the slot range (CHECK), and 6 legacy-tenant fixtures on `UtcNow.AddDays(N)` without professional moved to unused days (they overlapped across tests). Backend 475/475, no pending model changes. Open: deleting a professional sets its bookings' `ProfessionalId` NULL (FK SetNull) and can now hit 23P01 (500) if they overlap NULL-professional bookings — `ProfessionalsController.Delete` is outside T4's surface.

## Next step
Paused 2026-11-04 by the user (working tree clean at `16e19a5d`; the T5 writer was stopped before writing anything).

Resume with:
1. Ask the user the pending T4b decision: deleting a professional with active future bookings — block the delete until bookings are reassigned or cancelled (recommended) vs allow it with a clear 409 when it collides.
2. Confirm or change the T5 default `MaxCoverageGapMinutes = 30` (gaps up to 30 min between consecutive slots count as continuous agenda; longer gaps such as lunch break coverage).
3. Relaunch T5 with the same brief (single availability rule for listing and every booking write, coverage, slot recompute helper, `occupiedByBookingId`, travel buffer on real ranges). Baseline: backend 476/476, frontend 148/148.
4. Then T6 (frontend) and T7 (EMPRENDERS guide).
