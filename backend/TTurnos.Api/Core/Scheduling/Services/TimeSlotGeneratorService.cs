using Microsoft.EntityFrameworkCore;

namespace TTurnos.Api.Core.Scheduling;

public class TimeSlotGeneratorService
{
    private readonly ApplicationDbContext _context;

    public TimeSlotGeneratorService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task GenerateSlotsAsync()
    {
        var settings = await _context.BusinessSettings.FirstOrDefaultAsync();
        if (settings == null)
        {
            Console.WriteLine("⚠️ No hay configuración de negocio. Creá la configuración primero.");
            return;
        }

        var blockedDates = await _context.BlockedDates
            .Where(d => d.Date >= DateTime.Today)
            .Select(d => d.Date)
            .ToListAsync();

        var startDate = DateTime.Today.AddDays(1);
        var endDate = DateTime.Today.AddDays(settings.MaxDaysInAdvance);

        var slotsCreated = 0;

        for (var date = startDate; date <= endDate; date = date.AddDays(1))
        {
            // Verificar si es día laboral (DayOfWeek: 0=Dom, 1=Lun, ..., 6=Sáb)
            if (!settings.DaysOfWeek.Contains((int)date.DayOfWeek))
                continue;

            // Verificar si está bloqueado
            if (blockedDates.Contains(date.Date))
                continue;

            // Generar slots para este día
            var createdForDay = await GenerateSlotsForDayAsync(date, settings);
            slotsCreated += createdForDay;
        }

        await _context.SaveChangesAsync();
        Console.WriteLine($"✅ Generados {slotsCreated} turnos nuevos");
    }

    private async Task<int> GenerateSlotsForDayAsync(DateTime date, BusinessSettings settings)
    {
        var slotsCreated = 0;
        var currentTime = date.Date.Add(settings.StartTime);
        // var endTime = date.Date.Add(settings.EndTime);

        while (currentTime.Add(TimeSpan.FromMinutes(settings.SlotDuration)) <= currentTime.Add(settings.StartTime).Add(TimeSpan.FromHours(8)))
        {
            var slotStart = currentTime;
            var slotEnd = currentTime.Add(TimeSpan.FromMinutes(settings.SlotDuration));

            // Verificar si ya existe
            var exists = await _context.TimeSlots
                .AnyAsync(t => t.StartDateTime == slotStart);

            if (!exists)
            {
                _context.TimeSlots.Add(new TimeSlot
                {
                    StartDateTime = slotStart,
                    EndDateTime = slotEnd,
                    IsAvailable = true,
                    MaxBookings = 1
                });
                slotsCreated++;
            }

            // Avanzar al siguiente slot (duración + descanso)
            currentTime = slotEnd.Add(TimeSpan.FromMinutes(settings.BreakBetweenSlots));
        }

        return slotsCreated;
    }

    public async Task RegenerateAllSlotsAsync()
    {
        // Eliminar turnos futuros disponibles (no reservados)
        var futureSlots = await _context.TimeSlots
            .Where(t => t.StartDateTime > DateTime.Now && t.IsAvailable)
            .ToListAsync();

        _context.TimeSlots.RemoveRange(futureSlots);
        await _context.SaveChangesAsync();

        Console.WriteLine($"🗑️ Eliminados {futureSlots.Count} turnos disponibles");

        // Generar nuevos turnos
        await GenerateSlotsAsync();
    }

    public async Task CleanOldSlotsAsync()
    {
        // Eliminar turnos pasados (más de 7 días atrás)
        var oldDate = DateTime.Now.AddDays(-7);
        var oldSlots = await _context.TimeSlots
            .Where(t => t.StartDateTime < oldDate)
            .ToListAsync();

        _context.TimeSlots.RemoveRange(oldSlots);
        await _context.SaveChangesAsync();

        Console.WriteLine($"🧹 Limpiados {oldSlots.Count} turnos antiguos");
    }
}