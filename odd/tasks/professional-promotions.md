# Professional promotions
Objective: each professional can create automatic-discount promotions. Branch: TurneoDV2-Belleza. Delivery: ask-on-risk. Runner: `cd backend && dotnet test`; frontend `pnpm lint`.

## Specs
- S1: "que cada profesional tenga la opcion de poder crear promociones." Professional role manages only own promos (CRUD, pause).
- S2: Promo = own service(s), `Percent` or `FixedAmount`, value, StartsAt/EndsAt, IsActive. (Assumption: decided with user: automatic discount, no coupons.)
- S3: Public booking shows original price struck through + final price when a promo is active.
- S4: Booking stores snapshot (PromotionId, DiscountAmount, FinalPrice); payments and earnings use final price.
- S5: Several active promos: best discount wins, no stacking.
- S6 (dropped): `MaxPromotions` plan limit. SaaSCatalogSeeder only seeds when Features is empty, so a new key needs a data migration (high risk, not requested). Revisit only if the user asks.

## Tasks
- T1 (S1,S2) entity + migration (with RLS) + CRUD — inline — done in c0897dd; tests compile but NOT run (no Docker on this machine)
- T2 (S4,S5) pricing service + booking snapshot + Mercado Pago amount — inline — done; 10 pure unit tests pass, integration tests (PromotionBookingTests) compile but NOT run (no Docker). Earnings need no change: they sum real CajaMovements.
- T3 (S3) public read endpoint + frontend portal page + public price UI — inline — pending

## Log
- L1: "que cada profesional tenga la opcion de poder crear promociones."
- L2: user chose "Descuento automático (Recomendado)" (no coupons).
- Route: all inline (no parallel-unit writer reason).
