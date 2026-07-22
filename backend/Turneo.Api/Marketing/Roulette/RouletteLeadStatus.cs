namespace Turneo.Api.Marketing.Roulette;

// Ver ADR de la ruleta (docs/RULETA.pdf, sección 16): línea de estados de un
// lead comercial, desde que gira la ruleta hasta que se convierte en cliente.
public enum RouletteLeadStatus
{
    Nuevo,
    Contactado,
    Conversando,
    Interesado,
    DemoSolicitada,
    DemoRealizada,
    SuscripcionIniciada,
    Cliente,
    NoResponde,
    NoInteresado,
    BeneficioVencido,
    Perdido
}
