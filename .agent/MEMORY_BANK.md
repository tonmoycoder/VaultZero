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
