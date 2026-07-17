using Microsoft.EntityFrameworkCore;

namespace TTurnos.Api.Core.Notifications;

public class ReminderService(ApplicationDbContext db)
{
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

    // El admin mandó el aviso a mano (WhatsApp/email personal) en vez de esperar
    // al envío automático — lo marca Sent para que el job recurrente no lo
    // vuelva a mandar por su cuenta más tarde.
    public async Task<bool> MarkSentAsync(int id)
    {
        var reminder = await db.ScheduledReminders.FindAsync(id);
        if (reminder is null) return false;
        if (reminder.Status != ReminderStatus.Pending && reminder.Status != ReminderStatus.Failed) return false;

        reminder.Status = ReminderStatus.Sent;
        reminder.SentAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }

    private static ReminderResponse MapReminder(ScheduledReminder x, CustomerProfile? profile = null)
    {
        var p = profile ?? x.CustomerProfile;
        return new(
            x.Id, x.CustomerProfileId,
            p?.Name ?? "", p?.Phone ?? "", p?.Email,
            x.BookingId, x.ServiceLabel,
            x.ScheduledFor, x.Status,
            x.IntervalDays, x.NextReminderDate,
            x.CreatedAt, x.SentAt
        );
    }
}
