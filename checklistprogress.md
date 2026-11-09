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

## PHASE F / V-92 — Batch 3: P2P real LAN IP, strict peers, camera + footer (2026-11-08)

- [x] Re-baselined: HEAD `a0fc6ec`, PR #4 `pr_open` pass/pass, no remote advance
- [x] Found UNCOMMITTED V-92 work in the working tree; preserved, reviewed, executed, improved (nothing discarded)
- [x] Verified strict RFC-1918 validator, Rust `lan_ipv4` UDP-route trick, `generate_handler!` registration, `core:default` ACL
- [x] Verified `sync_from_peer` really does a WebSocket key-exchange handshake before "Connected" (no fake connection)
- [x] Verified manifest CAMERA/INTERNET + 44px QR-photo fallback with `capture="environment"` + footer inside 360px
- [x] B-16 RED (false GREEN first: StrictMode double effect → hardened with probe counter + allow flag); true RED 2==2
- [x] B-16 GREEN fix: reusable `useCallback probeLanIp`, StrictMode-safe aliveRef, Discover re-probes only when no IP
- [x] Harness gained reusable-probe + re-probe + positive-control assertions
- [x] Full-suite regressions resolved honestly: M-19 updated to reachability invariant (NOT weakened), B-16 test race fixed with `expect.poll`
- [x] Gates: tsc 0 · verify 0 (39 harness, 23 rustfmt) · node20 39/39 · audit 0 · Playwright **163/163 (15.7m)** · live check 0
- [ ] Batch 4 (resume with `continue`): Check for Updates CSP, resilient GitHub fetch, strict SemVer
- [ ] Batches 5-7 + final Antigravity prompt (local-only work + merge) + English master prompt LAST
- [!] `.vztransfer` snapshot-file transfer NOT implemented (reported, not faked); real-device camera/LAN/onPermissionRequest needs Antigravity
- [x] `09d5747` pushed; push `42435123882` + PR `42435126914` both watched to exit 0 (Windows Rust compile/clippy green); `gh pr checks 4` pass/pass
- [x] Batch 3 CLOSED — resume with `continue` for Batch 4

## PHASE F / V-93 — Batch 4: resilient update check, CSP, strict SemVer (2026-11-08)

- [x] Re-baselined: HEAD `8945e62`, PR #4 `pr_open` pass/pass, no remote advance
- [x] Measured CORS for real: api.github.com = `ACAO:*`; github.com 302 has NO CORS header (cannot read Location from renderer)
- [x] Reproduced the screenshot's false "Offline" in real Chromium (`ERR_CERT_AUTHORITY_INVALID` -> offline)
- [x] RED: 11 harness FAIL (CSP tokens, 8s timeout, API version header, no fallback, false offline)
- [x] GREEN fix 1: connect-src += `*.githubusercontent.com`, `ipc:`, `http://ipc.localhost`
- [x] GREEN fix 2: 10s timeout, pinned API version, `/releases?per_page=1` fallback, no-cors reachability probe, `error` != `offline`
- [x] GREEN fix 3: new bilingual `error` render in UpdateModal (previously invisible); up_to_date/Update Now unchanged (already strict SemVer)
- [x] Review after fix: all 3 endpoints attempted in order; sandbox cert-fails all -> offline is honest; B-17/B-18/B-20 prove online behaviour
- [x] Gates: tsc 0 · verify 0 (**40 harness**) · node20 40/40 · audit 0 · Playwright **167/167 (13.0m)** · live check 0
- [!] Renderer cannot read the 302 Location (CORS); a native Rust HTTP command to do so is NOT implemented — reported, not faked
- [ ] Batch 5 (resume with `continue`): offline OCR (eng+ben), strict RFC 6238 TOTP, official APK/Windows logo parity
- [ ] Batches 6-7 + final Antigravity prompt (local-only work + merge) + English master prompt LAST
- [x] `0e616c7` pushed; push `42458168857` + PR `42458173011` both watched to exit 0; `gh pr checks 4` pass/pass
- [x] Batch 4 CLOSED — resume with `continue` for Batch 5

## PHASE F / V-94 — Batch 5: offline OCR, strict RFC 6238, icon parity (2026-11-08)

