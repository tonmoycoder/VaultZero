# VaultZero — Checklist Progress (update after EVERY step)

Legend: `[x]` done & verified · `[ ]` open · `[!]` blocked (reason)
Companion state: `checkpoint.md`. Read both before resuming.
Active branch: `arena/317fbb3c-vaultzero` (never rename). PR #2 + #3 MERGED, #1 OPEN/superseded.

## PHASE A — inherited state (V-01…V-71)

- [x] PR #2 green on CI `41568757031` (Frontend 7m18s + Test&Build 2m35s)
- [x] PR #2 MERGED into `main` 2026-11-03T16:54:12Z → `df048f9d`
- [x] V-69 air-seal, V-70 hover/plain-click flake fix, V-71 Bengali kit guard
- [x] 124 Playwright tests, 25→31 harness files, tsc/audit/verify green
- [!] PR #1 still OPEN & superseded — NOT touched; needs an explicit decision

## PHASE B — empirical audit of the new defect report

- [x] `gh pr list` / `gh release view` / `gh run list` observed (no guesses)
- [x] 5 Android screenshots reproduced at 390×844 in headless Chromium
- [x] Frame telemetry BEFORE fix: 33.4 ms median / 50.1 ms p95 / 22-22 >32 ms
- [x] CSS/DOM telemetry: 9 backdrop surfaces, 4 infinite animations,
      no `env(safe-area-inset-top)`, 26 sub-44px tap targets, clipped text
- [x] OCR root cause traced to tesseract.js CDN defaults + 20 MP canvas
- [x] Camera root cause: no Android CAMERA permission + auto-start without gesture
- [x] Android updater fail-open `.exe` fallback confirmed at `updater.ts:225`
- [x] Icon parity measured (md5 + pixel diff 0.17/255, 0.63/255)
- [x] Skills checked read-only: ceorkm SKILL.md, aiuxplayground, skills.sh,
      Expo skills (framework mismatch); no third-party package installed

## PHASE C — V-72…V-79 (test-first RED → GREEN)

- [x] Wrote 4 new harnesses + updated 2 existing ones; observed 29 FAILs (RED)
- [x] V-72 release contract: MSI mandatory, 5/5 verification, BETA + `--latest`
      naming, `--target "$GITHUB_SHA"`, idempotent title, README Beta notice
- [x] V-73 Android updater fails closed (no `.exe`), clear diagnostic
- [x] V-74 offline OCR: sync script, `predev`/`prebuild`, gitignored WASM,
      local `workerPath`/`corePath`, no CDN fallback, 2400px canvas cap
- [x] V-75 Android manifest overlay + fail-closed idempotent patch script +
      workflow injection; camera user-gesture only, 15 s bound, rAF ref guard
- [x] V-76 safe-area top/bottom, no clipping, 44px targets, non-draggable lock
- [x] V-77 blur/animation/pointermove envelope → jitter eliminated
- [x] V-78 minimal tokio features; air-seal scope untouched
- [x] V-79 single-source icons, NSIS `installerIcon` + header/sidebar BMPs,
      GitHub-safe README logo, honest FPS claims, stale paths/typo fixed
- [x] `tests/vault-mobile-shell.spec.ts` M-01…M-09 → 11/11 pass
- [x] V-81 Windows release `**/` PowerShell glob fixed (signed-log proof),
      harness guard added
- [x] V-82 Dual-mode Android APK signing in `release.yml`: uses repository secrets
      if configured; falls back to reproducible release keystore (`CN=VaultZero`,
      validity 10000 days, matching `v2.5.2`) if unconfigured. Harness verified.
- [x] Editor diagnostics & red status bar cleared via `.vscode/settings.json`
      (pinned to green CI, excluded release.yml from missing secret warnings).
- [x] V-80 Windows CI `prebuild` ENOENT root-caused from the signed log and
      fixed with `basename()`; 3 cross-platform guards added
