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
- [ ] T2 — `Service.DurationMinutes` (nullable, 5–1440) in entity, DTOs, admin service form (always sent, like `locationType`). Route: delegated.
- [ ] T3 — `Booking.StartDateTime` / `EndDateTime` snapshot: migration with backfill from TimeSlot; set on create, reschedule, and service change. Route: delegated.
- [ ] T4 — Exclusion constraint (`btree_gist`) on active bookings per tenant + professional (null professional as one resource) over `[start, end)`; map violation to 409. Route: delegated.
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

## Next step
T2.

## Follow-ups
- `RegenerateAllSlotsAsync` still uses server `DateTime.Now` (UTC on Render) instead of Argentina wall-clock; no frontend caller today.
- Release cancels a Pending booking whose payment is still Pending; check what the MercadoPago webhook does if it later approves that payment (Cancelled booking + possibly re-booked slot).
