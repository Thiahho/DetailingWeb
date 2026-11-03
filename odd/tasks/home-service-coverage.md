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
- [ ] T3 — Travel buffer between at-home bookings in slot calculation (`Core/Scheduling`) + tests. Route: delegated (writer trigger).
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

## Next step
T2b (re-run policy on edit), then T3. Pre-existing follow-up (not candidate-caused): `GET /api/bookings` shows every tenant booking to Professionals, now including home address; consider limiting it to the assigned professional.

## Follow-ups (from reviews, not yet scheduled)
- Paid bookings: `UpdateBooking` has no rule for bookings with an approved payment; editing service/address changes the resolved amount but not the recorded payment. Pending user decision.
- `UpdateBooking` checks only `Turnos.Edit`, not booking ownership for Professionals (unlike `ConfirmBooking`); pre-existing, widened by T2b.
- `UpdateBooking` never refreshes the promotion snapshot on service change, so the old promotion price carries over; pre-existing.
- A renamed/deleted service slug makes an edit of an old at-home booking clear its snapshot; no test for null/unknown slug.
- `GET /api/bookings` shows every tenant booking (now with address) to Professionals; pre-existing.
