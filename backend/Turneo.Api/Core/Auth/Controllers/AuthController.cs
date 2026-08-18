using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;

namespace Turneo.Api.Core.Auth;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AuthService _authService;
    private readonly IConfiguration _configuration;

    public AuthController(AuthService authService, IConfiguration configuration)
    {
        _authService = authService;
        _configuration = configuration;
    }

    [HttpGet("client/identity-strategy")]
    [AllowAnonymous]
    [EnableRateLimiting("public-read")]
    public IActionResult GetClientIdentityStrategy()
    {
        var mode = _configuration["ClientIdentity:Mode"] ?? "MagicLinkOtp";
        return Ok(new
        {
            mode,
            options = new[]
            {
                new { key = "EmailPassword", description = "Ingreso por email y contraseña" },
                new { key = "MagicLinkOtp", description = "Acceso por link mágico/OTP" }
            }
        });
    }

    // POST: api/auth/login
    [HttpPost("login")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        try
        {
            var response = await _authService.LoginAsync(request);

            if (response == null)
                return Unauthorized(new { message = "Email o contraseña incorrectos" });

            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Expires = DateTime.UtcNow.AddHours(1),
                SameSite = SameSiteMode.None,
                Secure = true,
                Path="/"
            };

            // Admin sigue usando "admin_token". Profesionales usan "token" — un slot genérico
            // que los proxies de Next.js ya leen como fallback, sin tocar esos archivos.
            var cookieName = response.Role == "Professional" ? "token" : "admin_token";
            Response.Cookies.Append(cookieName, response.Token, cookieOptions);
            return Ok(new
            {
              email=response.Email,
              role=response.Role,
              professionalId=response.ProfessionalId,
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Auth] Error inesperado en login: {ex.Message}");
            return StatusCode(500, new { message = "Error al iniciar sesión" });
        }
    }

    // POST: api/auth/register
    [HttpPost("register")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        try
        {
            var response = await _authService.RegisterAsync(request);
            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception)
        {
            return StatusCode(500, new { message = "Error al crear el usuario" });
        }
    }

    // GET: api/auth/me (verificar token)
    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser()
    {
        var email = User.FindFirst(ClaimTypes.Email)?.Value;
        
        if (email == null)
            return Unauthorized();

        var user = await _authService.GetUserByEmailAsync(email);
        
        if (user == null)
            return NotFound();

        return Ok(new
        {
            id = user.Id,
            email = user.Email,
            role = user.Role,
            telegramChatId = user.TelegramChatId
        });
    }

    // POST: api/auth/telegram-chat-id (el propio usuario carga/borra su chat_id de Telegram)
    [Authorize]
    [HttpPost("telegram-chat-id")]
    public async Task<IActionResult> SetTelegramChatId([FromBody] SetTelegramChatIdRequest request)
    {
        var email = User.FindFirst(ClaimTypes.Email)?.Value;

        if (email == null)
            return Unauthorized();

        try
        {
            await _authService.SetTelegramChatIdAsync(email, request.TelegramChatId);
            return Ok(new { message = "Chat ID de Telegram actualizado" });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        Response.Cookies.Delete("admin_token");
        Response.Cookies.Delete("client_token");
        Response.Cookies.Delete("token");
        return Ok(new { message = "Sesión cerrada" });
    }

    // POST: api/auth/professional-account (admin activa/renueva el acceso de un profesional)
    [HttpPost("professional-account")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateProfessionalAccount([FromBody] CreateProfessionalAccountRequest request)
    {
        try
        {
            var response = await _authService.CreateProfessionalAccountAsync(request.ProfessionalId, request.Email, request.Password, request.Username);
            return Ok(new { email = response.Email, role = response.Role });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("client/access/request")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> RequestClientAccess([FromBody] ClientAccessRequest request)
    {
        try
        {
            var response = await _authService.RequestClientAccessAsync(request);
            if (!string.IsNullOrWhiteSpace(response.Token))
            {
                Response.Cookies.Append("client_token", response.Token, new CookieOptions
                {
                    HttpOnly = true,
                    Expires = response.ExpiresAt,
                    SameSite = SameSiteMode.None,
                    Secure = true,
                    Path = "/"
                });
            }

            return Ok(new { email = response.Email, role = response.Role, requiresOtp = response.Role == "ClientPendingOtp" });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("client/access/verify")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> VerifyClientAccess([FromBody] ClientOtpVerifyRequest request)
    {
        try
        {
            var response = await _authService.VerifyClientOtpAsync(request);
            Response.Cookies.Append("client_token", response.Token, new CookieOptions
            {
                HttpOnly = true,
                Expires = response.ExpiresAt,
                SameSite = SameSiteMode.None,
                Secure = true,
                Path = "/"
            });
            return Ok(new { email = response.Email, role = response.Role });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    [HttpPost("client/session/exchange")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public IActionResult ExchangeClientPortalToken([FromBody] ClientPortalTokenRequest request)
    {
        try
        {
            var response = _authService.ExchangeClientPortalToken(request.AccessToken);
            Response.Cookies.Append("client_token", response.Token, new CookieOptions
            {
                HttpOnly = true,
                Expires = response.ExpiresAt,
                SameSite = SameSiteMode.None,
                Secure = true,
                Path = "/"
            });
            return Ok(new { email = response.Email, role = response.Role });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }
    // POST: api/auth/change-password
    [Authorize]
    [HttpPost("change-password")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var email = User.FindFirst(ClaimTypes.Email)?.Value;
        
        if (email == null)
            return Unauthorized();

        try
        {
            await _authService.ChangePasswordAsync(email, request);
            return Ok(new { message = "Contraseña actualizada" });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}

// Password nulo/vacío = no tocar la contraseña actual (solo tiene sentido si la
// cuenta ya existe; CreateProfessionalAccountAsync exige password en el alta).
public record CreateProfessionalAccountRequest(int ProfessionalId, string Email, string? Password, string? Username = null);
public record SetTelegramChatIdRequest(string? TelegramChatId);
