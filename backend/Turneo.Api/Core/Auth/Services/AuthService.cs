using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using BCrypt.Net;

namespace Turneo.Api.Core.Auth;

public class AuthService
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ICurrentTenant _currentTenant;
    private readonly IGoogleTokenValidator _googleTokenValidator;

    private const int MaxAccessCodeAttempts = 5;
    private const int SelfRegistrationMinPasswordLength = 8;

    public AuthService(ApplicationDbContext context, IConfiguration configuration, ICurrentTenant currentTenant, IGoogleTokenValidator googleTokenValidator)
    {
        _context = context;
        _configuration = configuration;
        _currentTenant = currentTenant;
        _googleTokenValidator = googleTokenValidator;
    }

    public async Task<LoginResponse?> LoginAsync(LoginRequest request)
    {
        // El campo "Email" del request puede ser un email o un username.
        var identifier = request.Email.Trim();
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email == identifier || u.Username == identifier);

        if (user == null)
            return null;

        // Verificar contraseña
        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return null;

        // Generar token JWT
        var expiryMinutes = int.Parse(_configuration["Jwt:ExpiryMinutes"]!);
        var token = GenerateJwtToken(user.Id, user.Email, user.Role, "admin_access", TimeSpan.FromMinutes(expiryMinutes), user.ProfessionalId);

        var hasPanelAccess = await HasPanelAccessAsync(user);

        return new LoginResponse
        {
            Token = token,
            Email = user.Email,
            Role = user.Role,
            ExpiresAt = DateTime.UtcNow.AddMinutes(expiryMinutes),
            ProfessionalId = user.ProfessionalId,
            HasPanelAccess = hasPanelAccess
        };
    }

    // Crea o actualiza la cuenta de acceso de un profesional (Role="Professional", ligada por ProfessionalId).
    // La usa el admin desde la ficha del profesional para "activar acceso" / cambiar su contraseña.
    public async Task<LoginResponse> CreateProfessionalAccountAsync(int professionalId, string email, string password, string? username = null)
    {
        var professional = await _context.Professionals.FindAsync(professionalId)
            ?? throw new ArgumentException("Profesional no encontrado");

        if (password.Length < 6)
            throw new ArgumentException("La contraseña debe tener al menos 6 caracteres");

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var normalizedUsername = string.IsNullOrWhiteSpace(username) ? null : username.Trim();

        var existingByEmail = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail);
        if (existingByEmail != null && existingByEmail.ProfessionalId != professionalId)
            throw new ArgumentException("Ese email ya está en uso por otra cuenta");

        if (normalizedUsername != null)
        {
            var existingByUsername = await _context.Users.FirstOrDefaultAsync(u => u.Username == normalizedUsername);
            if (existingByUsername != null && existingByUsername.ProfessionalId != professionalId)
                throw new ArgumentException("Ese usuario ya está en uso por otra cuenta");
        }

        var account = existingByEmail ?? await _context.Users.FirstOrDefaultAsync(u => u.ProfessionalId == professionalId && u.Role == "Professional");

        if (account == null)
        {
            account = new User { Role = "Professional", ProfessionalId = professionalId };
            _context.Users.Add(account);
        }

        account.Email = normalizedEmail;
        account.Username = normalizedUsername;
        account.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
        account.ProfessionalId = professionalId;
        await _context.SaveChangesAsync();

        return await BuildProfessionalLoginResponseAsync(account);
    }

    // Admin/Staff siempre tienen panel. Un profesional lo tiene solo si el admin
    // le otorgó algún módulo desde Permisos (ver PermissionsController).
    public async Task<bool> HasPanelAccessAsync(User user) =>
        user.Role is "Admin" or "Staff"
        || (user.Role == "Professional" && await _context.ModulePermissions.AnyAsync(p =>
            p.UserId == user.Id && (p.CanView || p.CanCreate || p.CanEdit || p.CanDelete)));

    private async Task<LoginResponse> BuildProfessionalLoginResponseAsync(User account)
    {
        var expiryMinutes = int.Parse(_configuration["Jwt:ExpiryMinutes"]!);
        return new LoginResponse
        {
            Token = GenerateJwtToken(account.Id, account.Email, "Professional", "admin_access", TimeSpan.FromMinutes(expiryMinutes), account.ProfessionalId),
            Email = account.Email,
            Role = "Professional",
            ExpiresAt = DateTime.UtcNow.AddMinutes(expiryMinutes),
            ProfessionalId = account.ProfessionalId,
            HasPanelAccess = await HasPanelAccessAsync(account)
        };
    }

    // ---- Auto-registro de profesionales (solo invitados) ----
    // El admin carga Professional.Email en la ficha; únicamente ese correo puede
    // crear la cuenta, por código + contraseña o por Google.

    // Ficha activa invitada con ese email y todavía sin cuenta. Null también si el
    // email ya lo usa otra cuenta del tenant (Users.Email es único por tenant).
    private async Task<Professional?> FindInvitedProfessionalAsync(string normalizedEmail)
    {
        var professional = await _context.Professionals.FirstOrDefaultAsync(p => p.IsActive && p.Email == normalizedEmail);
        if (professional == null)
            return null;

        var emailOrFichaTaken = await _context.Users.AnyAsync(u =>
            u.Email == normalizedEmail || (u.ProfessionalId == professional.Id && u.Role == "Professional"));
        return emailOrFichaTaken ? null : professional;
    }

    private async Task<User> CreateInvitedProfessionalUserAsync(Professional professional, string normalizedEmail, string passwordHash)
    {
        var account = new User
        {
            Email = normalizedEmail,
            PasswordHash = passwordHash,
            Role = "Professional",
            ProfessionalId = professional.Id
        };
        _context.Users.Add(account);
        await _context.SaveChangesAsync();
        return account;
    }

    // Devuelve el código a enviar por email, o null si el correo no está invitado
    // (el controller responde igual en ambos casos para no revelar qué emails lo están).
    public async Task<string?> RequestProfessionalRegistrationAsync(string email)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        if (await FindInvitedProfessionalAsync(normalizedEmail) == null)
            return null;

        var code = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
        _context.ClientAccessCodes.Add(new ClientAccessCode
        {
            Email = normalizedEmail,
            CodeHash = BCrypt.Net.BCrypt.HashPassword(code),
            ExpiresAt = DateTime.UtcNow.AddMinutes(15),
            Purpose = AccessCodePurposes.ProfessionalRegistration
        });
        await _context.SaveChangesAsync();
        return code;
    }

    // Valida el código y devuelve un token corto que habilita el paso siguiente (elegir contraseña).
    public async Task<string> VerifyProfessionalRegistrationCodeAsync(string email, string otpCode)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var entry = await _context.ClientAccessCodes
            .Where(c => c.Email == normalizedEmail
                && c.Purpose == AccessCodePurposes.ProfessionalRegistration
                && c.UsedAt == null
                && c.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(c => c.CreatedAt)
            .FirstOrDefaultAsync();

        if (entry == null || entry.FailedAttempts >= MaxAccessCodeAttempts)
            throw new UnauthorizedAccessException("Código inválido o expirado");

        if (!BCrypt.Net.BCrypt.Verify(otpCode.Trim(), entry.CodeHash))
        {
            entry.FailedAttempts++;
            await _context.SaveChangesAsync();
            throw new UnauthorizedAccessException("Código inválido o expirado");
        }

        entry.UsedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return GenerateJwtToken(0, normalizedEmail, "ProfessionalRegistration", "professional_registration", TimeSpan.FromMinutes(10));
    }

    public async Task<LoginResponse> CompleteProfessionalRegistrationAsync(ProfessionalRegistrationCompleteRequest request)
    {
        ClaimsPrincipal principal;
        try
        {
            principal = ValidateToken(request.RegistrationToken);
        }
        catch (Exception ex) when (ex is SecurityTokenException or ArgumentException)
        {
            throw new UnauthorizedAccessException("El registro expiró. Pedí un código nuevo.");
        }

        var email = principal.FindFirst(ClaimTypes.Email)?.Value;
        if (principal.FindFirst("token_type")?.Value != "professional_registration"
            || string.IsNullOrWhiteSpace(email)
            || principal.FindFirst("tenant_id")?.Value != _currentTenant.TenantId.ToString())
            throw new UnauthorizedAccessException("El registro expiró. Pedí un código nuevo.");

        if (request.Password != request.ConfirmPassword)
            throw new ArgumentException("Las contraseñas no coinciden");

        if (request.Password.Length < SelfRegistrationMinPasswordLength)
            throw new ArgumentException($"La contraseña debe tener al menos {SelfRegistrationMinPasswordLength} caracteres");

        // Se vuelve a chequear: entre el código y este paso el admin pudo quitar la
        // invitación o crearle la cuenta a mano.
        var professional = await FindInvitedProfessionalAsync(email)
            ?? throw new ArgumentException("Esta cuenta ya fue activada o la invitación ya no está vigente");

        var account = await CreateInvitedProfessionalUserAsync(professional, email, BCrypt.Net.BCrypt.HashPassword(request.Password));
        return await BuildProfessionalLoginResponseAsync(account);
    }

    // Login con Google: entra si ya existe la cuenta de profesional con ese correo,
    // o la crea si el correo está invitado. Cualquier otro caso se rechaza.
    public async Task<LoginResponse> LoginProfessionalWithGoogleAsync(string idToken)
    {
        var identity = await _googleTokenValidator.ValidateAsync(idToken);
        if (identity == null || !identity.EmailVerified || string.IsNullOrWhiteSpace(identity.Email))
            throw new UnauthorizedAccessException("No se pudo validar tu cuenta de Google");

        var email = identity.Email.Trim().ToLowerInvariant();

        var account = await _context.Users.FirstOrDefaultAsync(u => u.Email == email && u.Role == "Professional");
        if (account == null)
        {
            var professional = await FindInvitedProfessionalAsync(email)
                ?? throw new UnauthorizedAccessException("Tu correo no está invitado. Pedile al administrador que lo cargue en tu ficha.");

            // Contraseña aleatoria inutilizable: esta cuenta entra solo por Google
            // hasta que el admin le defina una desde la ficha.
            account = await CreateInvitedProfessionalUserAsync(professional, email, BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString()));
        }

        return await BuildProfessionalLoginResponseAsync(account);
    }

    // Crea una cuenta Staff (empleado/encargado con acceso limitado por permisos —
    // ver Core/Roles). A diferencia del profesional, no está ligada a una ficha.
    public async Task<User> CreateStaffAccountAsync(string email, string password, string? username = null)
    {
        if (password.Length < 6)
            throw new ArgumentException("La contraseña debe tener al menos 6 caracteres");

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var normalizedUsername = string.IsNullOrWhiteSpace(username) ? null : username.Trim();

        if (await _context.Users.AnyAsync(u => u.Email == normalizedEmail))
            throw new ArgumentException("Ese email ya está en uso");

        if (normalizedUsername != null && await _context.Users.AnyAsync(u => u.Username == normalizedUsername))
            throw new ArgumentException("Ese usuario ya está en uso");

        var user = new User
        {
            Email = normalizedEmail,
            Username = normalizedUsername,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = "Staff"
        };
        _context.Users.Add(user);
        await _context.SaveChangesAsync();
        return user;
    }

    public async Task ChangeStaffPasswordAsync(int userId, string newPassword)
    {
        if (newPassword.Length < 6)
            throw new ArgumentException("La contraseña debe tener al menos 6 caracteres");

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId && u.Role == "Staff")
            ?? throw new ArgumentException("Usuario no encontrado");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        await _context.SaveChangesAsync();
    }

    public async Task<LoginResponse?> RegisterAsync(RegisterRequest request)
    {
        // Validar contraseñas
        if (request.Password != request.ConfirmPassword)
            throw new ArgumentException("Las contraseñas no coinciden");

        // Verificar si el email ya existe
        if (await _context.Users.AnyAsync(u => u.Email == request.Email))
            throw new ArgumentException("El email ya está registrado");

        // Validar complejidad de contraseña
        if (request.Password.Length < 6)
            throw new ArgumentException("La contraseña debe tener al menos 6 caracteres");

        // Crear usuario
        var user = new User
        {
            Email = request.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = "Admin"
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        // Generar token
        var expiryMinutes = int.Parse(_configuration["Jwt:ExpiryMinutes"]!);
        var token = GenerateJwtToken(user.Id, user.Email, user.Role, "admin_access", TimeSpan.FromMinutes(expiryMinutes));

        return new LoginResponse
        {
            Token = token,
            Email = user.Email,
            Role = user.Role,
            ExpiresAt = DateTime.UtcNow.AddMinutes(expiryMinutes)
        };
    }

    public async Task<User?> GetUserByEmailAsync(string email)
    {
        return await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
    }

    // El propio usuario logueado carga/borra su chat_id de Telegram (aviso de turno nuevo
    // para profesionales, ver NotificationService.TryNotifyProfessionalAsync).
    public async Task SetTelegramChatIdAsync(string email, string? telegramChatId)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email)
            ?? throw new UnauthorizedAccessException("Usuario no autorizado");

        user.TelegramChatId = string.IsNullOrWhiteSpace(telegramChatId) ? null : telegramChatId.Trim();
        await _context.SaveChangesAsync();
    }

    // El admin carga/borra el chat_id de Telegram de un profesional desde su ficha,
    // sin depender de que el profesional entre a /profesional/cuenta a cargarlo él mismo.
    // Requiere que el profesional ya tenga cuenta activada (ver CreateProfessionalAccountAsync).
    public async Task SetTelegramChatIdForProfessionalAsync(int professionalId, string? telegramChatId)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.ProfessionalId == professionalId && u.Role == "Professional")
            ?? throw new ArgumentException("El profesional no tiene una cuenta de acceso activada todavía");

        user.TelegramChatId = string.IsNullOrWhiteSpace(telegramChatId) ? null : telegramChatId.Trim();
        await _context.SaveChangesAsync();
    }

    // El propio usuario logueado cambia su email de acceso (login). La sesión actual
    // sigue con el email viejo en el JWT hasta que vuelva a loguearse — mismo criterio
    // que ChangePasswordAsync, que tampoco reemite el token.
    public async Task UpdateOwnEmailAsync(string currentEmail, string newEmail)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == currentEmail)
            ?? throw new UnauthorizedAccessException("Usuario no autorizado");

        var normalizedEmail = newEmail.Trim().ToLowerInvariant();
        if (normalizedEmail == user.Email)
            return;

        var existing = await _context.Users.AnyAsync(u => u.Email == normalizedEmail);
        if (existing)
            throw new ArgumentException("Ese email ya está en uso por otra cuenta");

        user.Email = normalizedEmail;
        await _context.SaveChangesAsync();
    }

    public async Task ChangePasswordAsync(string email, ChangePasswordRequest request)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);

        if (user == null)
            throw new UnauthorizedAccessException("Usuario no autorizado");

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
            throw new UnauthorizedAccessException("La contraseña actual es incorrecta");

        ValidateNewPasswordPolicy(request);

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _context.SaveChangesAsync();
    }

    private static void ValidateNewPasswordPolicy(ChangePasswordRequest request)
    {
        if (request.NewPassword != request.ConfirmNewPassword)
            throw new ArgumentException("Las contraseñas nuevas no coinciden");

        if (request.NewPassword.Length < 6)
            throw new ArgumentException("La nueva contraseña debe tener al menos 6 caracteres");

        if (request.NewPassword == request.CurrentPassword)
            throw new ArgumentException("La nueva contraseña debe ser diferente a la actual");
    }

    public async Task<LoginResponse> RequestClientAccessAsync(ClientAccessRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("Email requerido");

        var mode = _configuration["ClientIdentity:Mode"] ?? "MagicLinkOtp";
        var hasBooking = await _context.Bookings.AnyAsync(b => b.CustomerEmailNormalized == email || (b.Email ?? "").ToLower() == email);
        if (!hasBooking)
            throw new UnauthorizedAccessException("No encontramos reservas para ese email");

        if (string.Equals(mode, "EmailPassword", StringComparison.OrdinalIgnoreCase))
        {
            var client = await _context.Users.FirstOrDefaultAsync(u => u.Email == email && u.Role == "Client");
            if (client == null || string.IsNullOrWhiteSpace(request.Password) || !BCrypt.Net.BCrypt.Verify(request.Password, client.PasswordHash))
                throw new UnauthorizedAccessException("Credenciales inválidas");

            var expiryMinutes = int.Parse(_configuration["Jwt:ExpiryMinutes"]!);
            return new LoginResponse
            {
                Token = GenerateJwtToken(client.Id, client.Email, "Client", "client_access", TimeSpan.FromMinutes(expiryMinutes)),
                Email = client.Email,
                Role = "Client",
                ExpiresAt = DateTime.UtcNow.AddMinutes(expiryMinutes)
            };
        }

        var code = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
        _context.ClientAccessCodes.Add(new ClientAccessCode
        {
            Email = email,
            CodeHash = BCrypt.Net.BCrypt.HashPassword(code),
            ExpiresAt = DateTime.UtcNow.AddMinutes(15)
        });
        await _context.SaveChangesAsync();

        return new LoginResponse
        {
            Token = string.Empty,
            Email = email,
            Role = "ClientPendingOtp",
            ExpiresAt = DateTime.UtcNow.AddMinutes(15),
            PendingOtpCode = code
        };
    }

    public async Task<LoginResponse> VerifyClientOtpAsync(ClientOtpVerifyRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var otp = request.OtpCode.Trim();
        var entry = await _context.ClientAccessCodes
            .Where(c => c.Email == email && c.Purpose == AccessCodePurposes.ClientAccess && c.UsedAt == null && c.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(c => c.CreatedAt)
            .FirstOrDefaultAsync();

        if (entry == null || !BCrypt.Net.BCrypt.Verify(otp, entry.CodeHash))
            throw new UnauthorizedAccessException("OTP inválido o expirado");

        entry.UsedAt = DateTime.UtcNow;
        var client = await EnsureClientUserAsync(email);
        var expiryMinutes = int.Parse(_configuration["Jwt:ExpiryMinutes"]!);
        await _context.SaveChangesAsync();

        return new LoginResponse
        {
            Token = GenerateJwtToken(client.Id, email, "Client", "client_access", TimeSpan.FromMinutes(expiryMinutes)),
            Email = email,
            Role = "Client",
            ExpiresAt = DateTime.UtcNow.AddMinutes(expiryMinutes)
        };
    }

    // tenantId explícito (no ambiental): esto lo llaman también background jobs
    // (recordatorios) que procesan reservas de todos los tenants, sin un tenant
    // "actual" de request al que puedan apoyarse.
    public string CreateClientPortalAccessToken(string email, int tenantId)
    {
        return GenerateJwtToken(0, email.ToLowerInvariant(), "ClientPortal", "booking_access", TimeSpan.FromDays(7), tenantId: tenantId);
    }

    public LoginResponse ExchangeClientPortalToken(string accessToken)
    {
        var principal = ValidateToken(accessToken);
        var tokenType = principal.FindFirst("token_type")?.Value;
        var email = principal.FindFirst(ClaimTypes.Email)?.Value;
        var tenantIdClaim = principal.FindFirst("tenant_id")?.Value;

        if (tokenType != "booking_access" || string.IsNullOrWhiteSpace(email) || !int.TryParse(tenantIdClaim, out var tenantId))
            throw new UnauthorizedAccessException("Token inválido");

        var expiryMinutes = int.Parse(_configuration["Jwt:ExpiryMinutes"]!);
        return new LoginResponse
        {
            // Preserva el tenant del token original, no el de la request de intercambio.
            Token = GenerateJwtToken(0, email, "Client", "client_access", TimeSpan.FromMinutes(expiryMinutes), tenantId: tenantId),
            Email = email,
            Role = "Client",
            ExpiresAt = DateTime.UtcNow.AddMinutes(expiryMinutes)
        };
    }

    private async Task<User> EnsureClientUserAsync(string email)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email && u.Role == "Client");
        if (user != null) return user;

        user = new User
        {
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString()),
            Role = "Client"
        };
        _context.Users.Add(user);
        return user;
    }

    private ClaimsPrincipal ValidateToken(string token)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var validationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.ASCII.GetBytes(_configuration["Jwt:Key"]!)),
            ValidateIssuer = true,
            ValidIssuer = _configuration["Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = _configuration["Jwt:Audience"],
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };

        return tokenHandler.ValidateToken(token, validationParameters, out _);
    }

    private string GenerateJwtToken(int userId, string email, string role, string tokenType, TimeSpan expiresIn, int? professionalId = null, int? tenantId = null)
    {
        var jwtKey = _configuration["Jwt:Key"];
        var key = Encoding.ASCII.GetBytes(jwtKey!);

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Email, email),
            new Claim(ClaimTypes.Role, role),
            new Claim("token_type", tokenType),
            new Claim("tenant_id", (tenantId ?? _currentTenant.TenantId).ToString())
        };
        if (professionalId.HasValue)
            claims.Add(new Claim("professional_id", professionalId.Value.ToString()));

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.Add(expiresIn),
            Issuer = _configuration["Jwt:Issuer"],
            Audience = _configuration["Jwt:Audience"],
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key),
                SecurityAlgorithms.HmacSha256Signature)
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }
}
