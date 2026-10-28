import dns from "node:dns/promises";

// Check whether an IP is private/loopback/link-local
export function isPrivateIp(ip: string): boolean {
  if (ip === "localhost" || ip === "::1" || ip === "0.0.0.0") return true;

  // IPv4 checks
  const ipv4Match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number);
    // 127.0.0.0/8 (Loopback)
    if (octets[0] === 127) return true;
    // 10.0.0.0/8 (Private)
    if (octets[0] === 10) return true;
    // 172.16.0.0/12 (Private)
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (octets[0] === 192 && octets[1] === 168) return true;
    // 169.254.0.0/16 (Link-local)
    if (octets[0] === 169 && octets[1] === 254) return true;
    // 0.0.0.0/8
    if (octets[0] === 0) return true;
  }

  // IPv6 private checks
  if (ip.startsWith("fc00:") || ip.startsWith("fd00:") || ip.startsWith("fe80:")) {
    return true;
  }

  return false;
}

export async function isSafeUrl(rawUrl: string): Promise<boolean> {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    if (isPrivateIp(hostname)) return false;

    // Resolve DNS to verify underlying IP
    const addresses = await dns.resolve4(hostname).catch(() => []);
    if (addresses.length === 0) {
      // Try IPv6
      const ipv6 = await dns.resolve6(hostname).catch(() => []);
      if (ipv6.length === 0) return false;
      for (const ip of ipv6) {
        if (isPrivateIp(ip)) return false;
      }
      return true;
    }

    for (const ip of addresses) {
      if (isPrivateIp(ip)) return false;
    }

    return true;
  } catch {
    return false;
  }
}
