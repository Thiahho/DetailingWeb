# Admin bulk actions (select, delete, deactivate)

## Objective

Let an admin select several records at once in the listing pages of the panel
and delete them or switch them on/off in one step, instead of one by one.

## Problem

Only `/admin/turnos` has multi-selection. Every other listing forces one
click (plus one confirmation) per record. Cleaning up test data or retiring a
group of services, products or team members is slow.

## Scope

Pages (sidebar label → route):

| ID | Page | Route | Bulk actions |
|----|------|-------|--------------|
| T1 | shared pieces + Servicios (reference) | `/admin/servicios` | activate, deactivate, delete |
| T2 | Productos | `/admin/productos` | activate, deactivate, delete |
| T3 | Insumos | `/admin/insumos` | activate, deactivate, delete |
| T4 | Equipo | `/admin/profesionales` | activate, deactivate, delete |
| T5 | Galería (Sitio web) | `/admin/galeria` | activate, deactivate, delete |
| T6 | Contenido (Sitio web) | `/admin/contenido` | activate, deactivate, delete |
| T7 | Clientes | `/admin/clientes` | delete (no active flag exists) |
| T8 | Reseñas | `/admin/resenas` | approve, hide, delete |
| T9 | Privacidad | `/admin/solicitudes-privacidad` | confirm, reject (pending only) |

Out of scope: backend changes, new endpoints, `/admin/turnos` (already has it).

## Constraints

- Frontend only. Bulk actions call the **existing per-record endpoints** in
  sequence (same approach as `bulkDelete` in `/admin/turnos`).
- One failing record must not abort the rest: report "N done, M failed" and
  keep the failed ones selected.
- Every destructive bulk action asks for confirmation through `useConfirm`
  (`ConfirmDialog`), stating the count.
- Deactivating re-sends the record through its existing `PUT`; the payload
  must match what the page's own edit form sends, so no field is lost.
- Privacidad: privacy requests are compliance records and the backend has no
  delete endpoint for them. Bulk is limited to resolving pending requests.
  Deleting the request history is a product/legal decision — not taken here.
- Mobile: the action bar must not sit under the panel's fixed bottom bar.

## Shared pieces

- `src/hooks/useBulkSelection.ts` — selected ids, toggle, select all, prune
  ids that no longer exist.
- `src/lib/bulk.ts` — `runBulk(items, action)`: sequential, collects failures.
- `src/components/dashboard/BulkActionBar.tsx` — "select all" checkbox, count,
  action buttons; `BulkCheckbox` for each record.

## Checklist

- [x] T1 shared pieces + Servicios — route: inline
- [x] T2 Productos — route: delegated writer
- [x] T3 Insumos — route: delegated writer
- [x] T4 Equipo — route: delegated writer
- [x] T5 Galería — route: delegated writer
- [x] T6 Contenido — route: delegated writer
- [x] T7 Clientes — route: delegated writer
- [x] T8 Reseñas — route: delegated writer
- [x] T9 Privacidad — route: delegated writer
- [x] T10 e2e spec for bulk actions (`e2e/admin-bulk.spec.ts`); full suite green

## Checks

- `pnpm exec tsc --noEmit -p .` (in `frontend/turneo-web`)
- `pnpm exec playwright test` (full suite, 26 existing tests must stay green)
- Screenshots at 1280 px and 390 px of at least Servicios with a selection.

## Progress and evidence

- T1: shared pieces + Servicios written inline; covered by e2e (select, deactivate,
  persistence after reload, cancel/confirm delete, select all).
- T2–T9: one delegated writer, 8 `page.tsx` files. Toggle payloads checked against
  the backend request DTOs (Productos 4 fields, Insumos 7, Equipo 14 incl.
  `serviceIds` rebuilt from `services`, Galería 5, Contenido 6, Reseñas 5).
  Parent spot check: `ProfessionalRequest` vs `GET /all` projection — lossless.
- Parent follow-up: `feminine` prop on `BulkActionBar` for imágenes / reseñas /
  solicitudes.
- Checks observed: `tsc --noEmit` exit 0; full Playwright suite 34 passed, 2 skipped
  (36 tests: 26 previous + 10 new).
- **Not covered by any test:** Reseñas and Privacidad. Their smoke tests skip
  because the e2e database has no reviews and no pending privacy requests, so
  those two pages are verified by type check and code review only.
- Not done: screenshots (declined by the user), lint (no ESLint config in the
  frontend, `next lint` would prompt interactively).

## Known gaps left as found (not fixed)

- `contenido/page.tsx`: single delete has no confirmation and no try/catch.
- `clientes/page.tsx`: a failed single DELETE gives no feedback.
- `solicitudes-privacidad/page.tsx`: single resolve still uses `window.confirm`.
- `resenas/page.tsx`: "Orden" saves on blur; a PUT sent before blur carries the
  unsaved value.
- Galería / Contenido: a legacy record that fails backend validation (e.g. a
  video `linkUrl` that is not Instagram/TikTok https) fails any PUT, including
  the bulk toggle; it is reported as a failed item.

## Delivery

Commits: not made — the working tree already carries uncommitted work from
the same day (e2e fixes, audit, reviews, panel chrome) and the user has not
asked for commits yet.
