using Microsoft.EntityFrameworkCore;
using Turneo.Api.Shared.Interfaces;

namespace Turneo.Api.Core.Insumos;

// Job diario (Hangfire, ver BackgroundJobsSetup): revisa insumos por debajo de
// su umbral de stock mínimo y avisa a los Admin del tenant — mismo criterio de
// destino (Email + Telegram de cada Admin) que NotificationService.TryNotifyAdminsAsync,
// pero sin pasar por el pipeline de templates de Booking (no aplica acá: no hay
// reserva, solo un aviso de stock).
public class LowStockAlertJob
{
    // A los 3 días seguidos sin reponer, se deja de insistir con el mismo
    // insumo — comparte canal (Telegram) con el aviso de turno nuevo, que es
    // el que hace ganar plata; no vale la pena arriesgar que lo silencien por
    // spam de tintura. Se vuelve a avisar si se repone y vuelve a caer.
    private const int MaxConsecutiveAlertDays = 3;

    private readonly ApplicationDbContext _context;
    private readonly ICurrentTenant _currentTenant;
    private readonly IEnumerable<INotificationProvider> _providers;
    private readonly ILogger<LowStockAlertJob> _logger;

    public LowStockAlertJob(
        ApplicationDbContext context,
        ICurrentTenant currentTenant,
        IEnumerable<INotificationProvider> providers,
        ILogger<LowStockAlertJob> logger)
    {
        _context = context;
        _currentTenant = currentTenant;
        _providers = providers;
        _logger = logger;
    }

    public async Task CheckLowStockAsync()
    {
        // Cross-tenant a propósito. Dos capas de aislamiento a saltear acá:
        // IgnoreQueryFilters() (EF) y SetBypass() → TenantSessionInterceptor
        // fija app.tenant_id='bypass', que la policy de RLS de cada tabla
        // reconoce explícitamente (ver migración EnableRowLevelSecurity). Sin
        // las dos, la query vuelve vacía para todos los tenants por igual —
        // no hay forma de notar la diferencia entre "no hay nada bajo mínimo"
        // y "el job no está viendo nada".
        _currentTenant.SetBypass();

        // Insumos que ya se repusieron desde que se los marcó en alerta —
        // reset del contador para que, si vuelven a caer, avisen desde el
        // primer día de nuevo (no arrastran el reloj viejo).
        var recovered = await _context.Insumos
            .IgnoreQueryFilters()
            .Where(i => i.LowStockAlertedSince != null && i.Stock > i.LowStockThreshold)
            .ToListAsync();
        foreach (var insumo in recovered)
            insumo.LowStockAlertedSince = null;
        if (recovered.Count > 0)
            await _context.SaveChangesAsync();

        var candidates = await _context.Insumos
            .IgnoreQueryFilters()
            .Where(i => i.IsActive && i.Stock <= i.LowStockThreshold)
            .OrderBy(i => i.Name)
            .ToListAsync();

        if (candidates.Count == 0) return;

        var now = DateTime.UtcNow;
        var toNotify = new List<Insumo>();
        foreach (var insumo in candidates)
        {
            if (insumo.LowStockAlertedSince == null)
            {
                insumo.LowStockAlertedSince = now;
                toNotify.Add(insumo);
            }
            else if ((now - insumo.LowStockAlertedSince.Value).TotalDays < MaxConsecutiveAlertDays)
            {
                toNotify.Add(insumo);
            }
            // Si ya pasaron MaxConsecutiveAlertDays sin reponer, se lo deja
            // afuera de este aviso — sigue "bajo mínimo" en /admin/insumos,
            // solo se corta el mensaje repetido.
        }
        await _context.SaveChangesAsync();

        if (toNotify.Count == 0) return;

        _logger.LogInformation("[Insumos] {Count} insumo(s) con poco stock a notificar en {TenantCount} tenant(s)",
            toNotify.Count, toNotify.Select(i => i.TenantId).Distinct().Count());

        foreach (var group in toNotify.GroupBy(i => i.TenantId))
        {
            try
            {
                await NotifyTenantAsync(group.Key, group.ToList());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Insumos] Error avisando stock bajo del tenant {TenantId}", group.Key);
            }
        }
    }

    private async Task NotifyTenantAsync(int tenantId, List<Insumo> items)
    {
        var admins = await _context.Users
            .IgnoreQueryFilters()
            .Where(u => u.Role == "Admin" && u.TenantId == tenantId)
            .Select(u => new { u.Email, u.TelegramChatId })
            .ToListAsync();

        if (admins.Count == 0) return;

        var lines = items.Select(i => $"- {i.Name}: quedan {i.Stock} (mínimo {i.LowStockThreshold})");
        var message = new NotificationMessage
        {
            Subject = "Insumos con poco stock",
            Body = $"Estos insumos están en o por debajo de su mínimo:\n\n{string.Join("\n", lines)}",
        };

        var emailProvider = _providers.FirstOrDefault(p => p.Channel == "Email");
        var telegramProvider = _providers.FirstOrDefault(p => p.Channel == "Telegram");

        foreach (var admin in admins)
        {
            if (emailProvider != null && !string.IsNullOrWhiteSpace(admin.Email))
            {
                var result = await emailProvider.SendToAddressAsync(admin.Email, message);
                if (!result.Success)
                    _logger.LogWarning("[Insumos] Email de stock bajo falló (tenant {TenantId}): {Error}", tenantId, result.Error);
            }

            if (telegramProvider != null && !string.IsNullOrWhiteSpace(admin.TelegramChatId))
            {
                var result = await telegramProvider.SendToAddressAsync(admin.TelegramChatId!, message);
                if (!result.Success)
                    _logger.LogWarning("[Insumos] Telegram de stock bajo falló (tenant {TenantId}): {Error}", tenantId, result.Error);
            }
        }

        _logger.LogInformation("[Insumos] Aviso de stock bajo enviado a {AdminCount} admin(s) del tenant {TenantId} ({ItemCount} insumo(s))",
            admins.Count, tenantId, items.Count);
    }
}
