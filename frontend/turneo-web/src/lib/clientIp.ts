/**
 * Client IP for per-IP limits in route handlers. Same resolution as `clientIpHeaders` in
 * src/lib/tenantHeader.ts: first `x-forwarded-for` entry, then `x-real-ip`.
 *
 * TRUST: the first `x-forwarded-for` entry is trusted only because Turneo deploys on Vercel,
 * whose edge overwrites these headers with the real visitor IP. Behind any other proxy or host
 * that appends instead of overwriting, a client can spoof it and pick its own rate-limit key.
 *
 * Requests without either header share the "unknown" key (they share one budget).
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

/** Rate-limit key for the request: the client IP, with IPv6 reduced to its /64 prefix. */
export function clientRateLimitKey(headers: Headers): string {
  return ipRateLimitKey(getClientIp(headers));
}

const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/;
const HEXTET = /^[0-9a-f]{1,4}$/;

/**
 * IPv4 addresses are kept as they are. IPv6 addresses are keyed by their /64 prefix, because one
 * subscriber usually owns a whole /64 and could otherwise rotate addresses to dodge the limit.
 * Values that do not parse as IPv6 are returned unchanged.
 */
export function ipRateLimitKey(ip: string): string {
  if (!ip.includes(":")) return ip;
  const addr = ip.replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();

  const mapped = addr.match(IPV4_MAPPED);
  if (mapped) return mapped[1];

  const parts = addr.split("::");
  if (parts.length > 2) return ip;
  const head = parts[0] ? parts[0].split(":") : [];
  let groups = head;
  if (parts.length === 2) {
    const tail = parts[1] ? parts[1].split(":") : [];
    const missing = 8 - head.length - tail.length;
    if (missing < 1) return ip;
    groups = [...head, ...Array<string>(missing).fill("0"), ...tail];
  }
  if (groups.length !== 8 || !groups.every((g) => HEXTET.test(g))) return ip;

  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}
