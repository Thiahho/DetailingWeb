import { describe, expect, it } from "vitest";
import { clientRateLimitKey, getClientIp, ipRateLimitKey } from "@/src/lib/clientIp";

describe("getClientIp", () => {
  it("uses the first x-forwarded-for entry", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": " 200.1.2.3 , 10.0.0.1" }))).toBe("200.1.2.3");
  });

  it("falls back to x-real-ip", () => {
    expect(getClientIp(new Headers({ "x-real-ip": " 200.1.2.4 " }))).toBe("200.1.2.4");
  });

  it("returns a shared key when no header is present", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
    expect(getClientIp(new Headers({ "x-forwarded-for": " , " }))).toBe("unknown");
  });
});

describe("ipRateLimitKey", () => {
  it("keeps IPv4 addresses as they are", () => {
    expect(ipRateLimitKey("200.1.2.3")).toBe("200.1.2.3");
  });

  it("keys IPv6 addresses by their /64 prefix", () => {
    const a = ipRateLimitKey("2800:810:4a1:1a2b:1111:2222:3333:4444");
    expect(a).toBe("2800:810:4a1:1a2b::/64");
    expect(ipRateLimitKey("2800:0810:04a1:1a2b:ffff::1")).toBe(a);
    expect(ipRateLimitKey("2800:810:4a1:1a2c::1")).not.toBe(a);
  });

  it("expands compressed IPv6 forms before taking the prefix", () => {
    expect(ipRateLimitKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(ipRateLimitKey("::1")).toBe("0:0:0:0::/64");
    expect(ipRateLimitKey("[2001:DB8::1]")).toBe("2001:db8:0:0::/64");
    expect(ipRateLimitKey("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
  });

  it("treats IPv4-mapped IPv6 addresses as IPv4", () => {
    expect(ipRateLimitKey("::ffff:200.1.2.3")).toBe("200.1.2.3");
  });

  it("keeps unparseable values as their own key", () => {
    expect(ipRateLimitKey("1::2::3")).toBe("1::2::3");
    expect(ipRateLimitKey("unknown")).toBe("unknown");
  });
});

describe("clientRateLimitKey", () => {
  it("combines header resolution with prefix keying", () => {
    expect(clientRateLimitKey(new Headers({ "x-forwarded-for": "2800:810:4a1:1a2b::99, 10.0.0.1" }))).toBe("2800:810:4a1:1a2b::/64");
    expect(clientRateLimitKey(new Headers({ "x-real-ip": "200.1.2.4" }))).toBe("200.1.2.4");
  });
});
