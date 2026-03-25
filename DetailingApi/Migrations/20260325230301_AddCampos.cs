using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace DetailingApi.Migrations
{
    /// <inheritdoc />
    public partial class AddCampos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Bookings: cambiar CancelledAt de timestamptz a timestamp
            migrationBuilder.AlterColumn<DateTime>(
                name: "CancelledAt",
                table: "Bookings",
                type: "timestamp without time zone",
                nullable: true,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone",
                oldNullable: true);

            // Bookings: renombrar Vehicle -> Subject
            migrationBuilder.RenameColumn(
                name: "Vehicle",
                table: "Bookings",
                newName: "Subject");

            // Bookings: agregar CustomFieldsJson
            migrationBuilder.AddColumn<string>(
                name: "CustomFieldsJson",
                table: "Bookings",
                type: "text",
                nullable: true);

            // Bookings: agregar Email
            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "Bookings",
                type: "text",
                nullable: true);

            // Crear tabla NotificationLogs (directamente con timestamp without time zone)
            migrationBuilder.CreateTable(
                name: "NotificationLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BookingId = table.Column<int>(type: "integer", nullable: false),
                    EventType = table.Column<string>(type: "text", nullable: false),
                    Channel = table.Column<string>(type: "text", nullable: false),
                    Provider = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    ProviderMessageId = table.Column<string>(type: "text", nullable: true),
                    ErrorMessage = table.Column<string>(type: "text", nullable: true),
                    RetryCount = table.Column<int>(type: "integer", nullable: false),
                    IsRetryable = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    LastAttemptAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    SentAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    NextRetryAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NotificationLogs_Bookings_BookingId",
                        column: x => x.BookingId,
                        principalTable: "Bookings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_NotificationLogs_BookingId",
                table: "NotificationLogs",
                column: "BookingId");

            migrationBuilder.CreateIndex(
                name: "IX_NotificationLogs_NextRetryAt",
                table: "NotificationLogs",
                column: "NextRetryAt");

            migrationBuilder.CreateIndex(
                name: "IX_NotificationLogs_Status",
                table: "NotificationLogs",
                column: "Status");

            // Crear tabla ContentVideos
            migrationBuilder.CreateTable(
                name: "ContentVideos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Title = table.Column<string>(type: "text", nullable: false),
                    VideoUrl = table.Column<string>(type: "text", nullable: false),
                    ThumbnailUrl = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContentVideos", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ContentVideos_IsActive",
                table: "ContentVideos",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_ContentVideos_Order",
                table: "ContentVideos",
                column: "Order");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "ContentVideos");
            migrationBuilder.DropTable(name: "NotificationLogs");

            migrationBuilder.DropColumn(name: "CustomFieldsJson", table: "Bookings");
            migrationBuilder.DropColumn(name: "Email", table: "Bookings");

            migrationBuilder.RenameColumn(
                name: "Subject",
                table: "Bookings",
                newName: "Vehicle");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CancelledAt",
                table: "Bookings",
                type: "timestamp with time zone",
                nullable: true,
                oldClrType: typeof(DateTime),
                oldType: "timestamp without time zone",
                oldNullable: true);
        }
    }
}
