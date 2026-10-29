# VaultZero Memory Bank & Architectural Ledger

## 1. Project Vision & Core Principles
VaultZero is a 100% offline, cross-platform password manager for Windows Desktop (`.exe`) and Android Mobile (`.apk`).
- **Zero Cloud / Zero Server:** All data remains strictly local or syncs directly device-to-device over encrypted P2P tunnels or optical QR codes.
- **Cross-Platform Compilation:** Pure Rust cryptographic core (`vault-core`) isolated from platform-dependent OS hooks using strict `#[cfg(target_os = "windows")]` and `#[cfg(target_os = "android")]` guards with trait fallbacks.
- **Security-First:** Two-layer key hierarchy, Argon2id KDF, XChaCha20-Poly1305 AEAD, zeroization, RAM memory locking, decoy duress vaults, DoD file shredder.
- **Award-Winning UI/UX:** React + Tailwind CSS + shadcn/ui + Cozy Lofi Dithering Shader mode + Web Audio ambient synthesizer + Mobile Bottom Sheet responsive view.

## 2. Directory Structure & Modular Design
- `/scripts/`: Automated checkpoints (`checkpoint.ps1`) and rollback engine (`rollback.ps1`).
- `/src-tauri/`: Tauri v2 application entrypoint, IPC commands, and platform abstractions.
- `/crates/vault-core/`: Standalone pure Rust cryptography, storage, CRDT, and search library.
- `/src/components/ui/`: Standardized modular UI primitive directory adhering to shadcn/ui conventions.
- `/src/components/`: View-specific components (Sidebar, Header, BentoGrid, SplitInspector, P2PSync, OCRModal, etc.).
- `/src/lib/`: Shared utility functions (`utils.ts`, audio synthesizer, offline brand catalog).

## 3. Platform Abstraction Strategy
| Module | Windows (`target_os = "windows"`) | Android (`target_os = "android"`) | Fallback / Stub |
|---|---|---|---|
| RAM Locking | Win32 `VirtualLock` / `VirtualUnlock` | POSIX `libc::mlock` / `munlock` | No-op safe memory holder |
| Screen Capture Block | Win32 `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` | Android `WindowManager.LayoutParams.FLAG_SECURE` | Tauri window config flag |
| Clipboard Privacy | Win32 `ExcludeClipboardContentFromMonitorProcessing` | `ClipDescription.EXTRA_IS_SENSITIVE` | Generic clipboard clear timer |
| Auto-Type | Desktop keyboard injection (`enigo` / `SendInput`) | Disabled (uses Biometric Copy / Autofill) | Return unsupported on mobile |

## 4. Phase History & Checkpoints
- **Phase 0.5 (Complete):**
  - Scaffolded Vite, React 18, TypeScript, Tailwind CSS, shadcn/ui structure.
  - Implemented `DitheringShader` component with 8x8/4x4 Bayer matrix, wave/cloud shapes, rAF loop, and visibility observer.
  - Implemented `Component` in `wave-1.tsx` and `DemoOne` in `demo.tsx`.
  - Configured Tauri v2 configuration (`src-tauri/tauri.conf.json`).
  - Tagged: `checkpoint-phase-0.5-upgraded-spec`.
- **Phase 1 (Complete):**
  - Created standalone `vault-core` crate with zero UI dependencies.
  - Implemented Argon2id KDF with hardware calibration and optional SHA-256 Keyfile mixing.
  - Implemented two-layer key hierarchy with XChaCha20-Poly1305 Vault Key wrapping and PMV1 header as AAD.
  - Implemented secondary Duress / Decoy Vault slot support.
  - Implemented CRDT Hybrid Logical Clock (HLC) and deterministic `merge_vault_states` preserving historical passwords in `password_history`.
  - Implemented RAM memory locking (`LockedBuffer` with `VirtualLock` on Windows, `mlock` on Android).
  - Implemented atomic file saves (.tmp -> `sync_all` -> rename) with 5 rolling encrypted backups.
  - 100% green tests covering unlock, duress decoy, bit-flip tamper rejection, CRDT merge, keyfile mixing, and HLC monotonicity.
  - Tagged: `checkpoint-phase-1-crypto-core`.
