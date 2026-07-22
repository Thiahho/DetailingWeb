namespace Turneo.Api.Marketing.Roulette;

public record PrizeSummary(int Id, string Name);

public record SpinRequest(
    string NombreNegocio,
    string WhatsApp,
    string? NombreResponsable,
    string? Fuente,
    string? Campaign);

public record SpinResponse(
    int LeadId,
    string PremioNombre,
    string? PremioDescripcion,
    string Codigo,
    DateTime VenceHasta,
    bool YaHabiaParticipado);

public record AdditionalDataRequest(
    string? Email,
    string? Instagram,
    string? TipoNegocio,
    string? CantidadProfesionales,
    string? ProblemaPrincipal);

public record RouletteLeadSummary(
    int Id,
    string NombreNegocio,
    string? NombreResponsable,
    string WhatsApp,
    string? Email,
    string? Instagram,
    string? TipoNegocio,
    string? CantidadProfesionales,
    string? ProblemaPrincipal,
    string PremioNombre,
    string CodigoPromocional,
    DateTime FechaParticipacion,
    DateTime CodigoVenceAt,
    string? Fuente,
    string? Campaign,
    string Estado,
    string? Notas,
    DateTime? FechaUltimoContacto);

public record UpdateLeadStatusRequest(string Estado, string? Notas);
