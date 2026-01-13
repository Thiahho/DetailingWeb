namespace DetailingApi.Models;
public class TurnoRequest
{
    public string Name { get; set; } = string.Empty;
    public string Vehicle { get; set; } = string.Empty;
    public string WhatsApp { get; set; } = string.Empty;
    public DateTime DateTime { get; set; }
    public string Message { get; set; } = string.Empty;
}