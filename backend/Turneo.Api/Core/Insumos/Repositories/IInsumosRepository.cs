namespace Turneo.Api.Core.Insumos;

public interface IInsumosRepository
{
    Task<List<Insumo>> GetAllAsync();
    Task<Insumo?> FindAsync(int id);
    Task<List<Insumo>> FindManyAsync(IEnumerable<int> ids);
    void Add(Insumo insumo);
    void Remove(Insumo insumo);
    Task<int> SaveChangesAsync();
}
