/**
 * RFC 6238 Time-Based One-Time Password (TOTP) & RFC 4226 HOTP Engine
 * Implemented using WebCrypto SubtleCrypto (100% offline, zero-network).
 */

export interface TotpConfig {
  secret: string;
  algorithm?: "SHA-1" | "SHA-256" | "SHA-512";
  digits?: 6 | 8;
  period?: number;
  label?: string;
  issuer?: string;
}

export interface TotpResult {
  code: string;
  rawCode: string;
  remaining: number;
  progress: number;
  period: number;
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Validates Google Authenticator Base32 Setup Secret.
 * Enforces RFC 4226 / RFC 6238 standard:
 * - Only A-Z and 2-7
 * - Strips whitespace and dashes
 * - Minimum 16 characters (80-bit key)
 */
export interface SecretValidationResult {
  valid: boolean;
  cleanKey: string;
  error?: string;
}

export function validateGoogleAuthSecret(
  rawSecret: string,
  lang: "en" | "bn" = "en"
): SecretValidationResult {
  if (!rawSecret || !rawSecret.trim()) {
    return {
      valid: false,
      cleanKey: "",
      error:
        lang === "bn"
          ? "সেটআপ কি (Setup key) খালি রাখা যাবে না।"
          : "Setup key / Secret key is required.",
    };
  }

  const cleanKey = rawSecret.replace(/[\s-]/g, "").toUpperCase();

  if (!/^[A-Z2-7]+=*$/.test(cleanKey)) {
    return {
      valid: false,
      cleanKey,
      error:
        lang === "bn"
          ? "❌ অকার্যকর সেটআপ কি! শুধুমাত্র Base32 অক্ষর (A-Z এবং 2-7) গ্রহণযোগ্য।"
          : "❌ Invalid characters! Only valid Base32 characters (A-Z and 2-7) are allowed.",
    };
  }

  const unpadded = cleanKey.replace(/=+$/, "");
  if (unpadded.length < 16) {
    return {
      valid: false,
      cleanKey,
      error:
        lang === "bn"
          ? `❌ অকার্যকর সেটআপ কি! Google Authenticator-এর নিয়ম অনুযায়ী কমপক্ষে ১৬ অক্ষরের বৈধ Base32 Secret Key দিতে হবে (বর্তমানে ${unpadded.length} অক্ষর)।`
          : `❌ Invalid setup key! Google Authenticator requires at least 16 Base32 characters (currently ${unpadded.length}).`,
    };
  }

  try {
    decodeBase32(cleanKey);
    return { valid: true, cleanKey };
  } catch (err: any) {
    return {
      valid: false,
      cleanKey,
      error:
        lang === "bn"
          ? "❌ Base32 ডিকোড ব্যর্থ হয়েছে। অনুগ্রহ করে সঠিক সিক্রেট কি দিন।"
          : `❌ Base32 decoding failed: ${err?.message || "Invalid format"}`,
    };
  }
}

/**
 * Decodes standard RFC 4648 Base32 strings (ignoring whitespace, hyphens and case).
 */
export function decodeBase32(input: string): Uint8Array {
  const clean = input.replace(/[\s-]/g, "").toUpperCase();
  let bits = 0;
  let bitCount = 0;
  const output: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === "=") break;
    const val = BASE32_ALPHABET.indexOf(ch);
    if (val === -1) {
      throw new Error(`Invalid base32 character: ${ch}`);
    }

    bits = (bits << 5) | val;
    bitCount += 5;

    if (bitCount >= 8) {
      bitCount -= 8;
      output.push((bits >> bitCount) & 0xff);
    }
  }

  return new Uint8Array(output);
}

/**
 * Parses standard otpauth://totp/... URI.
 */
