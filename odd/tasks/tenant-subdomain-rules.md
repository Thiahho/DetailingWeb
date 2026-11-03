# Tenant subdomain rules

## Objective
Make per-tenant subdomains (`<slug>.turneobelleza.com`) safe before enabling the wildcard DNS.

## Problem
- `PlatformTenantsController` only trims/lowercases the slug and checks uniqueness: it accepts spaces, accents, dots and reserved names (`api`, `www`, `admin`...), which are not valid or not safe as DNS labels.
- An unknown subdomain of the base domain resolves to no tenant (`tenantId` 0): the site renders empty and writes fail with a server error instead of a clean 404.

## Scope
- Backend only: slug rules, tenant creation validation, middleware 404 for unknown subdomains, tests.
- Out of scope: DNS/Vercel/Render configuration (done by the user), frontend 404 page, renaming existing slugs.

## Acceptance criteria
- Slug must match DNS label rules: `^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$` (3–63 chars, lowercase letters, digits, hyphens, no leading/trailing hyphen).
- Reserved slugs are rejected (www, api, app, admin, platform, mail, static, cdn, legacy, and similar).
- Creating a tenant with an invalid or reserved slug returns 400 with a clear message.
- Anonymous request whose host is `<sub>.<BaseDomain>` with no matching tenant returns 404; authenticated (tenant claim), bypass, apex/www and non-base-domain hosts keep current behavior.

## Tasks
- [x] T1 — `TenantSlugRules` (format + reserved list) and validation in tenant creation + tests. Route: delegated (writer trigger: 2+ non-trivial files).
- [x] T2 — 404 for unknown subdomain in `TenantResolutionMiddleware` + tests. Route: delegated (same writer).

## Checks
- `dotnet test backend/Turneo.Api.Tests`

## Progress
- Created 2026-11-03. Note: initial claim that unknown subdomains fall back to `legacy` was wrong; they resolve to tenant 0.
- 2026-11-03: T1+T2 implemented by delegated writer. RED observed (8 invalid/reserved creations returned 200; unknown subdomain returned 200). GREEN: full suite 287/287 (parent re-ran). Design: reserved subdomains (e.g. api.<BaseDomain>) never 404, so a backend hosted there keeps working; subdomain lowercased before lookup. RDD disabled for this clone (user choice), so no native review.

## Next step
User: set `Tenancy__BaseDomain=turneobelleza.com` (Render) and `NEXT_PUBLIC_TENANCY_BASE_DOMAIN=turneobelleza.com` (Vercel), move DNS to Vercel nameservers, add `*.turneobelleza.com`. Check that existing production tenant slugs pass TenantSlugRules.
