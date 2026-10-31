# Professional promotions
Objective: each professional can create automatic-discount promotions. Branch: TurneoDV2-Belleza. Delivery: ask-on-risk. Runner: `cd backend && dotnet test`; frontend `pnpm lint`.

## Specs
- S1: "que cada profesional tenga la opcion de poder crear promociones." Professional role manages only own promos (CRUD, pause).
- S2: Promo = own service(s), `Percent` or `FixedAmount`, value, StartsAt/EndsAt, IsActive. (Assumption: decided with user: automatic discount, no coupons.)
- S3: Public booking shows original price struck through + final price when a promo is active.
- S4: Booking stores snapshot (PromotionId, DiscountAmount, FinalPrice); payments and earnings use final price.
- S5: Several active promos: best discount wins, no stacking.
- S6 (assumption): `MaxPromotions` plan limit, 402 when exceeded.

## Tasks
- T1 (S1,S2,S6) entity + migration + CRUD + plan limit — inline — pending
- T2 (S4,S5) pricing service + booking snapshot + payments/earnings — inline — pending
- T3 (S3) public read endpoint + frontend portal page + public price UI — inline — pending

## Log
- L1: "que cada profesional tenga la opcion de poder crear promociones."
- L2: user chose "Descuento automático (Recomendado)" (no coupons).
- Route: all inline (no parallel-unit writer reason).
