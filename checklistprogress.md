# VaultZero — Checklist Progress (update after EVERY step)

Legend: `[x]` done & verified · `[ ]` open · `[!]` blocked (reason)
Companion state: `checkpoint.md`. Read both before resuming.
Active branch: `arena/61b1561a-vaultzero` (never rename). PR #2 MERGED.

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
- [!] Beta release `41715962554` FAILED: Android signing secrets are NOT set
      (v2.5.2 used a hardcoded `vaultzero123` keystore — earlier inference was
      wrong); Windows build itself succeeded but the asset-collection glob
      falsely threw. NO debug keystore / fake asset was created.
- [ ] User decision: configure the 4 secrets, approve a labelled dev key, or
      skip publication. Until then `/releases/latest` = v2.5.2 and the 3
      Windows links still 404.
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
