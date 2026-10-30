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
| **Local P2P Sync** | **SPAKE2** (RFC 9383) + Local TCP | MITM-proof password-authenticated key exchange. No central server or cloud relay. Communications occur strictly over LAN. |
| **Secure Erasure** | **DoD 5220.22-M 3-Pass** | File shredder overwrites targets with `0x00`, `0xFF`, and CSPRNG random bytes before file unlinking. |

---

## IPC Security Boundary (Frontend <-> Core)

1. **Narrow Type-Safe IPC**: The Tauri IPC bridge only accepts strictly typed commands. No arbitrary code execution, dynamic eval, or string-based script injection can execute across the boundary.
2. **Key Isolation**: Master keys and raw derived secrets **never** cross into the frontend WebView JavaScript runtime. The WebView receives only display strings and yields them upon lock.
3. **Strict Content Security Policy (CSP)**:
   ```csp
   default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://localhost:* ws://localhost:*;
   ```
4. **Air-Gapped by Design**: No telemetry, analytics, remote crash reporters, or outbound internet HTTP requests exist anywhere in the codebase.

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

