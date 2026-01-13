namespace DetailingApi.Models;

public class BlockedDate
{
    public int Id { get; set; }
    public DateTime Date { get; set; }
    public string? Reason { get; set; }
    public bool IsRecurring { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}