// using Turneo.Api.Data;
// using Turneo.Api.Models;
// using Microsoft.EntityFrameworkCore;

// namespace Turneo.Api.Services;

// public class DatabaseSeeder
// {
//     public static async Task SeedAsync(ApplicationDbContext context)
//     {
//         // Crear usuario admin si no existe
//         if (!await context.Users.AnyAsync())
//         {
//             var admin = new User
//             {
//                 Email = "admin@Turneo.com",
//                 PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!"), // ← FIX: Hashear correctamente
//                 Role = "Admin"
//             };
//             context.Users.Add(admin);
//             await context.SaveChangesAsync();
            
//             Console.WriteLine("✅ Usuario admin creado: admin@detailing.com / Admin123!");
//         }

//         // Crear configuración inicial si no existe
//         if (!await context.BusinessSettings.AnyAsync())
//         {
//             var settings = new BusinessSettings
//             {
//                 DaysOfWeek = new[] { 1, 2, 3, 4, 5 }, // Lun-Vie
//                 StartTime = new TimeSpan(9, 0, 0),
//                 // EndTime = new TimeSpan(19, 0, 0),
//                 SlotDuration = 120,
//                 BreakBetweenSlots = 15,
//                 MaxDaysInAdvance = 30
//             };
//             context.BusinessSettings.Add(settings);
//             await context.SaveChangesAsync();
            
//             Console.WriteLine("✅ Configuración inicial creada");
//         }
//     }
// }