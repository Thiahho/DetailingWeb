namespace Turneo.Api.Core.Professionals;

// Prueba de concepto para reducir el acoplamiento a ApplicationDbContext
// (auditoría, sección 5: "todos los controllers inyectan ApplicationDbContext
// directo, sin capa de repositorio", DbContext con la mayor centralidad del
// sistema). Piloto acotado a Professionals — el resto de los controllers
// sigue inyectando ApplicationDbContext directo hasta que se decida
// replicar el patrón.
//
// La búsqueda de profesionales disponibles para un TimeSlot (GetAvailable en
// el controller) sigue tocando ApplicationDbContext.TimeSlots directo a
// propósito: es una consulta de Scheduling, no de Professionals, y
// abstraerla acá mezclaría dominios en vez de reducir acoplamiento.
public interface IProfessionalsRepository
{
    Task<List<Professional>> GetActiveWithServicesAsync();
    Task<List<Professional>> GetAllWithServicesAsync();
    Task<Dictionary<int, (int UserId, string? Email, string? Username, string? TelegramChatId)>> GetProfessionalAccountsAsync();
    Task<List<Professional>> GetActiveByServiceAsync(int serviceId);
    Task<Professional?> GetActiveByIdWithServicesAsync(int id);
    Task<Professional?> GetByIdWithServicesAsync(int id);
    Task<Professional?> GetByIdAsync(int id);
    Task<int> CountActiveAsync();

    // Total cobrado (Charge+Deposit-Refund, ver CajaMovement) por turnos asignados
    // a este profesional dentro del rango — base para calcular su comisión.
    Task<decimal> GetChargedTotalInRangeAsync(int professionalId, DateTime from, DateTime to);
    Task<List<Service>> GetServicesByIdsAsync(List<int> serviceIds);
    void Add(Professional professional);
    void Remove(Professional professional);
    Task<int> SaveChangesAsync();
}