- **Phase 2 (Complete):**
  - Implemented data models: `Entry`, `Folder`, `Category`, `RecoveryCode`, `PasswordHistoryEntry`.
  - Implemented RFC 6238 TOTP generator with SHA1/SHA256/SHA512 and `otpauth://` URI parser (`totp.rs`).
  - Implemented 30+ official offline brand vectors & hex colors with auto-matching (`brands.rs`).
  - Implemented CSPRNG password generator and EFF Diceware 7776-wordlist passphrase generator (`generator.rs`).
  - Implemented offline security auditor for compromised, reused, and weak passwords (`auditor.rs`).
  - Implemented in-memory search engine (<50ms for 1000+ entries) and domain grouping (`search.rs`).
  - Implemented narrow Tauri IPC boundary (`src-tauri/src/lib.rs` and `main.rs`) exposing safe summaries and on-demand secret retrieval.
  - 100% green tests in `cargo test --workspace` (10 passed, 0 failed).
  - Tagged: `checkpoint-phase-2-vault-features`.
- **Phase 3 (Complete):**
  - Designed award-winning hybrid interface combining Figma community design and high-end aesthetics.
  - Implemented `Sidebar.tsx` with navigation categories, folders, tools, quick launcher, and decoy duress badge.
  - Implemented `Header.tsx` with global search, brand quick-filter pill bar, and Defender-style 3-color proportional security health bar.
  - Implemented `BentoGridView.tsx` supporting full Brand Color fills and Minimalist card mode with quick-action hover buttons.
  - Implemented `SplitInspectorView.tsx` with Apple-grade detail inspector, 10-second password auto-hide countdown, live 30s TOTP circular ring, interactive recovery codes checklist, and password history time-machine.
  - Implemented `SecurityCenterView.tsx` with health gauge score and actionable remediation lists.
  - Implemented `AuthenticatorView.tsx` with high-visibility 2FA codes and circular remaining time rings.
  - Implemented `PasswordGeneratorModal.tsx` for CSPRNG random passwords and EFF Diceware passphrases.
  - Implemented `CommandPalette.tsx` (`Ctrl+K`) for keyboard-first navigation.
  - Implemented `LockScreen.tsx` for zero-knowledge vault unlock and creation.
  - Implemented Cozy Lofi / Zen Mode with `DitheringShader` backdrop and 100% offline procedural Web Audio Rhodes chord + pink-noise rain synthesizer (`lofi-audio.ts`).
  - Implemented responsive mobile navigation (`MobileNav.tsx`) for screens < 768px.
  - Verified `npm run build` passes with 0 errors (built in 29s).
  - Tagged: `checkpoint-phase-3-ui-lofi-mobile`.
- **Phase 4 (Complete):**
  - Implemented Zero-Server MITM-Proof Local P2P Sync with ephemeral X25519 + SPAKE2 6-digit PIN key exchange and mutual HMAC-SHA256 transcript tags (`p2p.rs`).
  - Implemented Optical QR Stream Chunking & Reassembly for air-gapped camera sync (`p2p.rs`).
  - Implemented Offline OCR & Regex Classifier with Ambiguous Character (`0/O`, `1/l/I`) detection and one-click substitution (`ocr.rs`).
  - Implemented DoD 5220.22-M 3-Pass Secure File Shredder (`0x00`, `0xFF`, CSPRNG, truncation, unlink) (`shredder.rs`).
  - Implemented Sanitized CSV export preventing Formula Injection (DDE attacks) and Markdown grouped export with spoiler password masks (`export.rs`).
  - Implemented CSV import with duplicate detection preview.
  - Implemented OS Hardening: Protected Clipboard (12s auto-clear countdown toast) and toggleable Screen Capture Protection (`SetWindowDisplayAffinity`).
  - 100% green tests covering P2P key derivation, MITM tamper rejection, optical chunking, OCR parsing, CSV injection, and file shredder (15 passed, 0 failed).
  - Tagged: `checkpoint-phase-4-sync-ocr-hardening`.
