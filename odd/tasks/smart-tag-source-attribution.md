# Smart Tag source channel and booking attribution

## Objective

Make every tap or scan of a counter plaque (NFC + QR) measurable by channel,
and leave each booking created through a plaque permanently attributed to it,
so the salon and Turneo can tell how many bookings the hardware brings.

## Problem

The Smart Tags module already resolves `/s/{token}`, records interaction
events and a `BOOKING_COMPLETED` event. Two gaps remain against the plaque
plan (points 1-3):

- An event does not say whether it came from the NFC chip or the printed QR,
  so the two channels cannot be compared.
- Attribution lives only in `SmartTagEvent`. The `Booking` row itself does not
  know which plaque produced it, so bookings cannot be listed, filtered or
  counted by origin, and the link is lost if events are ever pruned.

## Why

The pilot (one plaque, 3-5 salons, 2 weeks) decides whether hardware is part
of the product. That decision needs bookings per channel, not just taps.

## Scope

- T1 Source channel: optional `src` (`nfc` | `qr`) accepted on the public
  smart link, stored on `SmartTagEvent`, carried through the booking flow,
  encoded in the generated QR (`?src=qr`), offered as a copyable NFC URL
  (`?src=nfc`) in the admin, and broken down in analytics.
- T2 Booking attribution: nullable `SmartTagId` and `Source` on `Booking`,
  set when a booking is created with a valid smart tag token.

Out of scope (deferred until pilot data exists, as the plan itself states):
batch token generation with CSV export for chip writing, `destino_override`
for cancelled salons, any change to REBOOK / REVIEW / WHATSAPP / INSTAGRAM
behaviour, pricing and terms.

## Constraints

- `src` is untrusted public input: accept only `nfc` or `qr`
  (case-insensitive, stored lowercase); anything else is stored as null and
  never rejects the request.
- A missing, unknown or foreign-tenant token must never block or fail a
  booking (existing behaviour in `BookingsController`).
- New columns are nullable; existing rows and older clients keep working.
- No IP or personal data is stored on events.
- Existing API fields, routes, rate limits and `data-testid` attributes stay
  unchanged. Unknown-token and inactive-tag responses stay identical (404).
- Tenant isolation: attribution only when the tag's tenant equals the
  booking's tenant.

## Delivery

Strategy: `ask-on-risk`. Forecast: about 350 authored changed lines
(generated EF migration designer/snapshot excluded). Branch
`feat/smart-tag-source-attribution`, cut from `TurnosD-Belleza`.

## Checklist

- [x] T1 Source channel on smart tag events (route: delegated writer;
      trigger: 2+ non-trivial files across backend and frontend)
- [ ] T2 Persistent attribution on Booking (route: delegated writer, same
      worker; trigger: 2+ non-trivial files plus EF migration)

## Acceptance criteria

- T1: `GET /api/smart/{token}?src=nfc` records an event with source `nfc`;
  `?src=qr` records `qr`; no or invalid `src` records null and still returns
  200. The QR image encodes the `/s/{token}?src=qr` URL. Tag analytics expose
  counts per source. The admin shows the NFC URL to copy.
- T2: a booking created with a valid same-tenant token has `SmartTagId` and
  `Source` set and its `BOOKING_COMPLETED` event carries the same source; a
  booking with no token, an unknown token or another tenant's token is
  created normally with both fields null.

## Checks

- `dotnet test` on `backend/Turneo.Api.Tests` (new tests observed RED first).
- `npx tsc --noEmit` in `frontend/turneo-web`.
- `dotnet build` of `backend/Turneo.Api`.

## Progress

RDD is off for this clone (`gentle-ai review mode status`), so no native
review runs; ordinary checks apply.

Test-first exception (applies to T1 and T2): the integration suite needs a
Postgres container (Testcontainers) and Docker was not running in the
writer's environment, so no RED/GREEN could be observed for the integration
tests. On the untouched base, `dotnet test --filter SmartLinkEndpointsTests`
already failed 9/9 with `System.ArgumentException: Docker is either not
running or misconfigured`. The new integration tests compile but are
unexecuted; they must be run once Docker is available.

### T1 Source channel (done)

- Commit: recorded in the T2 progress entry below (a commit cannot hold its
  own hash).
- Shape decisions: `SmartTagResponse` gained `nfcUrl` and `qrUrl`; analytics
  gained `interactionsBySource` / `completionsBySource` per tag and
  `totalInteractionsBySource` / `totalCompletionsBySource` in the summary,
  each `{ nfc, qr, unknown }`. No existing field was renamed or removed.
- Migration `20261007230833_AddSourceToSmartTagEvents` (generated with
  `dotnet ef migrations add`): nullable `SmartTagEvents.Source varchar(8)`.
- Checks observed:
  - `dotnet build backend/Turneo.Api`: 0 errors.
  - `dotnet test backend/Turneo.Api.Tests`: 22 passed, 171 failed; every
    failure is the Docker/Testcontainers error above (pre-existing, same on
    the base). The 10 new Docker-free `SmartTagSourceTests` cases pass.
  - `npx tsc --noEmit` (frontend/turneo-web): exit 0.

## Next step

T2: persistent attribution on `Booking`. Then run the integration suite with
Docker available.
