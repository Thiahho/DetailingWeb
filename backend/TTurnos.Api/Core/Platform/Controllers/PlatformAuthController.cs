using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;

namespace TTurnos.Api.Core.Platform;

[ApiController]
[Route("api/platform/auth")]
public class PlatformAuthController : ControllerBase
{
    private readonly PlatformAuthService _platformAuthService;

    public PlatformAuthController(PlatformAuthService platformAuthService)
    {
        _platformAuthService = platformAuthService;
    }

    // POST: api/platform/auth/login
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public IActionResult Login([FromBody] PlatformLoginRequest request)
    {
        var response = _platformAuthService.Login(request);

        if (response == null)
            return Unauthorized(new { message = "Email o contraseña incorrectos" });

        Response.Cookies.Append("platform_token", response.Token, new CookieOptions
        {
            HttpOnly = true,
            Expires = DateTime.UtcNow.AddHours(1),
            SameSite = SameSiteMode.None,
            Secure = true,
            Path = "/"
        });

        return Ok(new { email = response.Email, role = "PlatformOwner" });
    }

    // GET: api/platform/auth/me
    [Authorize(Roles = "PlatformOwner")]
    [HttpGet("me")]
    public IActionResult GetCurrentOwner()
    {
        var email = User.FindFirst(ClaimTypes.Email)?.Value;
        return Ok(new { email, role = "PlatformOwner" });
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        Response.Cookies.Delete("platform_token");
        return Ok(new { message = "Sesión cerrada" });
    }
}
