using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Turneo.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddScheduledReminderToAutomationRuleExecution : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ScheduledReminderId",
                table: "AutomationRuleExecutions",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_AutomationRuleExecutions_ScheduledReminderId",
                table: "AutomationRuleExecutions",
                column: "ScheduledReminderId");

            migrationBuilder.AddForeignKey(
                name: "FK_AutomationRuleExecutions_ScheduledReminders_ScheduledRemind~",
                table: "AutomationRuleExecutions",
                column: "ScheduledReminderId",
                principalTable: "ScheduledReminders",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AutomationRuleExecutions_ScheduledReminders_ScheduledRemind~",
                table: "AutomationRuleExecutions");

            migrationBuilder.DropIndex(
                name: "IX_AutomationRuleExecutions_ScheduledReminderId",
                table: "AutomationRuleExecutions");

            migrationBuilder.DropColumn(
                name: "ScheduledReminderId",
                table: "AutomationRuleExecutions");
        }
    }
}
