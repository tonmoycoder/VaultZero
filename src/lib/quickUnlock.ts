/**
 * V-50 — Real, fail-closed quick unlock.
 *
 * The lock screen used to ship a "biometric simulation": it called
 * `createNewVault("MasterPass2026!")` / `unlockVault("MasterPass2026!")`
 * after an 850 ms timeout. That was both a *demo feature* and a critical
 * authentication bypass — anybody who could see the lock screen could open
 * (or create) the vault with a publicly known password.
 *
 * This module replaces it with a genuine WebAuthn gate:
 *
 *  - On an explicit, opt-in enrolment the platform authenticator creates a
 *    P-256 credential. Its public key is kept in memory.
 *  - The master password is encrypted with a fresh AES-GCM key that exists
 *    **only in module memory** (never in localStorage/sessionStorage, never
 *    on disk, never sent anywhere). The ciphertext is memory-only too.
 *  - Unlocking requires a fresh `navigator.credentials.get()` assertion. We
 *    verify the credential id, the challenge, the origin, the client-data
 *    type, and the ECDSA signature over `authenticatorData || SHA256(clientDataJSON)`
 *    against the enrolled public key. Only then is the master password
 *    decrypted and handed back for a normal `unlockVault()` call.
 *  - Anything that fails returns `null`. There is no fallback password, no
 *    simulated success, and no延时 timer that pretends to scan a fingerprint.
 *
 * Scope is honest: because the wrapping key lives only in JS memory, quick
 * unlock is available for the lifetime of this tab/session (including after
 * an auto-lock) and disappears on reload or app restart. A persistent
 * biometric unlock would need OS keystore support in the native runtime.
 */

type Enrolment = {
  credentialId: ArrayBuffer;
  publicKey: CryptoKey;
  wrapKey: CryptoKey;
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: ArrayBuffer;
};

let enrolment: Enrolment | null = null;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(length);
  const view = new Uint8Array(buffer);
  crypto.getRandomValues(view);
  return view;
}

/**
 * WebAuthn/CTAP2 returns P-256 signatures as ASN.1 DER
 * (`SEQUENCE { INTEGER r, INTEGER s }`), but WebCrypto's `verify` expects
 * the IEEE P1363 raw `r || s` form (two 32-byte integers). Without this
 * conversion a REAL authenticator assertion would always fail verification.
 * A raw 64-byte signature is passed through unchanged so software/test
 * authenticators keep working.
 */
function derSignatureToRaw(signature: BufferSource): Uint8Array<ArrayBuffer> {
  const bytes = signature instanceof ArrayBuffer
    ? new Uint8Array(signature)
    : new Uint8Array(signature.buffer, signature.byteOffset, signature.byteLength);
  const out = new Uint8Array(new ArrayBuffer(64));
  if (bytes.length === 64 || bytes[0] !== 0x30) {
    out.set(bytes.slice(0, 64));
    return out;
  }
  let offset = 1;
  const readLength = () => {
    let length = bytes[offset++];
    if (length & 0x80) {
      const count = length & 0x7f;
      length = 0;
      for (let i = 0; i < count; i += 1) length = length * 256 + bytes[offset++];
    }
    return length;
  };
  const copyInteger = (source: Uint8Array, start: number) => {
    let i = 0;
    while (i < source.length - 1 && source[i] === 0) i += 1;
    const trimmed = source.slice(i, i + 32);
    out.set(trimmed, start + 32 - trimmed.length);
  };
  readLength(); // SEQUENCE length
  if (bytes[offset++] !== 0x02) return out;
  const rLength = readLength();
  const r = bytes.slice(offset, offset + rLength);
  offset += rLength;
  if (bytes[offset++] !== 0x02) return out;
  const sLength = readLength();
  const s = bytes.slice(offset, offset + sLength);
  copyInteger(r, 0);
  copyInteger(s, 32);
  return out;
}

function webAuthnAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext !== false &&
    typeof crypto !== "undefined" &&
    typeof crypto.subtle !== "undefined" &&
    typeof PublicKeyCredential !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.credentials?.create === "function" &&
    typeof navigator.credentials?.get === "function"
  );
}

/** True only when a verified enrolment exists in this tab's memory. */
export function isQuickUnlockAvailable(): boolean {
  return enrolment !== null && webAuthnAvailable();
}

/** Wipe every secret held by this module. */
export function clearQuickUnlock(): void {
  if (enrolment) {
    // Best-effort zeroisation of the ciphertext buffer before dropping it.
    new Uint8Array(enrolment.ciphertext).fill(0);
    enrolment.iv.fill(0);
  }
  enrolment = null;
}

/**
 * Enrol a platform authenticator for this session. Requires a real user
 * gesture and a real authenticator; returns false (never throws) when the
 * device/browser cannot support it.
 */
export async function enrollQuickUnlock(masterPassword: string, displayName = "VaultZero Owner"): Promise<boolean> {
  clearQuickUnlock();
  if (!masterPassword || !webAuthnAvailable()) return false;

  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
      const platform = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!platform) return false;
    }

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32),
        rp: { name: "VaultZero" },
        user: {
          id: randomBytes(16),
          name: "vaultzero-local",
          displayName,
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256 / P-256
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "discouraged",
        },
        timeout: 60_000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;

    if (!credential) return false;
    const response = credential.response as AuthenticatorAttestationResponse;
    const publicKeyDer = response.getPublicKey?.();
    if (!publicKeyDer) return false;

    const publicKey = await crypto.subtle.importKey(
      "spki",
      publicKeyDer,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const wrapKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    const iv = randomBytes(12);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      wrapKey,
      encoder.encode(masterPassword),
    );

    enrolment = {
      credentialId: credential.rawId.slice(0),
      publicKey,
      wrapKey,
      iv,
      ciphertext,
    };
    return true;
  } catch {
    clearQuickUnlock();
    return false;
  }
}

/**
 * Perform a real platform-authenticator assertion and release the wrapped
 * master password. Returns `null` on ANY failure — there is no demo fallback.
 */
export async function quickUnlock(): Promise<string | null> {
  const current = enrolment;
  if (!current || !webAuthnAvailable()) return null;

  try {
    const challenge = randomBytes(32);
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ type: "public-key", id: current.credentialId.slice(0) }],
        userVerification: "required",
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    if (!assertion) return null;
    if (!equalBytes(new Uint8Array(assertion.rawId), new Uint8Array(current.credentialId))) return null;

    const response = assertion.response as AuthenticatorAssertionResponse;
    const clientData = JSON.parse(decoder.decode(response.clientDataJSON)) as {
      type?: string;
      challenge?: string;
      origin?: string;
    };
    if (clientData.type !== "webauthn.get") return null;
    if (!clientData.challenge || !equalBytes(base64UrlToBytes(clientData.challenge), challenge)) return null;
    if (typeof window !== "undefined" && clientData.origin !== window.location.origin) return null;

    const clientHash = await crypto.subtle.digest("SHA-256", response.clientDataJSON);
    const authData = new Uint8Array(response.authenticatorData);
    const signed = new Uint8Array(authData.length + clientHash.byteLength);
    signed.set(authData, 0);
    signed.set(new Uint8Array(clientHash), authData.length);

    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      current.publicKey,
      derSignatureToRaw(response.signature),
      signed,
    );
    if (!valid) return null;

    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: current.iv },
      current.wrapKey,
      current.ciphertext,
    );
    const password = decoder.decode(plaintext);
    return password || null;
  } catch {
    return null;
  }
}
