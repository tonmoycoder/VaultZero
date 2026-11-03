/**
 * URL sanitisation for user-supplied links.
 *
 * A vault entry's URL is user data. It ends up in an `href`, in
 * `window.open`, and in a QR code. Anything that is not a plain web URL
 * must never reach those sinks:
 *
 *   - `javascript:` runs code in the page's origin when the link is
 *     clicked. The vault is a security product; it must not execute
 *     attacker-controlled script that came out of an imported CSV.
 *   - `data:` can carry an entire HTML document.
 *   - `file:`, `vbscript:` and friends are never legitimate here.
 *
 * The helper is deliberately strict: it returns a URL only when the scheme
 * is `http:` or `https:`. Everything else becomes `null`, and the caller
 * shows a message instead of opening a link.
 */

/** The only schemes a vault entry may link to. */
const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

/**
 * Normalises a stored URL into a safe, absolute `http(s)` URL.
 *
 * - A bare host such as `github.com` becomes `https://github.com`.
 * - An explicit `http://` or `https://` URL is kept.
 * - Anything with another scheme (`javascript:`, `data:`, `file:`, …) is
 *   rejected.
 * - A malformed URL is rejected.
 *
 * @returns the safe URL, or `null` when the input cannot be made safe.
 */
export function sanitizeVaultUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Reject control characters outright — they are used to smuggle a
  // scheme past naive prefix checks ("java\nscript:alert(1)").
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return null;

  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) return null;

  // A host is required. `https://` alone is not a link.
  if (!parsed.hostname) return null;

  return parsed.toString();
}

/**
 * Returns the hostname of a stored URL, for display purposes.
 *
 * Falls back to the raw string when the URL cannot be parsed, so the UI
 * always has something to show.
 */
export function displayHost(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const safe = sanitizeVaultUrl(trimmed);
  if (!safe) return trimmed;
  try {
    return new URL(safe).hostname.replace(/^www\./, "");
  } catch {
    return trimmed;
  }
}

/**
 * Returns the stored URL only if it is safe to hand to the user.
 *
 * Unlike {@link sanitizeVaultUrl} this does **not** rewrite the URL — a
 * bare `github.com` stays `github.com`. It only rejects a URL whose scheme
 * could execute or embed content, so copying it to the clipboard cannot
 * turn into running attacker-supplied code.
 */
export function isSafeVaultUrl(raw: string | null | undefined): boolean {
  if (typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return false;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return true; // no scheme
  const scheme = trimmed.slice(0, trimmed.indexOf(":")).toLowerCase();
  return scheme === "http" || scheme === "https";
}
