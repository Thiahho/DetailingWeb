# Feature: public-site-url-single-source

## Objective
Resolve the public site base URL (`https://www.turneobelleza.com`) from a single source in the
backend and in the frontend, instead of repeating hardcoded fallbacks.

## Problem
Follow-up (2) from the TurnosP-Belleza range review. The backend repeats the literal
`https://www.turneobelleza.com` 8 times as config fallbacks across `NotificationService`,
`BookingsController`, `SmartTagsController` and `PaymentsController`. The frontend reads
`NEXT_PUBLIC_SITE_URL` in 7 files: two bookings proxies fall back to the hardcoded host and five
SEO files (`layout.tsx`, `robots.ts`, `sitemap.ts`, `servicios/[slug]/page.tsx`, `siteConfig.ts`)
fall back to `""`, which silently produces broken canonical/sitemap/metadata URLs.

## Decision
- Frontend: fail fast, same pattern as `src/lib/apiUrl.ts` (user chose option A on 2026-11-06).
- Backend: one constant `PublicSiteDefaults.BaseUrl`; fallbacks derived from it. Config keys in
  `appsettings*.json` stay unchanged.

## Scope
- Backend: new `backend/Turneo.Api/Shared/Constants/PublicSiteDefaults.cs`; replace the 8 literals.
  The integration test that recomputes the SmartTags fallback uses the same constant.
- Frontend: new `frontend/turneo-web/src/lib/siteUrl.ts` exporting `SITE_URL` (literal
  `process.env.NEXT_PUBLIC_SITE_URL`, trimmed of trailing slash, throws when empty); the 7 usages
  import it. Local `.env.local` (gitignored) and the Playwright web server env provide it;
  `.env.example` documents it as required.

## Constraints
- No behavior change when the variables are set.
- No new dependencies. Frontend has no unit-test runner (Playwright only); backend has xUnit.
- Deployment (Vercel) must define `NEXT_PUBLIC_SITE_URL` or the build fails — tell the user.

## Delivery
- Strategy: ask-on-risk. Forecast: ~100 authored changed lines (single work unit).
- Branch: `TurnosP-Belleza` (not the default branch).

## Tasks
- [ ] T1 — Backend single source (route: delegated, writer trigger: 5 non-trivial files).
  Checks: `dotnet build`, `dotnet test` (SmartTags tests at least).
- [ ] T2 — Frontend single source + env wiring (route: delegated, same writer).
  Checks: `npx tsc --noEmit`, `npm run lint`, `npm run build` with and without the variable.

## Progress
- 2026-11-06: document created; T1/T2 pending.