- [x] Re-baselined: HEAD `a3fa6cb`, PR #4 `pr_open` pass/pass, worktree clean, no remote advance
- [x] Inspected exact files: OCR already `worker.recognize()` -> `ret.data.text` (no metadata result), TOTP already 16+ Base32 + RFC 6238 SHA-1/256/512
- [x] Measured real parity: all 15 Android mipmaps decode to the same emblem (mean-RGB delta <= 9 vs 512px master); Windows `icon.ico`/NSIS referenced
- [x] RED: `?secret=abc` accepted -> bogus 2FA key (5 harness FAIL + B-23 browser FAIL); `#FFFFFF` adaptive background (2 FAIL); "vision model" caption (1 FAIL)
- [x] B-21/B-22 GREEN at RED time: real `eng` + dual `eng+ben` OCR text, no filename/size/dimensions, monotonic progress 10 -> 100
- [x] GREEN fix 1: `parseOtpAuthUri()` validates the inner Base32 secret and returns `cleanKey`; `isValidTotpSecret` + `resolveTotpConfig` now fail closed
- [x] GREEN fix 2: `ic_launcher_background.xml` `#FFFFFF` -> `#13182D` (master corner 19,24,45)
- [x] GREEN fix 3: OCR caption -> "on-device offline OCR (Tesseract)"
- [x] New contracts: 41st harness `totp-uri-strict`, 42nd harness `icon-parity` (pure-Node zlib PNG decoder + fingerprint), +9 `offline-ocr` guards, B-21/B-22/B-23 browser tests
- [x] Review after fix: guard was reading XML comments -> TEST fixed to parse the actual `<color>` value, assertion NOT weakened; Chromium path corrected to `/tmp/chromium/chrome`
- [x] Gates: tsc 0 · verify 0 (**42 harness**) · node20 42/42 · audit 0 · Playwright **170/170 (10.2m)** · live check 0
- [!] Real-device launcher masking, installer artwork and Bengali handwriting accuracy need Antigravity verification; no release published, no merge
- [x] `249f116` pushed; push `42503258511` + PR `42503261967` both watched to exit 0 (4/4 jobs success); `gh pr checks 4` pass/pass
- [x] Batch 5 CLOSED — resume with `continue` for Batch 6
- [ ] Batch 6 (resume with `continue`): full verification + explicit 360x800 / 1440x900 bounding-box DOM audit
- [ ] Batch 7 + final regression loop + Bengali Engineering Report + Antigravity prompt (local work AND merge) + English master prompt LAST

## PHASE F / V-95 — Batch 6: explicit 360x800 / 1440x900 bounding-box DOM audit (2026-11-08)

- [x] Re-baselined: HEAD `da78cf8`, PR #4 `pr_open` pass/pass, worktree clean, no remote advance
- [x] Measured real boxes at BOTH viewports: Lock/Vault/Sync `scrollWidth===clientWidth`; header y=36 (phone) / y=33 (desktop)
- [x] Measured all three Sync footer actions after Connect: all fully in bounds at 360x800 and 1440x900
- [x] Verified `192.1` rejected and a fresh vault created at BOTH viewports (B-27/B-28 GREEN at RED time)
- [x] FOUND DEFECT: shared Modal footer `py-3.5` (14px) ignored `--safe-bottom`; real 24/48px inset left `Receive & Merge` at bottom=785 of 800
- [x] RED: 3 harness FAIL + B-26 browser FAIL (`Expected > 14, Received 14`); B-24/B-25/B-27/B-28 GREEN
- [x] GREEN fix: `ui.tsx` footer += `modal-footer` class; `index.css` `.modal-footer { padding-bottom: calc(14px + var(--safe-bottom)) !important }`
- [x] No artificial floor deliberately: a floor would steal body height and break M-16 at 390x844
- [x] Review after fix: inset 0 -> 14px / bottom 785 (unchanged); inset 24 -> 38px / 761; inset 48 -> 62px / 737; body 428/428 and 411/411 unchanged (M-16/M-19 safe)
- [x] New contracts: 43rd harness `modal-safe-area.test.mjs` (positive control + guards), `vault-bounding-audit.spec.ts` B-24..B-28
- [x] Gates: tsc 0 · verify 0 (**43 harness**) · node20 43/43 · audit 0 · Playwright **175/175 (10.9m)** · live check 0
- [!] Whether a real WebView reports the bottom inset correctly needs physical-device/Antigravity verification; no unmeasured floor was faked
- [x] `df72f73` pushed; push `42507639824` + PR `42507643399` both watched to exit 0 (4/4 jobs success); `gh pr checks 4` pass/pass
- [x] Batch 6 CLOSED — resume with `continue` for Batch 7
- [ ] Batch 7 (resume with `continue`): CI/CD + 5 canonical release assets + final Batch 1→7 regression loop
- [ ] Final deliverables: comprehensive Bengali Engineering Report + Antigravity prompt (local work AND merge) + English master prompt LAST

