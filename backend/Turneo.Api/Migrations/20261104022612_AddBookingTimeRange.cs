using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Turneo.Api.Migrations
{
    /// <inheritdoc />
    // Booking.StartDateTime / EndDateTime: the time a booking occupies, snapshot
    // of its slot (Argentina wall-clock, like TimeSlot). Existing bookings copy
    // their slot times; after the backfill every row has a value, so the
    // columns become NOT NULL (Booking.TimeSlotId is required and RESTRICT).
    public partial class AddBookingTimeRange : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "StartDateTime",
                table: "Bookings",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EndDateTime",
                table: "Bookings",
                type: "timestamp without time zone",
                nullable: true);

            // Bookings and TimeSlots have FORCE ROW LEVEL SECURITY: without
            // 'bypass' a non-superuser migration role would see no rows and the
            // backfill would update nothing (then SET NOT NULL fails loudly).
            // SET LOCAL lasts until the migration transaction ends.
            migrationBuilder.Sql(@"
                SET LOCAL app.tenant_id = 'bypass';

                UPDATE ""Bookings"" AS b
                SET ""StartDateTime"" = t.""StartDateTime"",
                    ""EndDateTime"" = t.""EndDateTime""
                FROM ""TimeSlots"" AS t
                WHERE t.""Id"" = b.""TimeSlotId"";
            ");

            migrationBuilder.AlterColumn<DateTime>(
                name: "StartDateTime",
                table: "Bookings",
                type: "timestamp without time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp without time zone",
                oldNullable: true);

            migrationBuilder.AlterColumn<DateTime>(
                name: "EndDateTime",
                table: "Bookings",
                type: "timestamp without time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp without time zone",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EndDateTime",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "StartDateTime",
                table: "Bookings");
        }
    }
}
