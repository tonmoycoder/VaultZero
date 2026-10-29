# VaultZero Task Queue

## Status Overview
- Current Phase: Phase 5 (Complete — Production Ready)
- Execution Mode: Unattended Autonomous Overnight Mode (Ralph Loop)
- Platform Targets: Windows Desktop (.exe) & Android Mobile (.apk)

## Phase Checklist
- [x] **Phase 0.5: Workspace Upgrade, shadcn/ui & Dithering Shader Integration**
  - [x] Create scripts/checkpoint.ps1 & scripts/rollback.ps1
  - [x] Initialize .agent/MEMORY_BANK.md and .agent/TASK_QUEUE.md
  - [x] Scaffold Tauri v2 + Vite + React + TypeScript + Tailwind CSS project
  - [x] Configure shadcn/ui primitives (`src/components/ui`, `src/lib/utils.ts`, `lucide-react`)
  - [x] Implement `src/components/ui/dithering-shader.tsx`
  - [x] Implement `src/components/ui/wave-1.tsx`
  - [x] Implement `src/components/ui/demo.tsx`
  - [x] Verify `npm run build` passes cleanly
  - [x] Create Git tag `checkpoint-phase-0.5-upgraded-spec`

- [x] **Phase 1: Cryptographic Core, Duress Vault, CRDT Model & Storage Engine**
  - [x] Create `vault-core` standalone Rust crate
  - [x] Argon2id KDF with hardware calibration (500-900ms) + optional Keyfile mix
  - [x] XChaCha20-Poly1305 Vault Key wrapping & Vault Body encryption with PMV1 AAD
  - [x] Secondary Duress / Decoy Vault slot support
  - [x] CRDT Hybrid Logical Clock (HLC) & deterministic `merge_vault_states`
  - [x] Memory safety (`zeroize`, `secrecy`), OS RAM locking (`VirtualLock` on Windows, `mlock` on Android)
  - [x] Atomic file write (.tmp -> sync_all -> rename) + 5 rolling backups
  - [x] Comprehensive unit & fuzz tests with tamper rejection
  - [x] Verify `cargo test` passes 100%
  - [x] Create Git tag `checkpoint-phase-1-crypto-core`

- [x] **Phase 2: Vault Features, TOTP, Zero-Server Brand Logo Engine & Auditor**
  - [x] Comprehensive data models (`Entry`, `Folder`, `Category`, `RecoveryCode`, `PasswordHistory`)
  - [x] Sub-50ms in-memory search across 1000+ entries & domain account grouping
  - [x] RFC 6238 TOTP generator & `otpauth://` parser + Recovery code manager
  - [x] 3-Tier Zero-Server Brand Logo & Color engine (Offline Vector Pack + Custom Upload + Opt-in Direct Fetch)
  - [x] CSPRNG Password Generator + Diceware Passphrase Generator
  - [x] Offline Security Health Auditor (Compromised, Reused, Weak categories)
  - [x] Narrow Tauri Command IPC boundary (`EntrySummary` list + on-demand secret retrieval)
  - [x] Verify `cargo test` passes 100%
  - [x] Create Git tag `checkpoint-phase-2-vault-features`

- [x] **Phase 3: Hybrid 3-Dashboard UI, Cozy Lofi Shader Mode & Mobile Layout**
  - [x] Left Sidebar with categories, folders, quick generator, action buttons
  - [x] Top Header with `Ctrl+K` palette trigger, Brand Pill quick filters, 3-color Defender health bar
  - [x] Dual View Modes: Brand Bento Grid View & Split-Pane Inspector View
  - [x] Cozy Lofi / Zen Mode toggle with DitheringShader & 100% offline procedural Web Audio synth
  - [x] Mobile responsive layout (< 768px) with bottom nav & swipeable sheets
  - [x] Command Palette (`Ctrl+K`)
  - [x] Verify `npm run build` and UI verification
  - [x] Create Git tag `checkpoint-phase-3-ui-lofi-mobile`

- [x] **Phase 4: MITM-Proof P2P Sync, Offline OCR & OS Hardening**
  - [x] P2P LAN discovery & SPAKE2 / X25519 authenticated Noise tunnel
  - [x] QR pairing and Animated QR optical sync fallback
  - [x] Offline OCR & QR Scanner with regex classification & ambiguous character disambiguation
  - [x] Protected Clipboard (12s hash-verified clear, sensitive flags)
  - [x] Desktop Auto-Type (`Ctrl+Alt+P`) via virtual input
  - [x] Screen Capture Protection (WDA_EXCLUDEFROMCAPTURE / FLAG_SECURE)
  - [x] Rust-side idle auto-lock & strict CSP
  - [x] Smart Exports (.pmv, sanitized .csv, .json, .md) & DoD 3-Pass Secure File Shredder
  - [x] Verify `cargo test` & `npm run build`
  - [x] Create Git tag `checkpoint-phase-4-sync-ocr-hardening`

- [x] **Phase 5: Red-Team Audit, Emergency Recovery Kit & Production Packaging**
  - [x] First-run Onboarding Wizard & Printable Emergency Recovery Kit
  - [x] Complete Red-Team audit (`Claude-Red` checks, no unwrap panics, zero TODOs)
  - [x] Release profile optimizations in `Cargo.toml`
  - [x] Standalone Windows release build & SHA-256 generation in `RELEASE_REPORT.md`
  - [x] Verify Android compilation targets
  - [x] Create final Git tag `checkpoint-phase-5-production-ready`
