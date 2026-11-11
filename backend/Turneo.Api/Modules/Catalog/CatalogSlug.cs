using System.Globalization;
using System.Text;

namespace Turneo.Api.Modules.Catalog;

public static class CatalogSlug
{
    // "Remera Básica 2.40" → "remera-basica-2-40": strips accents, keeps
    // [a-z0-9-] and cuts at maxLength without leaving a trailing dash.
    public static string From(string text, int maxLength)
    {
        var normalized = text.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        var lastDash = true;
        foreach (var ch in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark) continue;
            var c = char.ToLowerInvariant(ch);
            if (c is >= 'a' and <= 'z' or >= '0' and <= '9')
            {
                sb.Append(c);
                lastDash = false;
            }
            else if (!lastDash)
            {
                sb.Append('-');
                lastDash = true;
            }
        }

        var slug = sb.ToString();
        if (slug.Length > maxLength) slug = slug[..maxLength];
        return slug.TrimEnd('-');
    }
}
