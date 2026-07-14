namespace TTurnos.Api.Core.Settings;

public interface IBusinessSettingsRepository
{
    Task<BusinessSettings?> GetAsync();
    void Add(BusinessSettings settings);
    Task<int> SaveChangesAsync();
}
