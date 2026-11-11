# Catalog follow-ups

## Objective
Close the follow-ups left open by `odd/tasks/catalog-whatsapp.md` so the catalog is easier to manage, cheaper to serve and correct for search engines.

## Problem
- The variants grid can change availability in bulk but cannot turn variants on or off in bulk, although the API already supports it.
- Selected value chips in the product form look almost the same as unselected ones.
- The public product page is client-rendered: an unknown slug answers HTTP 200 and every product shares the generic title "Producto".
- The public navbar asks for the catalog categories on every full page load, for every tenant, only to decide whether to show the "Catálogo" link.
- Deleting a product or a photo leaves its files in Cloudinary.
- The catalog is not tied to a plan: every tenant gets it.

## Why
These were recorded as residual risks when the catalog shipped on 2026-11-11. None blocks the feature, but each one costs the business owner time, money (Cloudinary storage, wasted requests) or visibility (shared links without product name and image).

## Scope
In: the five tasks below, in the catalog module and its screens only.
Out: any change to bookings, payments or other modules; a plan-flags framework for the frontend beyond what T5 needs.

## Constraints
- UI copy in Spanish, following the existing screens. Code, comments and commits in English.
- No new dependencies.
- Cloudinary deletion never fails the request: it runs after `SaveChanges` and only logs a warning, like the existing callers of `CloudinaryAdminService.TryDestroyAsync`.
- A transient backend error on the product page must not turn into a 404.

## Tasks
- [x] T1 — Admin: bulk on/off in `VariantsGrid` (send `isActive` to `PATCH variants/bulk`, same attribute-value filters as the availability change) and clearly distinguishable selected chips in `ProductFields`. Route: delegated (same writer as T2–T4; the feature touches 2+ non-trivial files).
- [x] T2 — Public product page rendered with server data: real 404 for an unknown slug, per-product title, description and Open Graph image; the server fetch forwards the tenant host; the client view receives the product and does not fetch it again. Route: delegated.
- [x] T3 — Navbar: remember whether the tenant has a catalog in the public data cache so the categories request is not repeated on every page load. Route: delegated.
- [x] T4 — Backend: delete Cloudinary files when a product or a photo is deleted. Route: delegated.
- [ ] T5 — `CanUseCatalog` plan flag. DEFERRED by the user on 2026-11-11: plans are left for the end, so the catalog stays available to every tenant for now. Still needs the product decision of which plans include the catalog. Needs a data migration (existing databases) plus the seeder, enforcement in the admin and public catalog controllers, and tests.

## Acceptance criteria
- T1: with a value filter chosen, "turn off" deactivates the matching active variants and "turn on" reactivates only the hand-disabled ones; the grid reloads and reports how many changed. A selected chip is recognizable at a glance (filled background and a check mark), also by keyboard focus.
- T2: `GET /catalogo/producto/<unknown>` answers 404 with the app's not-found page; a known product has `<title>` with its name and Open Graph tags with its first photo; the page shows the product without a second request for the same data; a backend failure other than 404 still renders the client view.
- T3: after one page load that learned the answer, later page loads within the cache lifetime make no categories request from the navbar (when the visitor accepted the "preferences" consent); visiting the catalog refreshes the remembered answer.
- T4: deleting a photo or a product asks Cloudinary to destroy each file after the database change is saved; a Cloudinary failure is logged and the delete still succeeds.

## Checks
- Backend: `dotnet test backend/Turneo.Api.Tests --artifacts-path <scratch dir>` (catalog filter during iteration, full suite at closure).
- Frontend (in `frontend/turneo-web`): `pnpm test`, `pnpm exec tsc --noEmit -p .`, `pnpm build`.
- Components are not unit-tested in this repo (node environment, no Testing Library): extract pure logic where a meaningful test exists; otherwise state the exception.

## Delivery
- Branch `feat/catalog-followups` from `TurneoDV2-Belleza` at `f42d6903`. Strategy: feature-branch-chain (same as catalog-whatsapp); merge is the user's decision.
- Forecast: T1 ~120, T2 ~200, T3 ~80, T4 ~150 authored lines (~550 total, over the ~400 planning budget; one work-unit commit per task keeps each slice reviewable). T5 not forecast until decided.
- Receipt-driven development is off for this clone (clone-local), so no native review runs.

