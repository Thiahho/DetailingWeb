using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Core.Clients;

// Ejecuta el derecho de supresión como anonimización, no hard-delete: los
// Bookings quedan (registro de venta/turno), pero sin ningún dato que
// identifique a la persona. Mismo criterio en las 3 tablas con PII de
// cliente final (CustomerProfile, Booking, LoyaltySpin) — ninguna se borra,
// todas se anonimizan, para no perder historial operativo del negocio.
public class DataDeletionService(ApplicationDbContext db, CloudinaryAdminService cloudinary, ILogger<DataDeletionService> logger)
{
    private const string AnonymizedName = "Cliente eliminado";

    public async Task<DataDeletionRequestResponse> CreateRequestAsync(CreateDataDeletionRequest request)
    {
        var entity = new DataDeletionRequest
        {
            ContactName = request.ContactName.Trim(),
            ContactEmail = string.IsNullOrWhiteSpace(request.ContactEmail) ? null : request.ContactEmail.Trim().ToLowerInvariant(),
            ContactPhone = string.IsNullOrWhiteSpace(request.ContactPhone) ? null : request.ContactPhone.Trim(),
            Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
        };

        db.DataDeletionRequests.Add(entity);
        await db.SaveChangesAsync();
        return MapResponse(entity);
    }

    public async Task<List<DataDeletionRequestResponse>> GetRequestsAsync() =>
        await db.DataDeletionRequests
            .OrderByDescending(x => x.RequestedAt)
            .Select(x => new DataDeletionRequestResponse(
                x.Id, x.ContactName, x.ContactEmail, x.ContactPhone, x.Note,
                x.Status, x.RequestedAt, x.ResolvedAt, x.ResolutionNote))
            .ToListAsync();

    public async Task<DataDeletionRequestResponse?> RejectAsync(int id, int resolvedByUserId, string? resolutionNote)
    {
        var entity = await db.DataDeletionRequests.FindAsync(id);
        if (entity is null || entity.Status != DataDeletionRequestStatus.Pending) return null;

        entity.Status = DataDeletionRequestStatus.Rejected;
        entity.ResolvedAt = DateTime.UtcNow;
        entity.ResolvedByUserId = resolvedByUserId;
        entity.ResolutionNote = resolutionNote;

        await db.SaveChangesAsync();
        return MapResponse(entity);
    }

    public async Task<DataDeletionRequestResponse?> ConfirmAsync(int id, int resolvedByUserId, string? resolutionNote)
    {
        var entity = await db.DataDeletionRequests.FindAsync(id);
        if (entity is null || entity.Status != DataDeletionRequestStatus.Pending) return null;

        await AnonymizeMatchingDataAsync(entity.TenantId, entity.ContactEmail, entity.ContactPhone);

        entity.Status = DataDeletionRequestStatus.Confirmed;
        entity.ResolvedAt = DateTime.UtcNow;
        entity.ResolvedByUserId = resolvedByUserId;
        entity.ResolutionNote = resolutionNote;

        await db.SaveChangesAsync();
        return MapResponse(entity);
    }

    private async Task AnonymizeMatchingDataAsync(int tenantId, string? email, string? phone)
    {
        var profiles = await db.CustomerProfiles
            .Where(p => p.TenantId == tenantId &&
                ((email != null && p.Email != null && p.Email.ToLower() == email) ||
                 (phone != null && p.Phone == phone)))
            .ToListAsync();

        foreach (var profile in profiles)
        {
            await DestroyPhotosAsync(profile.PhotoUrls, profile.Id);
            profile.Name = AnonymizedName;
            profile.Phone = $"anonimizado-{profile.Id}";
            profile.Email = null;
            profile.Notes = null;
            profile.Birthday = null;
            profile.Instagram = null;
            profile.PhotoUrls = null;
        }

        var bookings = await db.Bookings
            .Where(b => b.TenantId == tenantId &&
                ((email != null && b.CustomerEmailNormalized == email) ||
                 (phone != null && b.CustomerPhone == phone)))
            .ToListAsync();

        foreach (var booking in bookings)
        {
            booking.CustomerName = AnonymizedName;
            booking.CustomerPhone = $"anonimizado-{booking.Id}";
            booking.Email = null;
            booking.CustomerEmailNormalized = $"anonimizado-{booking.Id}@anon.turneo.app";
        }

        if (phone != null)
        {
            var spins = await db.LoyaltySpins
                .Where(s => s.TenantId == tenantId && s.WhatsApp == phone)
                .ToListAsync();

            foreach (var spin in spins)
            {
                spin.CustomerName = AnonymizedName;
                spin.WhatsApp = $"anonimizado-{spin.Id}";
            }
        }

        if (email != null)
        {
            var accessCodes = await db.ClientAccessCodes
                .Where(c => c.TenantId == tenantId && c.Email.ToLower() == email)
                .ToListAsync();
            db.ClientAccessCodes.RemoveRange(accessCodes);
        }
    }

    private async Task DestroyPhotosAsync(string? photoUrlsJson, int profileId)
    {
        if (string.IsNullOrWhiteSpace(photoUrlsJson)) return;

        List<string> photoUrls;
        try { photoUrls = JsonSerializer.Deserialize<List<string>>(photoUrlsJson) ?? new(); }
        catch { photoUrls = new(); }

        foreach (var url in photoUrls)
        {
            var (deleted, error) = await cloudinary.TryDestroyAsync(url);
            if (!deleted)
                logger.LogWarning("[DataDeletion] No se pudo borrar {Url} de Cloudinary al anonimizar cliente {Id}: {Error}", url, profileId, error);
        }
    }

    private static DataDeletionRequestResponse MapResponse(DataDeletionRequest x) => new(
        x.Id, x.ContactName, x.ContactEmail, x.ContactPhone, x.Note,
        x.Status, x.RequestedAt, x.ResolvedAt, x.ResolutionNote);
}
