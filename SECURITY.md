# Security Policy & Cryptographic Threat Model

## Threat Model Overview

VaultZero is engineered under a strict **Zero-Trust, Zero-Knowledge, 100% Offline** security posture. It is designed to safeguard credentials, biometric identities, secure notes, and files against both remote network attackers and local machine adversaries.

```
       +-------------------------------------------------------+
       |                  Host OS Environment                  |
       |                                                       |
       |  +---------------------+     +---------------------+  |
       |  |  Frontend (WebView) |     |  Core Rust Engine   |  |
       |  |  - React 18 / UI    |     |  - Argon2id KDF     |  |
       |  |  - Zero Crypto Keys |<===>|  - XChaCha20-Poly   |  |
       |  |  - Ephemeral Memory | IPC |  - ZeroizeOnDrop    |  |
       |  +---------------------+     +---------------------+  |
       |                                           |           |
       |                                    Direct Local I/O   |
       |                                           v           |
       |                              [Encrypted .pmv Vault]   |
       +-------------------------------------------------------+
```

---

## Cryptographic Guarantees & Implementation

| Layer | Standard / Primitive | Specifications & Rationale |
| :--- | :--- | :--- |
| **Key Derivation (KDF)** | **Argon2id** (RFC 9106) | Memory: **64 MiB**, Iterations: **3**, Parallelism: **4**, Salt: 32 bytes CSPRNG. Resistant to GPU/ASIC brute-force cracking. |
| **Authenticated Encryption** | **XChaCha20-Poly1305** | 256-bit symmetric key, 192-bit (24-byte) random nonce per chunk. Eliminates nonce-reuse risk compared to standard AES-GCM 96-bit nonce. |
| **Key Diversification** | **HKDF-SHA256** (RFC 5869) | Distinct subkeys derived for data encryption, index lookup, and decoy authentication. |
| **Duress Decoy Vault** | Isolated Subkey Partitioning | Master password vs. duress password derive cryptographically independent subkeys. Opening decoy vault reveals realistic dummy items; primary payload remains indiscernible from random noise. |
| **Memory Protection** | `zeroize` & `ZeroizeOnDrop` | Keys, intermediate digests, and decrypted memory blocks are wiped with zeroes immediately upon leaving scope. |
| **Local P2P Sync** | **PAKE-style X25519 + transcript channel binding** + XChaCha20-Poly1305 | The pairing PIN is mixed into the key schedule *before* the shared secret is used, and both peers verify a channel-binding hash over the full transcript. A MitM that substitutes a public key fails the binding check and no vault data is released. The payload is encrypted before it reaches the socket. No central server or cloud relay. |
| **Secure Erasure** | **DoD 5220.22-M 3-Pass** | File shredder overwrites targets with `0x00`, `0xFF`, and CSPRNG random bytes before file unlinking. |

---

## IPC Security Boundary (Frontend <-> Core)

1. **Narrow Type-Safe IPC**: The Tauri IPC bridge only accepts strictly typed commands. No arbitrary code execution, dynamic eval, or string-based script injection can execute across the boundary.
2. **Key Isolation**: In the **native Tauri runtime**, master keys and raw derived
   secrets stay inside the Rust core. The WebView receives only display strings and
   yields them upon lock.

   In the **browser fallback** the derivation happens in the WebView, so the master
   password, the keyfile and the recovery key are held there as JavaScript strings
   for the lifetime of the session and are cleared on lock. This is a real
   limitation of the browser path and is called out here rather than glossed over.
   The native runtime is the recommended path; see `docs/ANTIGRAVITY-BRIEF.md`
   finding V-29 for the remediation plan.
3. **Strict Content Security Policy (CSP)**:
   ```csp
   default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'
   ```
   `connect-src` is `'self'` only — the desktop build cannot reach any third-party origin.
