using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace TTurnos.Api.Core.Notifications;

public class ReminderService(ApplicationDbContext db)
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
                b.TimeSlot.EndDateTime))
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

    // ── ScheduledReminders ────────────────────────────────────

    public async Task<List<ReminderResponse>> GetRemindersAsync(string? status = null)
    {
        var q = db.ScheduledReminders
            .Include(x => x.CustomerProfile)
            .AsQueryable();

        if (!string.IsNullOrEmpty(status))
            q = q.Where(x => x.Status == status);

        var list = await q.OrderBy(x => x.ScheduledFor).ToListAsync();
        return list.Select(x => MapReminder(x)).ToList();
    }

    public async Task<ReminderResponse?> GetReminderByIdAsync(int id)
    {
        var reminder = await db.ScheduledReminders
            .Include(x => x.CustomerProfile)
            .Where(x => x.Id == id)
            .FirstOrDefaultAsync();
        return reminder is null ? null : MapReminder(reminder);
    }

    public async Task<ReminderResponse> CreateReminderAsync(CreateReminderRequest req)
    {
        var profileExists = await db.CustomerProfiles.AnyAsync(x => x.Id == req.CustomerProfileId);
        if (!profileExists)
            throw new InvalidOperationException("El perfil de cliente no existe.");

        var reminder = new ScheduledReminder
        {
            CustomerProfileId = req.CustomerProfileId,
            BookingId         = req.BookingId,
            ServiceLabel      = req.ServiceLabel.Trim(),
            ScheduledFor      = req.ScheduledFor,
            IntervalDays      = req.IntervalDays,
            MessageTemplate   = req.MessageTemplate?.Trim(),
            Status            = ReminderStatus.Pending
        };

        db.ScheduledReminders.Add(reminder);
        await db.SaveChangesAsync();

        return MapReminder(reminder, await db.CustomerProfiles.FindAsync(req.CustomerProfileId));
    }

    public async Task<ReminderResponse?> UpdateReminderAsync(int id, UpdateReminderRequest req)
    {
        var reminder = await db.ScheduledReminders
            .Include(x => x.CustomerProfile)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (reminder is null) return null;

        // No permitir editar un recordatorio ya enviado
        if (reminder.Status == ReminderStatus.Sent)
            throw new InvalidOperationException("No se puede editar un recordatorio ya enviado.");

        reminder.ServiceLabel    = req.ServiceLabel.Trim();
        reminder.ScheduledFor   = req.ScheduledFor.ToUniversalTime();
        reminder.IntervalDays   = req.IntervalDays;
        reminder.MessageTemplate = req.MessageTemplate?.Trim();
        reminder.Status         = req.Status;

        await db.SaveChangesAsync();
        return MapReminder(reminder);
    }

    public async Task<bool> CancelReminderAsync(int id)
    {
        var reminder = await db.ScheduledReminders.FindAsync(id);
        if (reminder is null) return false;
        if (reminder.Status == ReminderStatus.Sent) return false;

        reminder.Status = ReminderStatus.Cancelled;
        await db.SaveChangesAsync();
        return true;
    }

    // ── Mappers privados ──────────────────────────────────────

    private static CustomerProfileResponse MapProfile(CustomerProfile x) => new(
        x.Id, x.Phone, x.Name, x.Email, x.Notes,
        x.Birthday, x.Instagram, x.FavoriteProfessionalId,
        x.FavoriteProfessional is null ? null : $"{x.FavoriteProfessional.FirstName} {x.FavoriteProfessional.LastName}",
        x.PhotoUrls, x.CreatedAt
    );

    private static ReminderResponse MapReminder(ScheduledReminder x, CustomerProfile? profile = null)
    {
        var p = profile ?? x.CustomerProfile;
        return new(
            x.Id, x.CustomerProfileId,
            p?.Name ?? "", p?.Phone ?? "",
            x.BookingId, x.ServiceLabel,
            x.ScheduledFor, x.Status,
            x.IntervalDays, x.NextReminderDate,
            x.CreatedAt, x.SentAt
        );
    }

}
