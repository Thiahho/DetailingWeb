-- Normalize legacy booking status values to canonical values.
-- Run once against production database.

UPDATE "Bookings"
SET "Status" = 'Pending'
WHERE "Status" = 'Reservado';
