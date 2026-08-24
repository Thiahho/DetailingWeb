using System.ComponentModel.DataAnnotations;

namespace Turneo.Api.Core.Reviews;

public record ReviewSubmitRequest(string? AuthorName, [Range(1, 5)] int Rating, string? Comment);

public record ReviewUpdateRequest(string? AuthorName, [Range(1, 5)] int Rating, string? Comment, bool IsApproved, int Order);
