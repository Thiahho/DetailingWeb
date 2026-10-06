# Admin-managed social links ("Redes")

## Objective

Let the salon admin create, edit, reorder and remove any number of social
network links (name + URL) from the panel, and show them on the salon's public
site.

## Problem

`SiteConfig` only has fixed fields for WhatsApp and Instagram. A salon with
Facebook, TikTok, YouTube or any other profile cannot publish it.

## Scope

- Backend: new `SocialLinks` list on `SiteConfig` (jsonb, same pattern as
  `LocalPhotos`), exposed by `GET /api/siteconfig` and saved by
  `PUT /api/siteconfig`, sanitized server-side. One EF Core migration.
- Admin: a "Redes" block in `/admin/configuracion` (sidebar: Empresa) to add,
  edit, reorder and remove links.
- Public site (`/reservar`): the links appear in the contact block next to the
  existing WhatsApp / Instagram entries, and in the JSON-LD `sameAs`.

Out of scope: removing or migrating the existing `InstagramUrl`,
`InstagramHandle` and `WhatsAppNumber` fields (many screens depend on them);
Turneo's own commercial landing (`/`); Smart Tags.

## Constraints

- Server-side validation is the authority: absolute `https` URLs only, trimmed
  non-empty name, bounded lengths, no duplicate URLs, capped count. Invalid
  entries are dropped, same as `SanitizeLocalPhotos`.
- These URLs become `<a href>` on a public page: never store or render a
  non-https scheme (`javascript:`, `data:`). Public links open with
  `rel="noopener noreferrer"`.
- Existing rows must keep working: the new column defaults to an empty list.
- A `PUT` that omits the field (older client, e2e seed) must not fail.
- Existing `data-testid` attributes and API fields stay unchanged.

## Checklist

- [x] S1 Backend: entity, mapping, controller, migration, integration tests — route: delegated writer
- [x] S2 Frontend: `siteConfig.ts`, admin "Redes" block, public rendering — route: delegated writer
- [x] S3 e2e: test in `e2e/admin-config.spec.ts` (admin adds a link, it persists, it shows on `/reservar`, cleanup) — route: delegated writer (spec), parent ran it

## Checks

- `dotnet test Turneo.Api.Tests -c Release` (in `backend/`) — 167 existing + new.
- `dotnet ef migrations has-pending-model-changes` (in `backend/Turneo.Api`) — no pending changes.
- `pnpm exec tsc --noEmit -p .` (in `frontend/turneo-web`).
- `pnpm exec playwright test` (full suite; run by the parent).

## Progress and evidence

- S1: RED observed first (6 new tests failing with KeyNotFoundException on
  `socialLinks`), then GREEN. Parent spot check: `dotnet test Turneo.Api.Tests -c
  Release` → 173 passed, 0 failed (167 previous + 6 new).
- Migration `20261006150809_AddSocialLinksToSiteConfig`: `SocialLinks jsonb NOT
  NULL DEFAULT '[]'`. EF generated `defaultValue: ""` (invalid jsonb); edited to
  `"[]"` by hand, same as the LocalPhotos migration. `has-pending-model-changes`:
  none. Not applied to any database yet — the API applies it on startup.
- Sanitizer is stricter than the brief: besides the https scheme it requires the
  literal `https://` prefix, because `Uri` accepts `https:host`.
- S3: full Playwright suite run by the parent → 35 passed, 2 skipped (37 tests).
  The 2 skips are the Reseñas / Privacidad bulk smoke tests (empty listings), not
  this feature. The run also applied the migration to the e2e database.
- S2: `tsc --noEmit` exit 0 (parent re-run). Admin block and public cards were
  **not** checked in a browser.
- Public page: a social link equal to `instagramUrl` is skipped (no duplicate
  card); TikTok, Pinterest and Threads use a generic globe icon.

## Known gaps left as found (not fixed)

- `SiteConfigController` PUT returns the raw entity (includes `TenantId`).
- `InstagramUrl` is stored without sanitizing and rendered as `href`.
- jsonb list properties have no EF value comparer (warning 10620).

## Delivery

Commits: not made — the working tree carries uncommitted work from the same
day and the user has not asked for commits.
