namespace Turneo.Api.Core.SmartTags;

// Registro de una interacción con un SmartTag. Action es un snapshot de
// SmartTag.Action al momento del evento — si el admin cambia la acción de la
// etiqueta después, el historial ya grabado no se reescribe.
public class SmartTagEvent : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }

    public int SmartTagId { get; set; }
    public SmartTag? SmartTag { get; set; }

    public string Action { get; set; } = string.Empty;

    // Sin FK todavía: placeholder para cuando exista una sesión Client real
    // capaz de identificar al visitante anónimo de un tap NFC (fuera de
    // alcance de esta implementación, ver CU-02 en docs/NFC.md).
    public int? ClientId { get; set; }

    public string EventType { get; set; } = SmartTagEventType.Interaction;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
