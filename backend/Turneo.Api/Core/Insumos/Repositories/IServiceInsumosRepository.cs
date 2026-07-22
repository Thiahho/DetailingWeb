namespace Turneo.Api.Core.Insumos;

public interface IServiceInsumosRepository
{
    Task<List<ServiceInsumo>> GetByServiceIdAsync(int serviceId);
    void RemoveRange(IEnumerable<ServiceInsumo> items);
    void AddRange(IEnumerable<ServiceInsumo> items);
    Task<int> SaveChangesAsync();
}
