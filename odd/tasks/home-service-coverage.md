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
- [ ] T2 — Client address on booking + server-side coverage check and surcharge in the final price + tests. Route: delegated (writer trigger).
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

- 2026-11-03: T1 implemented (route: delegated writer, trigger: 2+ non-trivial files). `ServiceLocationType` (OnSite/AtHome) on `Service`; `Modules/HomeService/ServiceArea` with `CoverageLocality` + Admin-only CRUD at `api/home-service/coverage-localities`; migration `AddHomeServiceCoverage` (column default OnSite, new table with RLS policy). RED: 21/22 new tests failed (missing `locationType` key; 404 on the unmapped route). GREEN: 22/22 new tests; full suite 309/309. Review correction (one scoped pass): folder renamed `Coverage` → `ServiceArea` because `.gitignore` `coverage/` ignored it on Windows (`git check-ignore` now empty); unique-index violations (23505) on save map to the same 400 duplicate response via `TrySaveChangesAsync`; partial unique index `(TenantId, GeorefId) WHERE GeorefId IS NOT NULL`; migration regenerated as `20261103184203_AddHomeServiceCoverage` with RLS block kept. Added tests: case-only duplicate, 401/403 for PUT/DELETE, repository 23505 tests on real Postgres (mutation check: 2/3 fail without the 23505 filter), controller unit tests. Full suite 315/315; `dotnet build` OK (2 pre-existing warnings). Parent re-ran suite 315/315 and independent review (high risk tier, RDD off); review blocker fixed. Assessed tier: high; RDD off, so no native review.

## Next step
T2: client address on booking + server-side coverage check and surcharge.