4. **Air-Gapped by Design**: No telemetry, analytics, remote crash reporters, or outbound internet HTTP requests exist anywhere in the codebase.
5. **Fail-Closed Runtime**: In the native Tauri runtime, a failure of the Rust vault engine is **never** silently downgraded to the browser `localStorage` vault. Errors propagate to the user instead of unlocking a different key store.
6. **No Plaintext at Rest Outside the Vault**: Vault items are never written to `sessionStorage`. Only non-sensitive flags (duress state) are persisted for UI continuity, and a page reload requires an explicit re-unlock.
7. **Auto-Lock**: The vault locks itself after a configurable idle timeout (default 5 minutes), when the window is hidden, or after a grace period following window blur. The clipboard is scrubbed on lock.
8. **Duress Vault**: The decoy vault is populated with plausible filler entries. An empty decoy would itself reveal that the user is under duress.
9. **Security Audit Trail**: Secret-revealing operations (`reveal_entry_secret`, `get_totp_code`) and bulk exports are recorded in an **in-memory** ring buffer that is cleared on lock — never written to disk next to the vault.

See [`docs/AUDIT-2026-11.md`](./docs/AUDIT-2026-11.md) for the full threat analysis, the verified findings, and the remediation record.

   The single documented exception is the **optional** online breach check, which is
   **off by default** and requires explicit user consent before any request is made:

   - It is **opt-in** — the offline audit never touches the network, and the setting
     is shared by the desktop and web builds so both behave identically.
   - When enabled, it queries `api.pwnedpasswords.com/range/<5-char-prefix>`.
     **Only a 5-character SHA-1 prefix is transmitted.** The password and its full
     hash are hashed and matched locally and never leave the device.
   - Requests are **batched and deduplicated**: one request covers every password
     that shares a hash prefix, and the number of live queries is displayed in the
     Security Center so the user can reason about the exposure themselves.
   - The desktop build's CSP (`connect-src 'self'`) blocks the request outright,
     so the feature is desktop-unavailable by design rather than silently broken.
5. **Fail-Closed Runtime**: In the native Tauri runtime, a failure of the Rust vault engine is **never** silently downgraded to the browser `localStorage` vault. Errors propagate to the user instead of unlocking a different key store.
6. **No Plaintext at Rest Outside the Vault**: Vault items are never written to `sessionStorage`. Only non-sensitive flags (duress state) are persisted for UI continuity, and a page reload requires an explicit re-unlock.
7. **Auto-Lock**: The vault locks itself after a configurable idle timeout (default 5 minutes), when the window is hidden, or after a grace period following window blur. The clipboard is scrubbed on lock.
8. **Duress Vault**: The decoy vault is populated with plausible filler entries. An empty decoy would itself reveal that the user is under duress.
9. **Security Audit Trail**: Secret-revealing operations (`reveal_entry_secret`, `get_totp_code`) and bulk exports are recorded in an **in-memory** ring buffer that is cleared on lock — never written to disk next to the vault. The frontend security audit log is likewise **memory-only**, and entry titles, usernames, e-mail addresses and hash prefixes are redacted before they are recorded.

See [`docs/AUDIT-2026-11.md`](./docs/AUDIT-2026-11.md) for the full threat analysis, the verified findings, and the remediation record.

---

## Reporting a Security Vulnerability

If you discover any security, cryptographic, or memory disclosure vulnerability in VaultZero, please report it responsibly:

- **Primary Contact**: Create a private vulnerability report via **GitHub Security Advisories** on [github.com/tonmoycoder/vaultzero](https://github.com/tonmoycoder/vaultzero/security/advisories).
- **Direct Email**: Security inquiries may also be submitted to `tonmoy.official@proton.me` or via GitHub profile contact.
- **Response Timeline**:
  - **Acknowledgment**: Within 24 hours.
  - **Assessment & Triage**: Within 48 hours.
  - **Patch & Advisory Release**: Coordinated within 7 business days.

Please do **NOT** open public GitHub issues for sensitive security vulnerabilities until a patch has been published.