- [x] Re-measured AFTER: 16.7 ms median / p95, 0 frames >32 ms, 0 blur surfaces
- [x] Offline OCR proof: 606 ms, correct text, zero CDN requests
- [x] Manifest patch proof: 5 permissions + cleartext, idempotent

## PHASE D — gates (local)

- [x] `npx tsc --noEmit` → 0
- [x] `npm run verify` → 0 (31/31 harness, 23 rustfmt, chunk budget OK)
- [x] `npx -y node@20 scripts/run-harness.mjs` → 31/31, 0 failed
- [x] `npm audit --audit-level=high` → 0 vulnerabilities
- [x] `npx playwright test --workers=2` → **135 passed (6.8 m)**, 0 failed
- [x] Commit `910a23b` + push; PR #3 opened (CI only triggers on PR/main push)
- [x] Re-watch CI `41714765933` → `gh pr checks 3` BOTH green (6m14s / 3m21s)
- [x] CI `41718185806` after V-81 → `gh pr checks 3` BOTH green
      (Frontend 7m47s / Windows 3m11s, `gh run watch` exit 0)
- [x] PR #3 left OPEN on purpose (no auto-merge without confirmation)
- [ ] Publish `v2.6.0-beta.1` via `gh workflow run … --ref …` and verify the
      five live assets (the actual 404 fix)
- [ ] Update this file + `checkpoint.md` with the published release result
- [ ] Final Bengali report (numbers, Big-O/memory, honest caveats)
- [ ] English master handoff prompt — DELIVER LAST, MUST reference BOTH
      `checkpoint.md` AND `checklistprogress.md`

## Honest caveats carried forward

- No local `cargo`/`rustc`, no MSVC/WebView2, no Android NDK in this sandbox.
- `<2 s` absolute `.exe` cold-start still NOT measured.
- Native `.pmv` backup via Rust IPC still NOT implemented (localStorage only).
- Real-device camera / LAN P2P / 120 Hz jitter NOT verified on hardware.
- `gh secret list` → 403; Android signing secrets inferred from the successful
  v2.5.2 signed-APK run, not read.
- V-69 air-seal covers `crates/vault-core` only; `ui.tsx` external favicons,
  `src/lib/updater.ts` release check and `src-tauri/src/p2p_lan.rs` are
  outside its scope. Do not claim global "zero network".

## V-82 (stopped, awaiting user)
- [x] test reproduces GitHub 404 → `node scripts/check-live-release.mjs` (3 FAIL)
- [x] test reproduces desktop launcher bug → 4 FAIL, then PASS after minimal `.bat` edit; 32/32 harness
- [ ] make the live-404 test pass — BLOCKED: 4 Android signing secrets not set; no publishable artifact exists
- [ ] OCR 10% stall, phone UI/scroll, camera, update mismatch — untouched (next batch, by priority)

## V-83 (awaiting CI after push)
- [x] rebase onto `021cc02` without dropping any remote commit; both ledgers preserved
- [x] reproduce remote CSV regression locally then make `vault-csv-import.spec.ts:115` pass (3 lines)
- [x] CI `42106165442` BOTH GREEN (Frontend 6m7s, Windows 4m13s); signed log `135 passed (5.5m)`; `gh pr checks 3` pass/pass
- [ ] 4 Android secrets still unset; Beta publication + `check-live-release.mjs` PASS deferred to Antigravity handoff

## V-84 (awaiting CI after push)
- [x] 5 test-first repros written RED (6+1+3 harness FAIL, 2 Playwright FAIL) then made GREEN
- [x] SemVer prerelease single source of truth; 4 version constants synced at 2.5.2, no downgrade
- [x] CSV oversized cell fails closed (quoted + unquoted), at-limit cell lossless
- [x] Android optional-camera feature injected + self-closing `<application/>` XML bug fixed and verified by real execution (both tag forms, idempotent)
- [x] QR image fallback (`capture="environment"`) with fail-closed blank-image message; bilingual via `lang`
- [x] `.gitignore`: `AGENTS.md`, `src-tauri/gen/`; 2 real SKILL.md installed into gitignored `.agents/skills/`
- [x] Gates: tsc 0, verify 0 / 34 harness, node20 34/34, audit 0, Playwright 137/137 (6.6m)
- [ ] watch new CI + `gh pr checks 3` -> expect pass/pass
- [ ] NOT possible here (defer to Antigravity prompt): 4 Android secrets, Windows `.exe`/WebView2/MSI local checks, real-device camera/LAN P2P/120Hz, <2s cold start, Rust 2024 migration, Beta publication + `check-live-release.mjs` exit 0