## Progress
- 2026-11-11: feature document created after a read-only mapping of the six follow-ups. "Cloudinary cleanup" and "plan flag" map to T4 and T5; "bulk control" and "chips" share T1.
- 2026-11-11 — T1 done, commit `e1715ed1` (~112 authored lines). Route: delegated. `VariantsGrid` block renamed "Cambios masivos": the availability action is unchanged and two buttons, "Desactivar" and "Activar las desactivadas a mano", send only `isActive` to `PATCH api/catalog/variants/bulk` with the same value filters; the notice reports the count per kind of change (and says so when nothing matched). Body and notice are pure builders in `src/lib/catalog/payloads.ts` (`buildBulkVariantsPayload`, `bulkVariantsNotice`). Selected chips in `ProductFields` are filled (`bg-blush text-white`) with a check icon and an offset focus ring. RED: `pnpm test` → 4 failed / 224 passed (`bulkVariantsNotice is not a function`). GREEN: `pnpm test` → 228 passed; `pnpm exec tsc --noEmit -p .` → exit 0. Exception: the components themselves have no unit test (node environment, no Testing Library). Residual: not checked in a browser; with no value chosen "Desactivar" turns off every active variant of the product without a confirmation (the hint under the buttons says the change reaches all of them).
- 2026-11-11 — T2 done, commit `db1a6f17` (~339 authored lines, 117 of them tests). Route: delegated. `/catalogo/producto/[slug]` now loads the product on the server (`src/lib/catalog/productServer.ts`: `GET api/catalog/public/products/{slug}` with `cache: "no-store"`, wrapped in React `cache()` so `generateMetadata` and the page share one request) and forwards `X-Tenant-Host` plus the client IP headers through the new `tenantHeaderFromHeaders` / `clientIpHeadersFromHeaders` in `src/lib/tenantHeader.ts` (the `NextRequest` versions delegate to them). Backend 404 → `notFound()` with a route-level `not-found.tsx` (the app has no global `app/not-found.tsx`, so this one renders the existing "Producto no encontrado" view); found → `ProductView` receives `initialProduct` and skips its fetch; any other failure → `ProductView` without data, which fetches from the browser as before. Metadata: title = product name (the root layout template adds `| <business>`), description = one-line description cut at 160 characters or a fallback sentence, Open Graph and Twitter with the first image (never a video; `/img/og.jpg` when the product has no photo); no canonical. Pure logic in `src/lib/catalog/productPage.ts`. Next.js is 14.2.5: `headers()` and `params` are synchronous. RED: `pnpm test` → 1 file failed (`Cannot find package '@/src/lib/catalog/productPage'`). GREEN: `pnpm test` → 238 passed; `pnpm exec tsc --noEmit -p .` → exit 0; `pnpm build` → compiled, route listed as dynamic. Exception: the page, the loader and the view are not unit-tested (they need the Next.js runtime). Residual: the HTTP 404 status, the rendered `<title>`/Open Graph tags and the absence of a second request were not observed in a running app; the `server-only` package is not installed, so the loader relies on `next/headers` failing the build if a client component imports it; a product page view now counts against the backend `public-read` rate limit once per render with the visitor IP (only when `PROXY_SHARED_SECRET` is set, otherwise with the Next server IP).
- 2026-11-11 — T3 done, commit `3912b412` (~180 authored lines, 85 of them tests). Route: delegated. `hasPublicCatalog()` answers from the public data cache (key `catalog:has`, 1 hour, "preferences" consent) without a request; otherwise it requests `api/catalog/public/categories` once and stores the boolean. `fetchPublicCategories()` (used by `/catalogo`) refreshes the stored answer and the in-page memo on every successful response; failures are neither stored nor memoized. Decision logic with injected storage/fetch in `src/lib/catalog/catalogPresence.ts`; `Navbar.tsx` did not need a change. RED: `pnpm test` → 1 file failed (`Cannot find package '@/src/lib/catalog/catalogPresence'`). GREEN: `pnpm test` → 246 passed; `pnpm exec tsc --noEmit -p .` → exit 0; `pnpm build` → compiled successfully, 92 static pages. Residual: a tenant that adds or removes its catalog keeps the old navbar answer for up to an hour in browsers that do not visit `/catalogo`; without the consent the behavior is the previous one (one request per page load); not checked in a browser.
- 2026-11-11 — T4 done, commit `08de60aa` (~190 authored lines, 153 of them tests). Route: delegated. `DELETE api/catalog/products/{id}` reads the media URLs before the delete and `DELETE api/catalog/media/{id}` keeps the deleted row's URL; both call `CloudinaryAdminService.TryDestroyAsync` per URL after `SaveChanges` and only log a warning on failure. Stale comments fixed in `CatalogProductsController` and `MediaManager.tsx`. Tests in `Integration/Catalog/CatalogCloudinaryCleanupTests.cs` use a derived host with Cloudinary settings and a recording `HttpMessageHandler` under the typed client, so the destroy call is observed without reaching Cloudinary and without changes outside the catalog folders. RED: `dotnet test ... --filter "FullyQualifiedName~CatalogCloudinaryCleanup"` → 3 failed (no destroy call recorded), 1 passed (the cross-tenant guard). GREEN: catalog filter → 46 passed; full suite → 578 passed, 0 failed (574 before plus the 4 new tests). Residual: files are destroyed one by one inside the request, so deleting a product with many files waits for one Cloudinary call per file; a file whose destroy fails stays in Cloudinary with only a log line (no retry); files already orphaned by earlier deletes are not cleaned up.
- 2026-11-11 — Running total after T1–T4: ~820 authored changed lines (additions plus deletions), about 390 of them tests; over the ~550 forecast mainly because T2 and T4 carry more test code than planned.
- 2026-11-11 — Browser check (local front on `localhost:3000`, user's backend on this branch, admin session opened by the user). Observed:
  - T1: selected chips are filled with a check mark and an unselected one is outlined; with the filter "S", "Desactivar" reported "1 variante desactivada" and the grid showed two inactive variants; "Activar las desactivadas a mano" with the same filter reported "1 variante activada" and left M (turned off by hand earlier) off.
  - T2: `GET /catalogo/producto/no-existe-xyz` → 404 with the "Producto no encontrado" view; `GET /catalogo/producto/remera-basica` → 200 with `<title>Remera básica | Turneo</title>`, description, Open Graph and Twitter tags (image `/img/og.jpg`, the product has no photo); the browser made no product request (only categories and site config).
  - T3: with the "preferences" consent accepted, the first page load made one categories request and stored `catalog:has`; the next page load made none and still showed the "Catálogo" link. Without that consent the request repeats on every load.
  - Not checked: T4 in a browser (needs a real upload and Cloudinary credentials; covered by integration tests), a product with a photo as Open Graph image, phone layout.

## Next step
T5 is deferred to the end by the user's decision (2026-11-11); do not start it until they bring plans back. T1–T4 are committed on `feat/catalog-followups`; T1–T3 were checked in a browser (see Progress). Push, pull request and merge are the user's decisions.