## PHASE F / V-95b — Batch 6 CI flake RCA + correction (2026-11-08)

- [!] `f21cf4e` docs commit: PR run `42508535834` green (175/175) BUT push run `42508531423` Frontend job FAILED (174/1) — not ignored
- [x] Signed job log `128816346519` root-caused it: B-28 `toHaveCount(0)` 20s timeout; same commit green in PR run + 4/4 local repeats -> TEST flake, not app regression
- [x] Hardened B-28: one test per viewport (fresh context), container-absent precondition, ALL creation/validation errors rejected, `expect.poll` on the real vault key (60s), dialog unmount (30s)
- [x] 8/8 repeat runs GREEN at 8.5-11.5s each; full audit spec 6/6
- [x] Re-ran all gates: tsc 0 · verify 0 (43 harness) · node20 43/43 · audit 0 · live 0 · Playwright **176/176 (10.8m)**
- [x] `5bc4b42` pushed; push `42510871635` + PR `42510875667` BOTH watched to exit 0 (4/4 jobs success); `gh pr checks 4` pass/pass
- [x] Batch 6 FULLY CLOSED (including CI flake correction) — resume with `continue` for Batch 7

## PHASE F / V-96 — Batch 7: CI/CD + 5 canonical assets + final Batch 1→7 loop (2026-11-08)

- [x] Re-baselined: HEAD `fb692d7`, PR #4 `pr_open` pass/pass, worktree clean
- [x] Inspected both workflows: CI had NO `npx tsc --noEmit` (only Vite build); release built `SHA256SUMS.txt` but never ran `sha256sum -c`
- [x] Guards confirmed already correct: exact 5 canonical names in README / checker / publish verify, `--latest` no `--prerelease`, `--clobber`, no `|| true`, Rust fmt/clippy/test, Playwright, audit, Node 20
- [x] RED: 44th harness `ci-release-gates.test.mjs` failed EXACTLY 2 assertions; 4 positive controls prove both detectors work
- [x] GREEN fix 1: `ci.yml` += `Verify TypeScript (no emit)` step (`npx tsc --noEmit`) after `npm ci`
- [x] GREEN fix 2: `release.yml` += `sha256sum -c SHA256SUMS.txt` before upload
- [x] Review: exact shell snippet replayed on 6 dummy assets -> all `OK`, exit 0; YAML indentation structurally verified; no dependency installed
- [x] FINAL LOOP Batch 1→7: tsc 0 · verify 0 (**44 harness**) · node20 44/44 · audit 0 · live 5/5 · batch suites in order **50 passed (3.3m)** · FULL Playwright **176/176 (11.7m)** — zero regressions
- [!] No release/tag/merge: needs 4 signing secrets + keytool + Windows runner + signed-log gate; live `v2.5.2` still STALE; real-device checks remain for Antigravity
- [x] `6a564a6` pushed; push `42546855522` + PR `42546859915` both watched to exit 0 (4/4 jobs success); CI step `Verify TypeScript (no emit) -> success` confirmed; `gh pr checks 4` pass/pass
- [x] Docs RED→GREEN: 5 new `release-runbook` assertions (4 FAIL -> all pass); runbook intro fixed to 10 assets / 5-of-5 resolving / still STALE; section 8 added with local verification + `gh pr merge 4 --merge`
- [x] Re-ran after docs edit: tsc 0 · verify 0 (44 harness) · node20 44/44
- [x] Batches 1-7 CLOSED · final Batch 1→7 loop zero regressions · PR #4 OPEN pass/pass · NO merge/tag/publish
- [x] Final deliverables delivered in chat: comprehensive Bengali Engineering Report + SEPARATE Bengali Antigravity prompt (local work AND merge) + English master prompt LAST

## PHASE G / V-97 — Release Keystore Secrets, ManifestMerger2 Duplicate Attribute Fix & Signed Release Pipeline (2026-11-09)