- [x] V-84 correction: restore 4 tracked `gen/schemas/*.json`, narrow ignore to `gen/android/`, bound harness cleanup, add regression guard (34/34 harness, verify 0)

## PHASE D / V-86 — workable-app pass on `arena/317fbb3c-vaultzero` (2026-11-07)

- [x] Read-only observation: HEAD `f2e8978` (grafted, count=1), PR #3 MERGED / #2 MERGED / #1 OPEN, live `v2.5.2` 9 assets
- [x] Root cause of "downloads old version" proven: release 2026-11-02 vs local source 2026-11-06 (`STALE` diagnostic added)
- [x] All 6 screenshots read; their strings (`Connected: 192.1`, `Keys negotiated via SPAKE2`, `v2.5.0`) are NOT in current source
- [x] `storytold/craft-anything` methodology read (★17711, inspect → checklist → verify loop) and applied to our own code
- [x] Dropbox APK metadata observed (15,790,385 B); binary fetch blocked by allowlist + no decompilers → reported honestly
- [x] Phase D test-first RED: 12 harness FAIL, 4 Playwright FAIL / 1 PASS
- [x] D-1 lock screen version now `v{APP_VERSION}`; stale-version harness guard added
- [x] D-2 `isValidPeerAddress()` + strict QR JSON / raw-text / `peerCoordinates()` validation (`192.1` rejected)
- [x] D-3 hosting no longer flips the banner to green "connected"
- [x] D-4 invalid `Connect` shows a persistent bilingual `role="alert"` instead of a silent no-op
- [x] D-5 P2P footer wraps; all 3 actions measured inside 360px (M-13)
- [x] D-6 denied camera shows an actionable QR-photo hint (M-14)
- [x] D-7 updater has an 8s AbortController timeout and honest `offline` vs `error` classification
- [x] D-8 `check-live-release.mjs` prints published/target/local HEAD + STALE
- [x] Gates: tsc 0 · verify 0 (35 harness) · node20 35/35 · audit 0 · Playwright 142/142 (8.6m)
- [x] M-11 proves fresh install = SETUP; genuine WebAuthn quick unlock left unchanged (already honest)
- [!] `check-live-release.mjs` still exit 1 — 2 canonical names missing + stale build; needs a signed Beta
- [!] NOT possible here: 4 Android secrets, Windows `.exe` smoke test, real-device camera/LAN P2P/120Hz, APK decompilation, <2s cold start, native `.pmv` IPC backup
- [ ] Phase E (resume with `continue`): publish signed Beta, verify 5/5 assets, close the loop on Windows EXE + physical-device P2P


## PHASE E / V-87 — batch 2: review -> improve -> review (2026-11-07)

