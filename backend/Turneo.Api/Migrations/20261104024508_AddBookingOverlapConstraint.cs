using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Turneo.Api.Migrations
{
    /// <inheritdoc />
    // Database guarantee that two active bookings of the same professional never
    // overlap in time:
    // - CK_Bookings_EndAfterStart: a booking ends after it starts (modelled in EF).
    // - EX_Bookings_ProfessionalTimeOverlap: bookings that are not Cancelled
    //   (Pending, Confirmed and legacy "Reservado" occupy time), of the same
    //   tenant and professional, never overlap in [StartDateTime, EndDateTime).
    //   A NULL ProfessionalId is one shared resource (COALESCE to 0; Professional
    //   ids are identity values >= 1). EF cannot model exclusion constraints, so
    //   it is raw SQL here only (see ApplicationDbContext, Booking).
    // Existing data is never modified: if any booking already breaks a rule the
    // migration fails listing the conflicting booking ids per tenant, so they
    // can be fixed by hand before deploying again.
    public partial class AddBookingOverlapConstraint : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Bookings has FORCE ROW LEVEL SECURITY: without 'bypass' a
            // non-superuser migration role would see no rows and the check would
            // pass on data it cannot see. SET LOCAL lasts until the migration
            // transaction ends.
            migrationBuilder.Sql(@"
                SET LOCAL app.tenant_id = 'bypass';

                DO $$
                DECLARE
                    overlapping text;
                    invalid_ranges text;
                BEGIN
                    SELECT string_agg(format('tenant %s: bookings %s and %s', a.""TenantId"", a.""Id"", b.""Id""), '; '
                                      ORDER BY a.""TenantId"", a.""Id"", b.""Id"")
                    INTO overlapping
                    FROM ""Bookings"" AS a
                    JOIN ""Bookings"" AS b
                      ON b.""TenantId"" = a.""TenantId""
                     AND COALESCE(b.""ProfessionalId"", 0) = COALESCE(a.""ProfessionalId"", 0)
                     AND b.""Id"" > a.""Id""
                     AND b.""StartDateTime"" < a.""EndDateTime""
                     AND a.""StartDateTime"" < b.""EndDateTime""
                    WHERE a.""Status"" <> 'Cancelled' AND b.""Status"" <> 'Cancelled'
                      AND a.""EndDateTime"" > a.""StartDateTime"" AND b.""EndDateTime"" > b.""StartDateTime"";

                    SELECT string_agg(format('tenant %s: booking %s', ""TenantId"", ""Id""), '; ' ORDER BY ""TenantId"", ""Id"")
                    INTO invalid_ranges
                    FROM ""Bookings""
                    WHERE ""EndDateTime"" <= ""StartDateTime"";

                    IF overlapping IS NOT NULL OR invalid_ranges IS NOT NULL THEN
                        RAISE EXCEPTION 'AddBookingOverlapConstraint: existing bookings break the new rules; fix them by hand (cancel or move) and run the migration again. Overlapping active bookings of the same professional: %. Bookings ending at or before their start: %.',
                            COALESCE(overlapping, 'none'), COALESCE(invalid_ranges, 'none');
                    END IF;
                END $$;
            ");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:btree_gist", ",,");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Bookings_EndAfterStart",
                table: "Bookings",
                sql: "\"EndDateTime\" > \"StartDateTime\"");

            migrationBuilder.Sql(@"
                ALTER TABLE ""Bookings""
                ADD CONSTRAINT ""EX_Bookings_ProfessionalTimeOverlap""
                EXCLUDE USING gist (
                    ""TenantId"" WITH =,
                    (COALESCE(""ProfessionalId"", 0)) WITH =,
                    tsrange(""StartDateTime"", ""EndDateTime"", '[)') WITH &&
                )
                WHERE (""Status"" <> 'Cancelled');
            ");
        }

        /// <inheritdoc />
        // The btree_gist extension stays installed: other objects may use it.
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"ALTER TABLE ""Bookings"" DROP CONSTRAINT IF EXISTS ""EX_Bookings_ProfessionalTimeOverlap"";");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Bookings_EndAfterStart",
                table: "Bookings");
        }
    }
}
