namespace Turneo.Api.Marketing.Roulette;

// Tampoco es tenant-scoped: es un lead comercial de Turneo (un salón que
// todavía no es cliente), no un dato dentro de un tenant existente.
public class RouletteLead
{
    public int Id { get; set; }

    // Datos prioritarios (se piden antes de girar, ver sección 4 del PDF)
    public required string NombreNegocio { get; set; }
    public required string WhatsApp { get; set; }
    public string? NombreResponsable { get; set; }

    // Datos secundarios (se piden después del premio, sin bloquearlo)
    public string? Email { get; set; }
    public string? Instagram { get; set; }
    public string? TipoNegocio { get; set; }
    public string? CantidadProfesionales { get; set; }
    public string? ProblemaPrincipal { get; set; }

    public int PrizeId { get; set; }
    public RoulettePrize? Prize { get; set; }

    public required string CodigoPromocional { get; set; }
    public DateTime FechaParticipacion { get; set; } = DateTime.UtcNow;
    public DateTime CodigoVenceAt { get; set; }

    // Atribución de campaña (ver sección 17 del PDF)
    public string? Fuente { get; set; }
    public string? Campaign { get; set; }

    public RouletteLeadStatus Estado { get; set; } = RouletteLeadStatus.Nuevo;
    public string? Notas { get; set; }
    public DateTime? FechaUltimoContacto { get; set; }

    // Control secundario de abuso (la validación principal es WhatsApp único).
    public string? IpAddress { get; set; }
}
