namespace Turneo.Api.Core.Automations;

// Constantes en vez de enum para poder extender sin migraciones de tipo (mismo
// criterio que NotificationEventType/BookingStatus/ReminderStatus en este proyecto).
public static class AutomationTriggerType
{
    public const string ClientBirthday = "ClientBirthday";
    public const string ClientInactive = "ClientInactive";
}
