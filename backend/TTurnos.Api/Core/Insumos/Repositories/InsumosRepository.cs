using Microsoft.EntityFrameworkCore;

namespace TTurnos.Api.Core.Insumos;

public class InsumosRepository : IInsumosRepository
{
    private readonly ApplicationDbContext _context;

    public InsumosRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<List<Insumo>> GetAllAsync() =>
        _context.Insumos
            .OrderBy(i => i.Order)
            .ThenBy(i => i.CreatedAt)
            .ToListAsync();

    public Task<Insumo?> FindAsync(int id) => _context.Insumos.FindAsync(id).AsTask();

    public Task<List<Insumo>> FindManyAsync(IEnumerable<int> ids) =>
        _context.Insumos.Where(i => ids.Contains(i.Id)).ToListAsync();

    public void Add(Insumo insumo) => _context.Insumos.Add(insumo);

    public void Remove(Insumo insumo) => _context.Insumos.Remove(insumo);

    public Task<int> SaveChangesAsync() => _context.SaveChangesAsync();
}