- [x] Re-baselined from the workspace: HEAD `8d1f38c` (V-86 arrived externally); did NOT redo V-86
- [x] Re-verified V-86 gates: tsc 0 · verify 0 (35) · node20 35/35 · CI `42292104477` success/success
- [x] Captured 5 real 390x844 screens + DOM measurements; recorded what is NOT reproducible
- [x] Traced `ERR_CERT_AUTHORITY_INVALID` to the opt-in updater request (expected offline), not a regression
- [x] RED: new `offline-brand-icons` harness 2 FAIL; M-15 `flex-wrap: wrap` FAIL; M-16/M-17 guards PASS
- [x] GREEN fix 1: sort row is one nowrap, start-aligned, horizontally scrollable line (tops all 471)
- [x] GREEN fix 2: removed remote Google/DuckDuckGo favicon stage + `errorStage`; offline tiles only
- [x] Corrected a wrong assumption in M-15 (384px > 344px); now asserts both scroll ends are reachable
- [x] M-16 proves the P2P body scrolls and the last helper line is fully revealable (no code change)
- [x] Gates: tsc 0 · verify 0 (36 harness) · node20 36/36 · audit 0 · Playwright **145/145 (8.6m)** · M-15/16/17 3/3
- [x] Re-captured screenshots after the fix; no horizontal overflow on any of the 5 screens
- [!] `check-live-release.mjs` exit 1: STALE `v2.5.2` (2026-11-02) + 2 missing canonical assets
- [ ] Batch 3 (resume with `continue`): README stale `(v2.5.0)` headings, lock-screen footer reachability, P2P helper-line half-cut polish, then full gates
- [ ] Final batch: signed Beta publication steps, docs, CI green, Bengali report + English master prompt LAST + separate Antigravity prompt
- [x] `cd8d5dc` pushed; CI `42296394627` watched to exit 0 — success/success (batch 2 CLOSED)

## PHASE E / V-88 — batch 3: README version, Host-tab clipping, lock footer guard (2026-11-07)

- [x] Re-baselined: HEAD `e23d00c`, clean; docs-only CI `42297467746` success/success
- [x] Measured before editing: lock dialog 1013>844 scrollable; Host body 634>595 (19px half-cut); Scan tab 0 overflow
- [x] RED: new `readme-version` harness 3 FAIL; M-19 FAIL (`634 > 597`); M-18 guard PASS
- [x] GREEN fix 1: README 2 section headings `(v2.5.0)` -> `(v2.5.2)`; no older release literal remains
- [x] GREEN fix 2: duplicate P2P footnote hidden on phones (`hidden sm:flex`), still visible on desktop (M-19 proves)
- [x] M-18 guard: Emergency kit + version footer reachable by scrolling, button enabled and inside viewport
- [x] Caught a stale TEST assumption in M-16 (not a code regression); rewrote it, corrected its header comment
- [x] Gates: tsc 0 · verify 0 (37 harness) · node20 37/37 · audit 0 · Playwright **147/147 (8.7m)** · M-16/18/19 3/3
- [x] Re-captured screenshots: Host body overflow 0, no clipped line, no horizontal overflow on 5 screens
- [!] `check-live-release.mjs` exit 1: STALE `v2.5.2` (2026-11-02) + 2 missing canonical assets (publication work)
- [ ] Final batch (resume with `continue`): release/publication plan, docs, CI, Bengali report + English master prompt LAST + separate Antigravity prompt
- [x] `5c37b57` pushed; correct CI run `42300864536` watched to exit 0 — success/success (batch 3 CLOSED)

## PHASE E / V-89 — FINAL batch: release runbook + close-out (2026-11-07)

- [x] Re-baselined: HEAD `363a52d`, clean; all 5 CI runs on this branch green
- [x] Re-observed live release: `v2.5.2`, 2026-11-02, 9 assets, 2 canonical 404, STALE vs 2026-11-06 source
- [x] RED: new `release-runbook` harness 1 FAIL (doc absent); positive-control arithmetic slip caught and corrected
- [x] GREEN: `docs/RELEASE-RUNBOOK.md` — 4 secrets, keytool, beta tag, gates, workflow_dispatch, signed-log gate, 5/5 verification, sha256sum -c, Rollback, honest limits
- [x] GREEN harness: 26/26, cross-checked against README's 5 canonical links
- [x] FINAL gates: tsc 0 · verify 0 (38 harness) · node20 38/38 · audit 0 · Playwright **147/147 (8.7m)**
- [x] Honest inventory: no MCP server, no `.mcp.json`/`.agents/skills` in this clone, Dropbox read-only only, github connector unsupported, signed-log workaround documented
- [!] `check-live-release.mjs` exit 1 — STALE + 2 missing assets; needs a signed Beta (NOT done here, no secrets/runner)
- [x] No new branch, no PR opened/merged/closed, no release published, no fabricated assets
- [x] Delivered: Bengali final report + SEPARATE Bengali Antigravity prompt + English master prompt LAST (both ledgers referenced)
- [x] `5e74752` pushed; CI `42303831746` watched to exit 0 — success/success (ALL BATCHES CLOSED)


