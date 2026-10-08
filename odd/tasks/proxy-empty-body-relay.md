# Proxy routes: relay backend responses without assuming JSON

## Objective

Make every Next.js proxy route under `frontend/turneo-web/app/api` forward the
backend's real status and message, even when the backend body is empty or plain
text.

## Problem

The proxies do `await response.json()` and return the parsed body. When the
backend answers with no body (a `200` from `return Ok()`, an empty `401`/`403`)
or with plain text (the rate limiter's `429`), the parse throws, the route's
`catch` runs and the browser gets `500 "Error de conexión con el servidor"`.

Reported case: updating a loyalty roulette prize from `/admin/ruleta`
(`PUT /api/loyalty-roulette/prizes/{id}` returns an empty `200`). The prize was
saved, but the admin saw a connection error.

## Scope

- New shared helper `frontend/turneo-web/src/lib/proxyResponse.ts`.
- Replace the pure passthrough pattern
  (`const data = await response.json(); return NextResponse.json(data, { status: response.status });`)
  with the helper in every proxy route. 67 occurrences in 49 files at the start.

Out of scope: handlers that read `data` before answering (auth cookies, custom
`429`/`204` handling, `.json().catch(() => ({}))`), the backend, and client
pages.

## Constraints

- No behavior change for responses that already worked: same status, same JSON.
- Clients call `res.json()` unconditionally, so the helper always answers JSON.
  A `204`/`304` cannot carry a body, so it is relayed as `200 {}`. Sites that
  already special-case `204` keep their own handling, which runs first.

## Checklist

- [x] T1 Shared helper and loyalty-roulette proxy using it — route: inline (one new file plus one already-understood file)
- [x] T2 Codemod the passthrough pattern in the remaining proxy routes — route: inline (mechanical scripted replace, no per-file design)

## Checks

- `npx tsc --noEmit` (in `frontend/turneo-web`).
- `npm run lint` (in `frontend/turneo-web`).
- No remaining passthrough pattern: multiline grep over `app/api` returns 0.

Test-first exception: the frontend has no unit test runner (only Playwright
e2e against a real backend), so there is no runnable deterministic RED for the
helper. Checks are structural (typecheck, lint, grep).

## Delivery

Strategy: `ask-on-risk`. Forecast: about 300 authored changed lines (67 sites,
49 import lines, one helper), under the 400 budget. Commits on
`TurnosP-Belleza`; push stays with the user.

## Progress and evidence

- T1 — commit `f99d30d`. `npx tsc --noEmit` exit 0.
- T2 — commit `af27229`. 87 handlers in 52 files: the 67 pure passthroughs plus
  20 of a second mechanical pattern found during the run (parse, call
  `revalidateTag` on success without reading `data`, pass the body through).
  Every call is `return await relayResponse(...)` so a failed body read still
  lands in the route's `catch`. `npx tsc --noEmit` exit 0; grep for the
  passthrough pattern returns 0.
- `npm run lint` unavailable: ESLint is not configured in the project (the
  command opens the interactive setup prompt). Not run.
- Not exercised against a running backend; the Playwright suite was not run.
- Review: RDD is off for this clone (`clone_local`), so no native review.

## Next step

Five handlers still parse blindly because they read the body before answering.
They need a per-handler change, not a codemod, and are left for a follow-up:

- `app/api/auth/[...path]/route.ts:74` and
  `app/api/platform/auth/login/route.ts:19` (set cookies from the body).
- `app/api/bookings/route.ts:195` and
  `app/api/bookings/[...path]/route.ts:275`, `:342` (send notification emails
  from the body).
