# audit-0510-security-fixes

## Objective

Close the critical and yellow findings of the 05/10 system audit (follow-up of
`docs/auditoria_0410.md`).

## Problem and why

- `POST /api/auth/register` creates an `Admin` user anonymously in whatever
  tenant the host resolves.
- The `"auth"` rate limit partitions by `RemoteIpAddress`, but the browser never
  calls the API directly: the Next.js proxy does, without forwarding the visitor
  IP, so all users likely share one bucket.
- MercadoPago: two different config keys for the access token and an HMAC check
  that is skipped when `WebhookSecret` is empty.
- The 10-minute professional-registration token is signed with the session JWT
  key and is accepted by plain `[Authorize]` endpoints.
- Staff permission enforcement has no integration tests.

## Scope and constraints

- Branch `TurnosD-Belleza`; the tree already holds ~86 uncommitted user files.
  Changes stay in the working tree; no commit until the user decides how to
  commit the pending work (files overlap).
- No new production behavior may depend on an env var that is not set: every
  new setting fails safe (closed for auth, unchanged for rate limiting).
- Out of scope: WhatsApp approved template (needs Meta approval, not code);
  e2e for professional self-registration (the code is BCrypt-hashed and mailed
  by the proxy; no test hook without adding a backdoor).

## Tasks

- [x] T1 — Lock `POST /api/auth/register`. Anonymous only when
  `Auth:AllowOpenRegistration=true` (set only in `appsettings.Testing.json` /
  test factory, for the e2e seed and existing tests); otherwise requires an
  authenticated `Admin`. Route: delegated. Checks: new integration tests
  (anonymous → 401 with flag off; Admin → 200), existing suite green.
- [x] T2 — Reject `token_type=professional_registration` (and any non-session
  token type the writer confirms is not meant for API access) as bearer
  authentication, centrally in `JwtAuthenticationSetup`. Route: delegated.
  Checks: integration test hitting `GET /api/auth/me` with a registration token
  → 401; register/complete flow tests still green.
- [x] T3 — Rate limit by real visitor IP. Next proxy sends `X-Client-IP` plus
  `X-Proxy-Secret` (env `PROXY_SHARED_SECRET`) via `tenantHeader()`; API uses
  `X-Client-IP` as partition key only when the secret matches
  (`Proxy:SharedSecret`, constant-time compare), else `RemoteIpAddress` as
  today. Route: delegated. Checks: unit/integration tests for the partition
  key resolver (valid secret, wrong secret, no secret configured), `tsc`.
- [x] T4 — MercadoPago: single key `MercadoPago:AccessToken` (legacy
  `MP_ACCESS_TOKEN:AccessToken` as fallback) in both endpoints; webhook
  rejects when `MercadoPago:WebhookSecret` is missing instead of skipping the
  signature check. `Payments:Enabled=false` behavior unchanged. Route:
  delegated. Checks: `PaymentsEndpointsTests` additions.
- [x] T5 — Staff permission integration tests: a Staff user without a module
  permission gets 403, with it gets 2xx, Admin unaffected. Route: delegated.
- [x] T6 — Update `docs/Security.md`, `docs/API.md`,
  `frontend/turneo-web/.env.example` for the new settings. Route: delegated.

## Acceptance

- `dotnet test Turneo.Api.Tests -c Release` green (baseline: 134 passed).
- `npx tsc --noEmit` clean in `frontend/turneo-web`.
- e2e seed (`e2e/global-setup.ts`) still able to register in Testing.

## Progress / evidence

- Baseline 05/10: 134/134 integration tests, `tsc` clean.
- Native review tooling (`gentle-ai`) not found on PATH: RDD state unknown, no
  native review run.

- Writer run 05/10 (route: delegated direct, one writer). Nothing was committed
  or staged; all changes are in the working tree.