export function parseOtpAuthUri(uri: string): TotpConfig {
  const clean = uri.trim();
  if (!clean.startsWith("otpauth://totp/")) {
    throw new Error("Invalid otpauth URI: must start with otpauth://totp/");
  }

  const url = new URL(clean);
  const pathLabel = decodeURIComponent(url.pathname.replace(/^\/+/g, ""));
  let label = pathLabel;
  let issuer = url.searchParams.get("issuer") || undefined;

  if (pathLabel.includes(":")) {
    const parts = pathLabel.split(":");
    issuer = issuer || parts[0].trim();
    label = parts.slice(1).join(":").trim();
  }

  const secret = url.searchParams.get("secret");
  if (!secret) {
    throw new Error("Missing required 'secret' parameter in otpauth URI");
  }

  // V-94: an otpauth URI is only as trustworthy as the Base32 key inside it.
  // A bare URL parse used to accept `secret=abc`, so a random short input was
  // treated as a valid 2FA account and produced a bogus code from a one-byte
  // HMAC key. Apply the same RFC 6238 rule as a pasted setup key, fail closed.
  const checked = validateGoogleAuthSecret(secret);
  if (!checked.valid) {
    throw new Error(checked.error || "Invalid Base32 secret in otpauth URI");
  }

  const algoRaw = url.searchParams.get("algorithm")?.toUpperCase();
  let algorithm: "SHA-1" | "SHA-256" | "SHA-512" = "SHA-1";
  if (algoRaw === "SHA256" || algoRaw === "SHA-256") algorithm = "SHA-256";
  else if (algoRaw === "SHA512" || algoRaw === "SHA-512") algorithm = "SHA-512";

  const digitsRaw = Number(url.searchParams.get("digits"));
  const digits: 6 | 8 = digitsRaw === 8 ? 8 : 6;

  const periodRaw = Number(url.searchParams.get("period"));
  const period = periodRaw >= 15 && periodRaw <= 120 ? periodRaw : 30;

  return {
    secret: checked.cleanKey,
    algorithm,
    digits,
    period,
    label,
    issuer,
  };
}

/**
 * Computes RFC 6238 TOTP code using WebCrypto SubtleCrypto HMAC.
 */
export async function generateTotp(
  secretOrConfig: string | TotpConfig,
  customEpochSecs?: number
): Promise<TotpResult> {
  const config: TotpConfig =
    typeof secretOrConfig === "string" ? { secret: secretOrConfig } : secretOrConfig;

  const algorithm = config.algorithm || "SHA-1";
  const digits = config.digits || 6;
  const period = config.period || 30;

  const nowSecs = customEpochSecs !== undefined ? customEpochSecs : Math.floor(Date.now() / 1000);
  const counter = Math.floor(nowSecs / period);
  const remaining = period - (nowSecs % period);
  const progress = (period - remaining) / period;

  const keyBytes = decodeBase32(config.secret);

  // Big-endian 8-byte counter buffer
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  // Upper 32 bits (zero for normal Unix timestamps up to year 2038+)
  counterView.setUint32(0, Math.floor(counter / 0x100000000), false);
  counterView.setUint32(4, counter & 0xffffffff, false);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
    { name: "HMAC", hash: { name: algorithm } },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, counterBuffer);
  const hashBytes = new Uint8Array(signature);

  // Dynamic truncation (RFC 4226 Section 5.4)
  const offset = hashBytes[hashBytes.length - 1] & 0x0f;
  const binaryCode =
    ((hashBytes[offset] & 0x7f) << 24) |
    ((hashBytes[offset + 1] & 0xff) << 16) |
    ((hashBytes[offset + 2] & 0xff) << 8) |
    (hashBytes[offset + 3] & 0xff);

  const modulus = Math.pow(10, digits);
  const rawCode = (binaryCode % modulus).toString().padStart(digits, "0");

  // Format with space in middle for easy readability
  let formattedCode = rawCode;
  if (digits === 6) {
    formattedCode = `${rawCode.slice(0, 3)} ${rawCode.slice(3)}`;
  } else if (digits === 8) {
    formattedCode = `${rawCode.slice(0, 4)} ${rawCode.slice(4)}`;
  }

  return {
    code: formattedCode,
    rawCode,
    remaining,
    progress,
    period,
  };
}


/**
 * V-60: `VaultItem.totp` stores the **TOTP setup secret** (Base32 or an
 * `otpauth://` URI), never a displayed code. The old default vault shipped
 * static strings like "839 201" which are not valid Base32, so the
 * authenticator could never generate a real one-time code from them.
 */
export function isValidTotpSecret(secret: string | undefined | null): boolean {
  if (!secret || typeof secret !== "string") return false;
  const value = secret.trim();
  if (value.startsWith("otpauth://totp/")) {
    try {
      parseOtpAuthUri(value);
      return true;
    } catch {
      return false;
    }
  }
  return validateGoogleAuthSecret(value).valid;
}

/** Turns a stored secret (Base32 or otpauth URI) into a TotpConfig. */
export function resolveTotpConfig(secret: string): TotpConfig {
  const value = secret.trim();
  if (value.startsWith("otpauth://totp/")) return parseOtpAuthUri(value);
  return { secret: validateGoogleAuthSecret(value).cleanKey };
}
