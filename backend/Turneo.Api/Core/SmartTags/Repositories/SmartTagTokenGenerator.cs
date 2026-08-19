using System.Security.Cryptography;

namespace Turneo.Api.Core.SmartTags;

// Crockford Base32 sin 0/O/1/I/L (ambiguos visualmente), 12 caracteres:
// no secuencial, no predecible (docs/NFC.md sección 11).
public static class SmartTagTokenGenerator
{
    private const string Alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    private const int Length = 12;

    public static string Generate() => RandomNumberGenerator.GetString(Alphabet, Length);
}
