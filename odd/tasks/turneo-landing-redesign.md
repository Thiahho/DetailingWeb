# turneo-landing-redesign

## Objective

Rebuild the Turneo commercial home (`frontend/turneo-web/app/(public)/page.tsx`)
as a problem-led landing for salon owners, in the visual language of the
redesigned `/reservar`, illustrated with real product screenshots.

## Problem and why

- The current home lists features in 11 identical text cards with no product
  imagery; it does not say which owner problem each feature solves.
- It still uses the old cream/pink look, not the `ink`/`cream` alternation,
  serif-italic accent, `Reveal` and animations already built for `/reservar`.
- It promises things that are not live: MercadoPago deposits
  (`Payments:Enabled=false`) and automatic WhatsApp notices (no approved
  template).
- Built features that are absent from it: insumos/stock, each salon's own
  public site, professional panel, staff permissions, reviews, loyalty
  roulette, Smart Tags.

## Decisions (user, 05/10)

- ~~Screenshots from the local environment.~~ Reversed the same day: no
  screenshots (too costly). Product visuals are illustrative UI previews built
  in JSX/Tailwind with fictional data.
- Primary CTA stays WhatsApp contact; plans section stays hidden.

## Scope and constraints

- Frontend only. No backend, entity or migration changes.
- Branch `TurnosD-Belleza`; the tree holds ~105 uncommitted files. No commits
  until the user decides.
- Copy in Spanish, same voice as the current home (voseo). No invented
  metrics, testimonials, client logos or customer counts.
- Do not promise online payments or automatic WhatsApp as available.
- Demo data lives in an isolated database, never in `bd_turnos_e2e` or any
  real one; the demo business and people are fictional.
- Tailwind v3 (`tailwind.config.js`), existing tokens; no new palette.

## Tasks

- [ ] T1 — CANCELLED by the user (05/10). Capture tooling + screenshots. Separate Playwright config and
  script that boot API + web against a fresh demo database, seed a fictional
  salon with realistic data through the API, and write screenshots to
  `frontend/turneo-web/public/landing/`. Route: delegated (writer 1). Checks:
  script runs end to end; parent views every image.
- [x] T2 — Landing rewrite. Sections: dark hero with product shot; "¿Te
  suena?" pains; one block per problem (no-shows, messages all day, not
  knowing income, running out of product, coordinating the team); cost
  calculator restyled; "Tu salón con su propia web"; retention (roulette,
  reviews, Smart Tags); trust strip; FAQ + closing CTA; mobile sticky CTA.
  Components under `src/components/landing/`. Route: delegated (writer 2).
  Checks: `tsc`, `next build`, full-page screenshots desktop + mobile reviewed
  by parent.
- [x] T3 — Metadata, sitemap and an e2e spec for the home. Route: delegated
  (writer 2). Checks: the spec passes.

## Acceptance

- `npx tsc --noEmit` clean; `next build` succeeds.
- Home renders without layout breaks at 390 px and 1440 px.
- Every claim on the page maps to a feature that is live today.

## Progress / evidence

- 05/10: T1 stopped mid-run at the user's request; the demo API was stopped.
  Leftovers, untracked and unused: `frontend/turneo-web/landing-capture/`,
  `frontend/turneo-web/playwright.landing.config.ts`, empty
  `frontend/turneo-web/public/landing/`, and a local database created by the
  tooling. Removal pending the user's decision.
- 05/10: plan agreed; no servers were running locally; e2e data
  ("Servicio E2E …") is unsuitable for marketing shots, hence the demo DB.

- 05/10, T2 (writer 2, route: delegated): home rebuilt as a thin Server
  Component (`app/(public)/page.tsx`) over `src/components/landing/`
  (`content.ts` holds all copy and the claim rules; `previews/` holds the seven
  coded UI previews; `LandingFaq` and `MobileCtaBar` are the only new client
  components; `plans.ts` keeps the disabled plans data verbatim, unused).
  `CalculadoraCostoInaccion.tsx` restyled, logic untouched (its only consumer
  is the home). `globals.css` and `sitemap.ts` not changed by this task (the
  home was already listed with priority 1).
  - Claims checked against code. Changed versus the brief: the "Mis turnos"
    portal is entered with the booking email, there is no one-time code in the
    UI today (`mis-turnos/page.tsx` calls `/api/bookings/by-email`), so the
    "access by code" guarantee was dropped and replaced by "each person, their
    own access" and "privacy requests". MercadoPago and WhatsApp reminders
    appear only labelled "próximamente".
  - `npx tsc --noEmit`: exit 0.
  - `npx next build`: NOT run in the repo — the user's own `pnpm dev` (port
    3000) and `dotnet run` (port 5048) were running from VS Code and a build
    would overwrite the `.next` that dev server uses. Run instead on a
    temporary same-drive copy (sources copied, `node_modules` junction, copy
    removed afterwards): compiled successfully, `/` prerendered static,
    5.14 kB / 100 kB first load. Only warnings: the pre-existing
    `metadataBase` ones; the home emits no `og:image`.
  - Visual: full-page screenshots at 1440x900 and 390x844 in the session
    scratchpad (`landing/home-desktop.png`, `landing/home-mobile.png`), plus
    per-section crops reviewed by the writer; no horizontal overflow at either
    width. Parent review of the screenshots: pending.
- 05/10, T3: `export const metadata` on the home (absolute title, description,
  Open Graph and Twitter text fields, no image). New `e2e/home.spec.ts`
  (4 tests).
  - RED: 4 failed against the previous home.
  - GREEN: 4 passed against the new home.
  - Both runs used a temporary Playwright config outside the repo (no
    global-setup, no webServer) pointed at the user's already running dev
    server, read-only on `/`. PENDING: `npx playwright test e2e/home.spec.ts`
    with the repo config — observed result today: "http://localhost:5048/api/services
    is already used" (ports held by the user's servers;
    `reuseExistingServer: false` by design). Re-run once those are stopped.

## Next step

Parent reviews the two screenshots; re-run `npx next build` and
`npx playwright test e2e/home.spec.ts` in the repo with ports 3000/5048 free.
No commits were made.
