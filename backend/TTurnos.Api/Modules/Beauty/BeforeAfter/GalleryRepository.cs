using Microsoft.EntityFrameworkCore;

namespace TTurnos.Api.Modules.Beauty.BeforeAfter;

public class GalleryRepository : IGalleryRepository
{
    private readonly ApplicationDbContext _context;

    public GalleryRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<List<GalleryItem>> GetActiveAsync() =>
        _context.GalleryItems
            .Where(g => g.IsActive)
            .OrderBy(g => g.Order)
            .ThenBy(g => g.CreatedAt)
            .ToListAsync();

    public Task<List<GalleryItem>> GetAllAsync() =>
        _context.GalleryItems
            .OrderBy(g => g.Order)
            .ThenBy(g => g.CreatedAt)
            .ToListAsync();

    public Task<GalleryItem?> FindAsync(int id) => _context.GalleryItems.FindAsync(id).AsTask();

    public void Add(GalleryItem item) => _context.GalleryItems.Add(item);

    public void Remove(GalleryItem item) => _context.GalleryItems.Remove(item);

    public Task<int> SaveChangesAsync() => _context.SaveChangesAsync();
}
