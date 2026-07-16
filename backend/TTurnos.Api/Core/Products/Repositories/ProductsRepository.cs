using Microsoft.EntityFrameworkCore;

namespace TTurnos.Api.Core.Products;

public class ProductsRepository : IProductsRepository
{
    private readonly ApplicationDbContext _context;

    public ProductsRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<List<Product>> GetAllAsync() =>
        _context.Products
            .OrderBy(p => p.Order)
            .ThenBy(p => p.CreatedAt)
            .ToListAsync();

    public Task<Product?> FindAsync(int id) => _context.Products.FindAsync(id).AsTask();

    public void Add(Product product) => _context.Products.Add(product);

    public void Remove(Product product) => _context.Products.Remove(product);

    public Task<int> SaveChangesAsync() => _context.SaveChangesAsync();
}