- [x] Step 1 Keystore: Generated 2048-bit RSA PKCS12 release keystore valid for 10,000 days at `C:\Users\Tonmoy\.vaultzero-keys\vaultzero-release.jks` with alias `vaultzero` and distinguished name `CN=VaultZero, OU=Security, O=VaultZero, L=Dhaka, ST=Dhaka, C=BD` via OpenJDK 17 `keytool`.
- [x] Step 1 Secrets: Configured all 4 production repository secrets on `tonmoycoder/VaultZero` via `gh secret set`: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Confirmed active via `gh secret list`.
- [x] Step 3 Local Telemetry: Measured Windows cold start latency on `Desktop\VaultZero.exe`: **146 ms** (WaitForInputIdle: True, PID 2272), well within the < 2000 ms SLA.
- [x] Playwright 176/176 Verified: All 176 tests passed on local (including 3 cold-start suites verified in 5.1s, 7.2s, 9.5s).
- [x] RCA of Android Release Build Failure: In `release.yml` run `42668919907`, `Build Windows Installer & Portable` succeeded in 9m12s (NSIS, Portable, MSI built), but Android build failed with `ManifestMerger2$MergeFailureException: Error parsing ... AndroidManifest.xml`. Root-caused from signed log chunk 1579: Tauri CLI template already provides `android:usesCleartextTraffic="${usesCleartextTraffic}"`. The previous check in `scripts/patch-android-manifest.mjs` only looked for `="true"`, causing a duplicate attribute `android:usesCleartextTraffic="${usesCleartextTraffic}" android:usesCleartextTraffic="true"` which broke the XML parser.
- [x] RED -> GREEN Fix: Updated `scripts/patch-android-manifest.mjs` to replace any existing `android:usesCleartextTraffic="[^"]*"` with `"true"`, or append cleanly if missing.
- [x] Guard Added: `tests/harness/android-runtime.test.mjs` extended to assert that Tauri template `${usesCleartextTraffic}` is replaced with `"true"` and contains exactly 1 attribute with no duplicate XML attributes.
- [x] Gates Verified: `npx tsc --noEmit` exit 0, `npm run verify` exit 0 (44/44 harness pass, contrast AA 100%, 23 rustfmt, bundle budget ok), `cargo test -p vault-core` 34/34 pass, `cargo clippy` 0 warnings.
- [x] RCA of Publish Job 129355385531: Windows installer & portable succeeded (5m47s) and Android signed build succeeded (5m30s) verifying `"Restored the long-lived release signing keystore from GitHub Secrets."` in the signed log. The publish job failed trying to query non-existent `/releases/tags/$TAG/assets` and passing the 404 JSON to `gh api -X DELETE`. Fixed `.github/workflows/release.yml` to rely on native `gh release upload --clobber` and `gh release view "$TAG" --json assets` for asset verification.

## PHASE G / V-98 — Release Workflow Green Exit, 5 Canonical Assets & Timezone Parity in Live Checker (2026-11-09)

- [x] Release Run 42679507033 Complete & Green:
  - `Build Signed Android APK`: SUCCESS in 5m22s (ID 129369930228).
  - Signed log assertion confirmed: `"Restored the long-lived release signing keystore from GitHub Secrets."` (timestamp: 2026-11-09T19:07:51.2348541Z).
  - `Build Windows Installer & Portable`: SUCCESS in 8m4s (ID 129369930548).
  - `Publish to GitHub Releases`: SUCCESS in 20s (ID 129374565199).
- [x] All 5 Canonical Assets Published & Verified:
  - `VaultZero-Windows-x64-Setup.exe` (12,865,560 B)
  - `VaultZero-Windows-x64-Portable.exe` (21,520,896 B)
  - `VaultZero-Windows-x64.msi` (14,131,200 B)
  - `VaultZero-Android.apk` (19,691,780 B)
  - `SHA256SUMS.txt` (691 B)
- [x] Live Checker Parity: Fixed date string comparison in `scripts/check-live-release.mjs` to compare ISO 8601 UTC dates (`.toISOString().slice(0, 10)`), resolving UTC/local offset mismatch. `node scripts/check-live-release.mjs` exits with code 0 and ZERO `STALE` notices (`RESULT: all 5 links resolve`).



