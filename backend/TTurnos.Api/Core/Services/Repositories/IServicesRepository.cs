namespace TTurnos.Api.Core.Services;

public interface IServicesRepository
{
    Task<List<Service>> GetActiveAsync();
    Task<List<Service>> GetAllAsync();
    Task<int> CountActiveAsync();
    Task<Service?> GetBySlugAsync(string slug, bool activeOnly);
    Task<bool> SlugExistsAsync(string slug, int? excludeId = null);
    Task<Service?> FindAsync(int id);
    void Add(Service service);
    void Remove(Service service);
    Task<int> SaveChangesAsync();
}
