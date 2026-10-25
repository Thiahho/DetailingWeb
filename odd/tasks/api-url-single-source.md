# Feature: api-url-single-source

## Objective
Resolve the backend API base URL from a single module that fails loudly when the
environment variable is missing, instead of silently falling back to a dead host.

## Problem
62 frontend files repeat `process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com"`,
`src/lib/config.ts` repeats it for `NEXT_PUBLIC_API_BASE_URL`, and `next.config.js` uses the
same host as the CSP default. That host is retired (returns 404). A missing env var makes the
site fail silently (empty `public-data`, broken auth) instead of failing the build.

## Scope
- New `frontend/turneo-web/src/lib/apiUrl.ts` exporting `API_URL`, read from
  `process.env.NEXT_PUBLIC_API_URL` (literal access so Next.js inlines it), trimmed of a trailing
  slash, throwing a clear error at import time when empty.
- Replace the 62 duplicated fallbacks with an import of `API_URL`.
- `src/lib/config.ts`: `API_BASE_URL` = `NEXT_PUBLIC_API_BASE_URL` or `API_URL` (no dead host).
- `next.config.js`: throw a clear error when `NEXT_PUBLIC_API_URL` is missing; drop the dead host.
- Make sure e2e / landing-capture runners still provide the variable.

## Constraints
- No behavior change when the variable is set.
- No new dependencies. Frontend has no unit-test runner (Playwright only).

## Delivery
- Strategy: ask-on-risk. Forecast: ~150 authored changed lines (single work unit).
- Branch: `TurnosP-Belleza` (not the default branch).

## Tasks
- [x] T1 — Centralize API URL and remove dead-host fallbacks
  - Route: delegated direct (writer trigger: ~64 files).
  - Test-first exception: no runnable unit-test runner in the frontend; verification is
    structural + build-based.
  - Checks:
    - `grep -rn "detailing-api.onrender.com" frontend/turneo-web/{app,src,next.config.js}` → 0 code hits
    - `pnpm build` with the variable set → succeeds
    - `pnpm build` with the variable empty → fails with the clear error message

## Acceptance criteria
- No source file references `detailing-api.onrender.com`.
- Exactly one place reads `NEXT_PUBLIC_API_URL` for server code (`src/lib/apiUrl.ts`), plus `next.config.js`.
- Build fails fast and clearly without the variable.

## Progress
- Created.
- T1 done (delegated writer). 61 route/page files now import `API_URL` from
  `src/lib/apiUrl.ts` (all used the local name `API_URL`; `app/api/bookings/route.ts`
  had two declarations, one inside `GET`). `config.ts` falls back to `API_URL`;
  `next.config.js` throws when the variable is missing; `.env.example` marks it required.
  Playwright: landing runner already injects it via `landing-capture/env.mjs`; main e2e
  relies on `.env.local` (defines it) — unchanged.
  - Evidence: grep dead host in app/src/next.config.js → 0 hits; only `src/lib/apiUrl.ts`
    reads `process.env.NEXT_PUBLIC_API_URL` in app/src; `tsc --noEmit` → exit 0;
    `NEXT_PUBLIC_API_URL=https://example.invalid pnpm build` → success;
    `NEXT_PUBLIC_API_URL= pnpm build` → exit 1 with "NEXT_PUBLIC_API_URL is not set...".
  - Commit: (recorded below after commit)
- Next step: native review assessment of the T1 commit; feature complete.
