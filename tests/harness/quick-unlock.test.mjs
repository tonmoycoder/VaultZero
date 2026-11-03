// V-50: the fake "biometric simulation" is gone. Quick unlock must be a
// REAL WebAuthn gate: enrolment creates a P-256 platform credential and
// unlocking verifies challenge, origin, credential id and the ECDSA
// signature (DER -> raw) before releasing the wrapped master password.
import { webcrypto } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const BUNDLE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".harness-build") + "/";
const ORIGIN = "https://vaultzero.test";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
Object.defineProperty(globalThis, "window", {
  value: { isSecureContext: true, location: { origin: ORIGIN } },
  configurable: true,
});
class FakePublicKeyCredential {}
FakePublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async () => platformAvailable;
globalThis.PublicKeyCredential = FakePublicKeyCredential;
if (typeof globalThis.atob !== "function" || typeof globalThis.btoa !== "function") {
  // Node 22 already provides these; the fallback keeps older CI runners sane.
  globalThis.atob = (value) => Buffer.from(value, "base64").toString("binary");
  globalThis.btoa = (value) => Buffer.from(value, "binary").toString("base64");
}

let platformAvailable = true;
const keyPair = await webcrypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"],
);
const spki = await webcrypto.subtle.exportKey("spki", keyPair.publicKey);
const credentialId = new Uint8Array(32).fill(7).buffer;

function base64Url(bytes) {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function toDer(raw) {
  const encInt = (bytes) => {
    const buf = Buffer.from(bytes);
    let i = 0;
    while (i < buf.length - 1 && buf[i] === 0) i += 1;
    let value = buf.subarray(i);
    if (value[0] & 0x80) value = Buffer.concat([Buffer.from([0]), value]);
    return Buffer.concat([Buffer.from([0x02, value.length]), value]);
  };
  const body = Buffer.concat([encInt(raw.subarray(0, 32)), encInt(raw.subarray(32))]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}
const asBuffer = (bufferSource) => {
  const view = bufferSource instanceof ArrayBuffer ? new Uint8Array(bufferSource) : new Uint8Array(bufferSource.buffer, bufferSource.byteOffset, bufferSource.byteLength);
  return Uint8Array.from(view).buffer;
};

let tamperSignature = false;
let wrongChallenge = false;
let wrongOrigin = false;
let wrongCredential = false;
let rawSignature = false;

Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    credentials: {
      create: async () => ({
        rawId: credentialId,
        response: { getPublicKey: () => spki },
      }),
      get: async (options) => {
        const challenge = new Uint8Array(options.publicKey.challenge);
        const clientData = Buffer.from(JSON.stringify({
          type: "webauthn.get",
          challenge: wrongChallenge ? base64Url(new Uint8Array(32).fill(9)) : base64Url(challenge),
          origin: wrongOrigin ? "https://evil.example" : ORIGIN,
          crossOrigin: false,
        }));
        const authData = new Uint8Array(37).fill(1);
        const clientHash = new Uint8Array(await webcrypto.subtle.digest("SHA-256", asBuffer(clientData)));
        const signed = Uint8Array.from([...authData, ...clientHash]).buffer;
        let signature = new Uint8Array(await webcrypto.subtle.sign(
          { name: "ECDSA", hash: "SHA-256" }, keyPair.privateKey, signed,
        ));
        if (tamperSignature) signature = Uint8Array.from(signature, (byte, index) => index === 40 ? byte ^ 0xff : byte);
        const signatureBuffer = rawSignature ? asBuffer(signature) : asBuffer(toDer(signature));
        return {
          rawId: wrongCredential ? new Uint8Array(32).fill(8).buffer : credentialId,
          response: {
            clientDataJSON: asBuffer(clientData),
            authenticatorData: asBuffer(authData),
            signature: signatureBuffer,
          },
        };
      },
    },
  },
});

const m = await import(pathToFileURL(join(BUNDLE_DIR, "quickUnlock-built.mjs")).href);

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

const PASSWORD = "C0rrect-Horse-Battery-Staple!2026";
const reset = () => { m.clearQuickUnlock(); tamperSignature = false; wrongChallenge = false; wrongOrigin = false; wrongCredential = false; rawSignature = false; };

console.log("=== enrolment ===");
reset();
t("not available before enrolment", m.isQuickUnlockAvailable() === false);
t("quickUnlock is fail-closed without enrolment", (await m.quickUnlock()) === null);
t("enrol succeeds with a platform authenticator", (await m.enrollQuickUnlock(PASSWORD)) === true);
t("available after enrolment", m.isQuickUnlockAvailable() === true);

console.log("=== genuine assertion ===");
t("verified assertion releases the exact master password", (await m.quickUnlock()) === PASSWORD);
rawSignature = true;
t("raw P1363 signature (software authenticator) also verifies", (await m.quickUnlock()) === PASSWORD);

console.log("=== every failure is fail-closed ===");
tamperSignature = true;
t("tampered signature is rejected", (await m.quickUnlock()) === null);
reset(); await m.enrollQuickUnlock(PASSWORD); wrongChallenge = true;
t("wrong challenge is rejected", (await m.quickUnlock()) === null);
reset(); await m.enrollQuickUnlock(PASSWORD); wrongOrigin = true;
t("wrong origin is rejected", (await m.quickUnlock()) === null);
reset(); await m.enrollQuickUnlock(PASSWORD); wrongCredential = true;
t("wrong credential id is rejected", (await m.quickUnlock()) === null);

console.log("=== unavailable platform / clear ===");
reset();
platformAvailable = false;
t("no platform authenticator => no enrolment", (await m.enrollQuickUnlock(PASSWORD)) === false);
t("and quick unlock stays unavailable", m.isQuickUnlockAvailable() === false);
platformAvailable = true;
await m.enrollQuickUnlock(PASSWORD);
m.clearQuickUnlock();
t("clear wipes the session gate", m.isQuickUnlockAvailable() === false && (await m.quickUnlock()) === null);
t("empty password cannot be enrolled", (await m.enrollQuickUnlock("")) === false);

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
