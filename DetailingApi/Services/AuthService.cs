using DetailingApi.Data;
using DetailingApi.Models;
using DetailingApi.Models.DTOs;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BCrypt.Net;

namespace DetailingApi.Services;

public class AuthService
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;

    public AuthService(ApplicationDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    public async Task<LoginResponse?> LoginAsync(LoginRequest request)
    {
        // Buscar usuario por email
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email == request.Email);

        if (user == null)
            return null;

        // Verificar contraseña
        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return null;

        // Generar token JWT
        var token = GenerateJwtToken(user);
        var expiryMinutes = int.Parse(_configuration["Jwt:ExpiryMinutes"]!);

        return new LoginResponse
        {
            Token = token,
            Email = user.Email,
            Role = user.Role,
            ExpiresAt = DateTime.UtcNow.AddMinutes(expiryMinutes)
        };
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
        var token = GenerateJwtToken(user);
        var expiryMinutes = int.Parse(_configuration["Jwt:ExpiryMinutes"]!);

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

    private string GenerateJwtToken(User user)
    {
        var jwtKey = _configuration["Jwt:Key"];
        var key = Encoding.ASCII.GetBytes(jwtKey!);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role)
            }),
            Expires = DateTime.UtcNow.AddMinutes(int.Parse(_configuration["Jwt:ExpiryMinutes"]!)),
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