- Base deviation found before any edit: `AuthController.cs` had been modified at
  18:27 with a class-level `[Authorize]` (line 8) and no `[AllowAnonymous]` on
  `login` / `register` / `logout`, so anonymous login returned 401 and 3 of the
  7 `AuthEndpointsTests` failed on the base (the 134/134 baseline no longer
  held). The class-level attribute was kept; `[AllowAnonymous]` was added to
  `login` and `logout` to restore the committed behavior.
- T1 RED: `Register_AsStaff_WithOpenRegistrationOff…` Expected Forbidden /
  Actual OK; `Register_NewAdmin_ReturnsOkWithToken` Expected OK / Actual
  Unauthorized. The anonymous → 401 test was already green on the base because
  of the class-level `[Authorize]` (no RED observable for it). GREEN after
  `AuthController.Register` gate (`Auth:AllowOpenRegistration`).
- T2 RED: registration token on `GET /api/auth/me` Expected Unauthorized /
  Actual NotFound; `booking_access` link token Expected Unauthorized / Actual
  OK. GREEN after `JwtAuthenticationSetup.OnTokenValidated`. Token types
  issued: `admin_access`, `client_access`, `platform_access` (sessions, kept);
  `professional_registration`, `booking_access` (body-only, rejected as
  bearer). Role `ClientPortal` appears in no `[Authorize(Roles)]` and the
  frontend never sends that token as bearer.
- T3 RED (against a stub returning `RemoteIpAddress`): Expected "203.0.113.9" /
  Actual "10.0.0.7". GREEN with `Infrastructure/Security/ClientIpResolver.cs`,
  used by the 7 policies in `Program.cs`. `tenantHeader()` is imported only by
  `app/api/**/route.ts` (50 files); no client component imports it.
- T4 RED: no secret → Expected ServiceUnavailable / Actual OK; secret + missing
  or forged signature → Expected Unauthorized / Actual InternalServerError
  (legacy key); valid signature → Expected OK / Actual InternalServerError.
  GREEN after the change. The signature comparison was already
  `CryptographicOperations.FixedTimeEquals`.
- T5: 9 test cases green on first run (Insumos and Productos); no enforcement
  bug found.
- T6: structural readback of `docs/Security.md`, `docs/API.md`,
  `.env.example`; `appsettings.json` got empty `Proxy:SharedSecret` and
  `MercadoPago:WebhookSecret` placeholders.
- Verification: `dotnet test Turneo.Api.Tests -c Release --nologo` → 161
  passed, 0 failed (run twice). `npx tsc --noEmit` → exit 0.
- Not run: Playwright e2e (excluded by the task). Native review: not run.
- Parent spot check 05/10: first re-run gave 160/161 —
  `SmartTagsEndpointsTests.Create_ReturnsCreated_WithValidToken` failed on a
  token containing `U`. Pre-existing flaky test, unrelated to this feature: the
  assertion regex omitted `U`, which `SmartTagTokenGenerator.Alphabet` includes
  (fails roughly 1 run in 3). Regex corrected in the test; suite then 161/161
  in four consecutive runs. `npx tsc --noEmit` → exit 0.

## Open items (outside the allowed edit surfaces, not changed)

- `frontend/turneo-web/app/api/payments/webhook/mercadopago/route.ts:16` does
  not forward `x-signature` / `x-request-id`, so a notification routed through
  the proxy can never pass the now-mandatory signature check. Point
  `MercadoPago:WebhookUrl` at the API or forward the headers before enabling
  payments.
- `/api/marketing/roulette/*` and `/api/platform/*` proxy routes do not call
  `tenantHeader()`, so they stay rate-limited per proxy IP.
- Test hosts created with `CustomWebApplicationFactory.WithConfigOverrides`
  must not be disposed mid-suite: Hangfire's global `JobStorage.Current`
  follows the last host built.

## Next step

Parent spot check, then the user decides how to commit. Before production: set
`PROXY_SHARED_SECRET` (Vercel) and `Proxy__SharedSecret` (Render) to the same
value.