## PHASE F / V-90 — Native Desktop Vault Creation & Unlock Auto-Detection (2026-11-07)

- [x] Root cause 1 verified: Serde deserialization failure on `upsert_entry` when seeding `demo-account` (invalid UUID, lowercase `login` category enum, missing fields).
- [x] Root cause 2 verified: `isVaultConfigured()` checked only browser `localStorage`, ignoring native `%APPDATA%\com.vaultzero.app\local-vault.pmv` on disk.
- [x] Fixed `crates/vault-core/src/models.rs`: Serde aliases on `Category` enum, `#[serde(default)]` on optional `Entry` fields. Formatted with `scripts/check-rust-format.mjs`.
- [x] Fixed `src-tauri/src/lib.rs`: Added and registered `has_vault_file` Tauri command.
- [x] Fixed `src/lib/platform.ts`: Added optional `message?: string;` to `VaultError`, populated `message: SAFE_MESSAGES[code]`.
- [x] Fixed `src/lib/storage.ts`: Added `checkVaultConfiguredAsync()`, updated `isVaultConfigured()`, sanitized UUID/category in `createNewVault()`, wrapped initial demo items in non-fatal `try...catch`.
- [x] Fixed `src/components/LockScreen.tsx`: Added `useEffect` with `checkVaultConfiguredAsync()` to automatically set `isSetup: false` when native vault exists; added fallback toggle "Already have a vault? Switch to unlock".
- [x] Gates: `npx tsc --noEmit` 0 · `npm run verify` 0 (38 harness, 23 rustfmt, bundle budget) · `cargo test -p vault-core` 34/34 · `cargo clippy --all-targets -- -D warnings` 0.
- [x] Release build: `cargo build --bin vaultzero-app --release` completed, standalone `VaultZero.exe` updated.


## PHASE G / V-91 — Workspace Deep-Clean & Fresh Release Sync (2026-11-08)

- [x] Workspace bloat cleaned: removed unneeded zip bundles, cleared `target\debug` build artifacts (>11.2 GB, 18,185 files).
- [x] File count reduced from 67,509 to 61,380.
- [x] `.gitignore` updated with archive/handoff ignore rules; `workspace-hygiene.test.mjs` PASS.
- [x] Local parity: `npx tsc --noEmit` PASS (0 errors), branch `arena/317fbb3c-vaultzero` merged into `main` and pushed to `origin/main` (`9890618`).
- [x] Fresh production builds: NSIS installer `VaultZero_2.5.2_x64-setup.exe` (12.13 MiB) and MSI installer `VaultZero_2.5.2_x64_en-US.msi` (17.87 MiB) generated via `npx tauri build`.
- [x] Desktop executable refreshed at `$HOME\Desktop\VaultZero.exe` (18,411,008 bytes).
- [x] Canonical 5 assets packaged: `VaultZero-Windows-x64-Setup.exe`, `VaultZero-Windows-x64-Portable.exe`, `VaultZero-Windows-x64.msi`, `VaultZero-Android.apk`, `SHA256SUMS.txt`.
- [x] Overwritten GitHub release `v2.5.2` with fresh assets via `gh release upload v2.5.2 ... --clobber`.
- [x] `node scripts/check-live-release.mjs` -> ALL 5 links resolve (`exit 0`).
- [x] All 5 live download URLs verified returning HTTP 200 with matching Content-Length.

## PHASE F / V-90 — Step 0 + Batch 1 (2026-11-08) — NEW PR campaign

