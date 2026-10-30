// Secure Domain & Official Logo Fetcher Engine
// Strict SSRF protection preventing access to local networks, loopback, or private IPs

const PRIVATE_IP_REGEX = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|0\.0\.0\.0|::1|fe80::)/i;
const VALID_HOSTNAME_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

export const iconCache = new Map<string, string | null>();

/**
 * Extracts a strictly validated public domain name from a URL or domain string.
 * Returns null if the domain is a private IP, loopback, or invalid.
 */
export function extractPublicDomain(urlOrDomain: string): string | null {
  if (!urlOrDomain || typeof urlOrDomain !== 'string') return null;

  let cleaned = urlOrDomain.trim();
  if (!cleaned) return null;

  // Prepend protocol if missing so URL parser works
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned;
  }

  try {
    const parsed = new URL(cleaned);
    const hostname = parsed.hostname.toLowerCase().trim();

    // Check for private / loopback IP address or localhost
    if (PRIVATE_IP_REGEX.test(hostname)) {
      return null;
    }

    // Must be a valid FQDN
    if (!VALID_HOSTNAME_REGEX.test(hostname)) {
      return null;
    }

    // Strip common subdomains like 'www.' or 'app.' for brand resolution
    const parts = hostname.split('.');
    if (parts.length > 2 && parts[0] === 'www') {
      return parts.slice(1).join('.');
    }

    return hostname;
  } catch {
    return null;
  }
}

/**
 * Returns the Google Official High-Res Favicon URL for a validated public domain.
 */
export function getOfficialLogoUrl(domain: string, size: 64 | 128 = 128): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

/**
 * Returns a fallback DuckDuckGo icon URL.
 */
export function getFallbackLogoUrl(domain: string): string {
  return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`;
}

/**
 * Extract human-readable brand label from domain (e.g., "google.com" -> "Google")
 */
export function getBrandNameFromDomain(domain: string): string {
  const parts = domain.split('.');
  const root = parts.length > 2 ? parts[parts.length - 2] : parts[0];
  if (!root) return domain;
  return root.charAt(0).toUpperCase() + root.slice(1);
}
