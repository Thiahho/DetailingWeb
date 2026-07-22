namespace Turneo.Api.Core.Content;

public interface IContentVideosRepository
{
    Task<List<ContentVideo>> GetActiveAsync();
    Task<List<ContentVideo>> GetAllAsync();
    Task<ContentVideo?> FindAsync(int id);
    void Add(ContentVideo video);
    void Remove(ContentVideo video);
    Task<int> SaveChangesAsync();
}
