namespace TTurnos.Api.Core.Products;

public interface IProductsRepository
{
    Task<List<Product>> GetAllAsync();
    Task<Product?> FindAsync(int id);
    void Add(Product product);
    void Remove(Product product);
    Task<int> SaveChangesAsync();
}
