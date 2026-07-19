using Microsoft.EntityFrameworkCore;

namespace TTurnos.Api.Core.Insumos;

public class ServiceInsumosRepository : IServiceInsumosRepository
{
    private readonly ApplicationDbContext _context;

    public ServiceInsumosRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<List<ServiceInsumo>> GetByServiceIdAsync(int serviceId) =>
        _context.ServiceInsumos
            .Include(si => si.Insumo)
            .Where(si => si.ServiceId == serviceId)
            .ToListAsync();

    public void RemoveRange(IEnumerable<ServiceInsumo> items) => _context.ServiceInsumos.RemoveRange(items);

    public void AddRange(IEnumerable<ServiceInsumo> items) => _context.ServiceInsumos.AddRange(items);

    public Task<int> SaveChangesAsync() => _context.SaveChangesAsync();
}
