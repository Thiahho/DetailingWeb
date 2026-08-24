namespace Turneo.Api.Core.Reviews;

public class Review : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public string? AuthorName { get; set; }
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public string Source { get; set; } = ReviewSource.PublicForm;
    public bool IsApproved { get; set; } = false;
    public int Order { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public static class ReviewSource
{
    public const string SmartTag = "SmartTag";
    public const string PublicForm = "PublicForm";
}