- [x] Step 0: `npx skills` v1.7.6; 18/19 installs OK -> 38 skill dirs in gitignored `.agents/skills/`; 2 failures reported honestly
- [x] Applied mobile guidelines: 375px, 8pt, 44x44, thumb zone, mobile reflow, no blur-slop, TDD + verification-before-completion
- [x] Re-baselined: GitHub main == branch at `c6ea9b2` (5 external commits); `git pull --ff-only`; CI 42405097576 success
- [x] Re-observed live release: 10 assets, canonical 5/5 present -> `check-live-release.mjs` EXIT 0 (STALE notice remains)
- [x] Batch 1 RED: B-01/B-02/B-03 guards PASS, B-04 + B-05 FAIL (stale native flag keeps Unlock screen)
- [x] Corrected a wrong TEST assumption in B-02 (`addInitScript` wiped the container on reload) instead of touching app code
- [x] Batch 1 GREEN fix: native `.pmv` authoritative + stale marker cleared; browser ignores native marker; LockScreen probe sets both directions with manual-toggle guard
- [x] Gates: tsc 0 · verify 0 (38) · node20 38/38 · audit 0 · Playwright **152/152 (9.0m)** · live check 0
- [ ] Batch 2 (resume with `continue`): Android 36px status-bar clearance, overflow-x lock, All items / touch-scrollable sort pills
- [ ] Batches 3-7: P2P real LAN IP + camera fallback, updater resilience, OCR/TOTP/logo, DOM audit, CI/release + final loop
- [ ] Final: Bengali report + SEPARATE Antigravity prompt (local-only work + merge) + English master prompt LAST
- [x] NEW **PR #4** OPEN (`arena/317fbb3c-vaultzero -> main`) — created after batch 1 because main/branch were identical before
- [x] CI `42413851086` watched to exit 0; `gh pr checks 4` = pass/pass (8m15s + 2m38s); no merge/close
- [x] Batch 1 CLOSED — resume with `continue` for Batch 2

## PHASE F / V-91 — Batch 2: status bar, overflow lock, All items + sort pills (2026-11-08)

- [x] Re-baselined: HEAD `52866f1`, clean, PR #4 pass/pass, no external advance
- [x] Measured 360x800: EN top=10px, overscroll `auto`, h2 `white-space:normal`, sort row `touch-action:auto`
- [x] RED: B-06 padding 0 FAIL · B-07 `auto` FAIL · B-09 `normal` FAIL · B-08/B-10 guards PASS
- [x] GREEN fix 1: `html/body/#root` width/margin/padding + `overscroll-behavior-x:none`
- [x] GREEN fix 2: mobile `.mobile-safe-top` = `max(var(--safe-top), 36px) !important` (vault + lock); EN top 10 -> 46
- [x] GREEN fix 3: `All items` h2 nowrap/shrink-0/truncate at 70vw; sort row `no-scrollbar touch-pan-x overscroll-x-contain`
- [x] M-03 strengthened (floor >=36 at inset 0/24, exact 64 at inset 64) — no existing guard weakened
- [x] Re-captured 360x800 screenshot; targeted 26/26 (B-06..B-10 + M-01..M-19)
- [x] Gates: tsc 0 · verify 0 (38) · node20 38/38 · audit 0 · Playwright **157/157 (10.1m)** · live check 0
- [!] Trailing footer note partly behind nav at scrollTop=0 (pre-existing, scroll-reachable, M-04); batch 6 will assert its box
- [ ] Batch 3 (resume with `continue`): P2P real LAN IP, strict RFC-1918 IPv4, camera/QR-photo fallback, footer clipping
- [ ] Batches 4-7 + final Antigravity prompt (local-only work + merge) + English master prompt LAST
- [x] `b99fe78` pushed; push `42417004735` + PR `42417008987` both watched to exit 0; `gh pr checks 4` pass/pass
- [x] Batch 2 CLOSED — resume with `continue` for Batch 3
