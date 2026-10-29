# VaultZero Task Queue

## Status Overview
- Current Phase: Phase 1 (Cryptographic Core, Duress Vault, CRDT Model & Storage Engine)
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

- [ ] **Phase 1: Cryptographic Core, Duress Vault, CRDT Model & Storage Engine**
  - [ ] Create `vault-core` standalone Rust crate
  - [ ] Argon2id KDF with hardware calibration (500-900ms) + optional Keyfile mix
  - [ ] XChaCha20-Poly1305 Vault Key wrapping & Vault Body encryption with PMV1 AAD
  - [ ] Secondary Duress / Decoy Vault slot support
  - [ ] CRDT Hybrid Logical Clock (HLC) & deterministic `merge_vault_states`
  - [ ] Memory safety (`zeroize`, `secrecy`), OS RAM locking (`VirtualLock` on Windows, `mlock` on Android)
  - [ ] Atomic file write (.tmp -> sync_all -> rename) + 5 rolling backups
  - [ ] Comprehensive unit & fuzz tests with tamper rejection
  - [ ] Verify `cargo test` passes 100%
  - [ ] Create Git tag `checkpoint-phase-1-crypto-core`

- [ ] **Phase 2: Vault Features, TOTP, Zero-Server Brand Logo Engine & Auditor**
  - [ ] Comprehensive data models (`Entry`, `Folder`, `Category`, `RecoveryCode`, `PasswordHistory`)
  - [ ] Sub-50ms in-memory search across 1000+ entries & domain account grouping
  - [ ] RFC 6238 TOTP generator & `otpauth://` parser + Recovery code manager
  - [ ] 3-Tier Zero-Server Brand Logo & Color engine (Offline Vector Pack + Custom Upload + Opt-in Direct Fetch)
  - [ ] CSPRNG Password Generator + Diceware Passphrase Generator
  - [ ] Offline Security Health Auditor (Compromised, Reused, Weak categories)
  - [ ] Narrow Tauri Command IPC boundary (`EntrySummary` list + on-demand secret retrieval)
  - [ ] Verify `cargo test` passes 100%
  - [ ] Create Git tag `checkpoint-phase-2-vault-features`

- [ ] **Phase 3: Hybrid 3-Dashboard UI, Cozy Lofi Shader Mode & Mobile Layout**
  - [ ] Left Sidebar with categories, folders, quick generator, action buttons
  - [ ] Top Header with `Ctrl+K` palette trigger, Brand Pill quick filters, 3-color Defender health bar
  - [ ] Dual View Modes: Brand Bento Grid View & Split-Pane Inspector View
  - [ ] Cozy Lofi / Zen Mode toggle with DitheringShader & 100% offline procedural Web Audio synth
  - [ ] Mobile responsive layout (< 768px) with bottom nav & swipeable sheets
  - [ ] Command Palette (`Ctrl+K`)
  - [ ] Verify `npm run build` and UI verification
  - [ ] Create Git tag `checkpoint-phase-3-ui-lofi-mobile`

- [ ] **Phase 4: MITM-Proof P2P Sync, Offline OCR & OS Hardening**
  - [ ] P2P LAN discovery & SPAKE2 / X25519 authenticated Noise tunnel
  - [ ] QR pairing and Animated QR optical sync fallback
  - [ ] Offline OCR & QR Scanner with regex classification & ambiguous character disambiguation
  - [ ] Protected Clipboard (12s hash-verified clear, sensitive flags)
  - [ ] Desktop Auto-Type (`Ctrl+Alt+P`) via virtual input
  - [ ] Screen Capture Protection (WDA_EXCLUDEFROMCAPTURE / FLAG_SECURE)
  - [ ] Rust-side idle auto-lock & strict CSP
  - [ ] Smart Exports (.pmv, sanitized .csv, .json, .md) & DoD 3-Pass Secure File Shredder
  - [ ] Verify `cargo test` & `npm run build`
  - [ ] Create Git tag `checkpoint-phase-4-sync-ocr-hardening`

- [ ] **Phase 5: Red-Team Audit, Emergency Recovery Kit & Production Packaging**
  - [ ] First-run Onboarding Wizard & Printable Emergency Recovery Kit
  - [ ] Complete Red-Team audit (`Claude-Red` checks, no unwrap panics, zero TODOs)
  - [ ] Release profile optimizations in `Cargo.toml`
  - [ ] Standalone Windows release build & SHA-256 generation in `RELEASE_REPORT.md`
  - [ ] Verify Android compilation targets
  - [ ] Create final Git tag `checkpoint-phase-5-production-ready`
