using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Core.Notifications;

public class CustomerProfileService(ApplicationDbContext db)
{
    public async Task<List<CustomerProfileResponse>> GetProfilesAsync() =>
        await db.CustomerProfiles
            .Include(x => x.FavoriteProfessional)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => MapProfile(x))
            .ToListAsync();

    public async Task<CustomerProfileResponse?> GetProfileByIdAsync(int id) =>
        await db.CustomerProfiles
            .Include(x => x.FavoriteProfessional)
            .Where(x => x.Id == id)
            .Select(x => MapProfile(x))
            .FirstOrDefaultAsync();

    public Task<int> CountAsync() => db.CustomerProfiles.CountAsync();

    public async Task<CustomerProfileResponse> CreateProfileAsync(CreateCustomerProfileRequest req)
    {
        // Teléfono único — si ya existe, devuelve el existente
        var existing = await db.CustomerProfiles
            .Include(x => x.FavoriteProfessional)
            .FirstOrDefaultAsync(x => x.Phone == req.Phone);

        if (existing is not null)
            return MapProfile(existing);

        if (req.FavoriteProfessionalId is int favId && !await db.Professionals.AnyAsync(p => p.Id == favId))
            throw new InvalidOperationException("El profesional favorito no existe.");

        var profile = new CustomerProfile
        {
            Phone = req.Phone.Trim(),
            Name  = req.Name.Trim(),
            Email = req.Email?.Trim(),
            Notes = req.Notes?.Trim(),
            Birthday = req.Birthday,
            Instagram = req.Instagram?.Trim(),
            FavoriteProfessionalId = req.FavoriteProfessionalId,
            PhotoUrls = req.PhotoUrls
        };

        db.CustomerProfiles.Add(profile);
        await db.SaveChangesAsync();
        await db.Entry(profile).Reference(x => x.FavoriteProfessional).LoadAsync();
        return MapProfile(profile);
    }

    public async Task<CustomerProfileResponse?> UpdateProfileAsync(int id, UpdateCustomerProfileRequest req)
    {
        var profile = await db.CustomerProfiles.Include(x => x.FavoriteProfessional).FirstOrDefaultAsync(x => x.Id == id);
        if (profile is null) return null;

        // Si cambia el teléfono, verificar que no exista
        if (profile.Phone != req.Phone)
        {
            var conflict = await db.CustomerProfiles
                .AnyAsync(x => x.Phone == req.Phone && x.Id != id);
            if (conflict)
                throw new InvalidOperationException("El teléfono ya está registrado en otro perfil.");
        }

        if (req.FavoriteProfessionalId is int favId && favId != profile.FavoriteProfessionalId
            && !await db.Professionals.AnyAsync(p => p.Id == favId))
            throw new InvalidOperationException("El profesional favorito no existe.");

        profile.Phone = req.Phone.Trim();
        profile.Name  = req.Name.Trim();
        profile.Email = req.Email?.Trim();
        profile.Notes = req.Notes?.Trim();
        profile.Birthday = req.Birthday;
        profile.Instagram = req.Instagram?.Trim();
        profile.FavoriteProfessionalId = req.FavoriteProfessionalId;
        profile.PhotoUrls = req.PhotoUrls;

        await db.SaveChangesAsync();
        await db.Entry(profile).Reference(x => x.FavoriteProfessional).LoadAsync();
        return MapProfile(profile);
    }

    public async Task<List<CustomerBookingHistoryItem>> GetCustomerHistoryAsync(int customerProfileId)
    {
        var profile = await db.CustomerProfiles.FindAsync(customerProfileId);
        if (profile is null) return [];

        return await db.Bookings
            .Include(b => b.TimeSlot)
            .Include(b => b.Professional)
            .Where(b => b.CustomerPhone == profile.Phone)
            .OrderByDescending(b => b.TimeSlot.StartDateTime)
            .Select(b => new CustomerBookingHistoryItem(
                b.Id,
                b.Status == BookingStatus.LegacyReserved ? BookingStatus.Pending : b.Status,
                b.Service,
                b.Subject,
                b.ProfessionalId,
                b.Professional != null ? b.Professional.FirstName + " " + b.Professional.LastName : null,
                b.TimeSlot.StartDateTime,
                b.TimeSlot.EndDateTime,
                b.Items
                    .Where(i => i.ItemType == BookingItemType.Insumo && !i.IsSale)
                    .Select(i => new InsumoUsageItem(i.Name, i.Quantity))
                    .ToList()))
            .ToListAsync();
    }

    public async Task<bool> DeleteProfileAsync(int id)
    {
        var profile = await db.CustomerProfiles.FindAsync(id);
        if (profile is null) return false;

        db.CustomerProfiles.Remove(profile);
        await db.SaveChangesAsync();
        return true;
    }

    private static CustomerProfileResponse MapProfile(CustomerProfile x) => new(
        x.Id, x.Phone, x.Name, x.Email, x.Notes,
        x.Birthday, x.Instagram, x.FavoriteProfessionalId,
        x.FavoriteProfessional is null ? null : $"{x.FavoriteProfessional.FirstName} {x.FavoriteProfessional.LastName}",
        x.PhotoUrls, x.CreatedAt
    );
}
