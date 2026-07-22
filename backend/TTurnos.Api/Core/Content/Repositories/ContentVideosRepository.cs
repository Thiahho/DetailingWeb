using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Core.Content;

public class ContentVideosRepository : IContentVideosRepository
{
    private readonly ApplicationDbContext _context;

    public ContentVideosRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<List<ContentVideo>> GetActiveAsync() =>
        _context.ContentVideos
            .Where(v => v.IsActive)
            .OrderBy(v => v.Order)
            .ThenBy(v => v.CreatedAt)
            .ToListAsync();

    public Task<List<ContentVideo>> GetAllAsync() =>
        _context.ContentVideos
            .OrderBy(v => v.Order)
            .ThenBy(v => v.CreatedAt)
            .ToListAsync();

    public Task<ContentVideo?> FindAsync(int id) => _context.ContentVideos.FindAsync(id).AsTask();

    public void Add(ContentVideo video) => _context.ContentVideos.Add(video);

    public void Remove(ContentVideo video) => _context.ContentVideos.Remove(video);

    public Task<int> SaveChangesAsync() => _context.SaveChangesAsync();
}
