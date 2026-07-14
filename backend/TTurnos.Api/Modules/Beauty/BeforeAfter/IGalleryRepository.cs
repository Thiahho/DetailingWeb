namespace TTurnos.Api.Modules.Beauty.BeforeAfter;

public interface IGalleryRepository
{
    Task<List<GalleryItem>> GetActiveAsync();
    Task<List<GalleryItem>> GetAllAsync();
    Task<GalleryItem?> FindAsync(int id);
    void Add(GalleryItem item);
    void Remove(GalleryItem item);
    Task<int> SaveChangesAsync();
}
