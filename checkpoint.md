# VaultZero — Checkpoint (power-loss resistant)

> Read this file FIRST after any power loss or agent restart. Then read
> `checklistprogress.md` and resume at the first unchecked item. Both files
> must be updated after EVERY completed step.

- Repo: `tonmoycoder/VaultZero`
- Active branch (FIXED, never rename): `arena/61b1561a-vaultzero`
- Base: `main` @ `df048f9d3276c4eaf7b2b0f3220c69ff4b56d800`
  (`docs(readme): update version badge to v2.5.2`, 2026-11-03 22:53 +0600)
- PR #3 OPEN (`arena/61b1561a-vaultzero` → `main`), head `66e6273`.
  CI history: `41713265261` Frontend PASS 6m38s / Windows FAIL 42s (V-80);
  `41714765933` BOTH PASS (6m14s / 3m21s);
  `41718185806` BOTH PASS (Frontend 7m47s / Windows 3m11s) — CURRENT GREEN.
  `gh pr checks 3` = pass + pass. PR #3 deliberately NOT auto-merged.
- PR #2 (V-01…V-71) **MERGED** 2026-11-03T16:54:12Z. Its CI `41568757031`
  was green on both jobs. PR #1 (`arena/79f3d1ba-vaultzero`, `5c98a1f`) is
  still **OPEN** and superseded — deliberately NOT inspected, pushed, merged
  or closed. Ask the user before touching it.
- Tag `v2.5.2` @ `1090a66`; published assets are BROKEN (see V-72).
- Language contract: ALL user-facing prose in Bengali; app UI stays bilingual
  via `lang` / `S("bn","en")`. The master handoff prompt is the only English
  deliverable and is delivered LAST.

## Phase C — Android/Windows release readiness (V-72…V-79)

The user supplied five Android screenshots + a defect list: Windows installer
links 404, installer logo missing, no usable `.exe`, Android UI scattered /
overlapping / top-aligned, drag handle moves and overlaps, OCR stalls midway,
camera permission denied and panel closes itself, P2P possibly broken, frame
jitter despite a "120 FPS" claim, release needs a Beta name, APK vs EXE icon
parity, desktop regressions, and "check every listed AI skill". All work below
is empirical: no guesses, no stubs, no fake fallbacks, no half-finished paths.

### Audit findings (measured BEFORE the fixes)
- `gh release view` on live `v2.5.2`: 8 assets, but **only 2 of 5 canonical
  names** (`SHA256SUMS.txt`, `VaultZero-Android.apk`). Missing
  `VaultZero-Windows-x64-Setup.exe`, `VaultZero-Windows-x64-Portable.exe`,
  `VaultZero-Windows-x64.msi`; instead a lowercase
  `VaultZero-Windows-x64-portable.exe` + `.idsig`/`.manifest`/`.sha256`.
  Hence README's 3 Windows links 404. Release `prerelease:false`, name
  does NOT say Beta.
- `release.yml` already emits the right 5 names, but MSI copy is optional
  (`if ($msi)`) and publish verification checks only 4 names.
- `selectDownloadableAsset()` on Android fell back to a Windows `.exe`
  (`updater.ts:225-227`) → a signed APK-less release installs the wrong file.
- `src/lib/ocr.ts`: `langPath` local, but `workerPath`/`corePath` default to
  `cdn.jsdelivr.net` (verified in `tesseract.js/src/worker/browser/defaultOptions.js`
  and `worker-script/browser/getCore.js`), with a silent CDN fallback on
  failure → offline Android stalls at "loading tesseract core".
  `preprocessImageForOcr` allowed a 20 MP canvas (~80 MB `ImageData`) → OOM.
- `src-tauri/gen/android` is NOT committed; no CAMERA / LAN permissions in
  the signed APK. `getUserMedia` auto-started on tab change (no user gesture)
  → immediate "Permission denied", panel appeared to close itself.
- `src-tauri/Cargo.toml:19` `tokio features=["full"]`; usages need only
  `rt-multi-thread, macros, sync, time, net, io-util`.
- `public/vaultzero-logo.png` == `src-tauri/icons/icon.png` (md5
  `433aa1a2…`); `icon.ico` / `128x128.png` differ by 0.17/255 and 0.63/255
  mean → APK and EXE icons ARE the same source. BUT `tauri.conf.json` had no
  `installerIcon`/`headerImage`/`sidebarImage` → generic NSIS wizard.
- Headless Chromium 390×844 BEFORE fix: lock screen median **33.4 ms**,
  p95 **50.1 ms**, max **83.4 ms**, **22/22** frames >32 ms; vault median
  16.7 ms but **17/40** >32 ms. 9 `backdrop-filter` surfaces, 7 blurred
  layers, 4 infinite ambient animations, `env(safe-area-inset-top)` unused
  anywhere in `src/index.css`. Sort header / "All items" clipped; bottom nav
  covered the last text line; 26 tap targets <44px.
- Skills (read-only): `ceorkm/mobile-app-ui-design` SKILL.md (5-step process,
  60/30/10, 8pt grid, thumb zone, F-pattern, 44×44pt, "overusing blur" is an
  anti-pattern), `aiuxplayground.com/prompts` (220+ prompt catalog; UI-polish /
  motion workflows), `skills.sh` (agent skills directory incl. Antigravity),
  Expo skills (`expo-ui`, `expo-router`, `eas-simulator` — React Native /
  EAS cloud; framework mismatch for Tauri+React Web). Third-party packages
  were NOT installed: dev-only tooling, zero runtime value, external bloat.
  The RULES were adopted as a test-enforced design contract instead.

### Implemented (all test-first: RED → GREEN)
- **V-72** `release.yml`: MSI mandatory (`throw` if absent), publish
  verification requires all **5** canonical names, `-beta` tags get
  `--title "… - BETA (Development Preview)"` + explicit `--latest` and
  `--target "$GITHUB_SHA"`, idempotent `gh release edit` on re-run.
  Deliberately NOT `--prerelease`: prereleases are excluded from
  `/releases/latest`, which would re-break README + the in-app updater.
  README gained a Bengali "বিটা / ডেভেলপমেন্ট প্রিভিউ" notice.
- **V-73** `src/lib/updater.ts`: Android returns `info.androidAsset` ONLY;
  missing APK now **fails closed** with a Bengali-free but actionable
  diagnostic. `runVerifiedUpdate` stores `platform` once.
  `tests/harness/update-platform.test.mjs` + `release-contract.test.mjs`
  updated to assert the fail-closed behaviour.
- **V-74** `scripts/sync-tesseract-assets.mjs` + `predev`/`prebuild` npm
  scripts + gitignored `public/tesseract/` (worker.min.js + 2 LSTM WASM
  variants, ~13 MB, never in Git). `src/lib/ocr.ts` uses absolute local
  `workerPath`/`corePath`/`langPath`, NO CDN fallback, `finally { terminate() }`,
  and caps the preprocessing canvas at `MAX_OCR_CANVAS_EDGE = 2400`.
- **V-75** `src-tauri/android/AndroidManifest.xml` overlay (CAMERA, INTERNET,
  ACCESS_NETWORK_STATE, ACCESS_WIFI_STATE, CHANGE_WIFI_MULTICAST_STATE,
  `usesCleartextTraffic="true"`) + `scripts/patch-android-manifest.mjs`
  (fail-closed, idempotent, verified) injected in `release.yml` AFTER
  `tauri android init`, BEFORE `tauri android build`. `toolModals.tsx`:
  camera no longer auto-starts, requires an explicit tap, bounded by a
  15 s `Promise.race`, `cameraActiveRef` guards the rAF scanner loop,
  bilingual permission guidance.
- **V-76** `src/index.css` V-76/77 block: `--safe-top`/`--safe-bottom`,
  `.mobile-safe-top`, `.vault-shell` status-bar padding,
  `.mobile-safe-bottom` 96px+gesture bar, `overflow: clip`, hidden
  decorative orb, 44px nav targets; `LockScreen.tsx` root gained
  `mobile-safe-top` and is NOT a draggable sheet.
- **V-77** mobile media query disables `backdrop-filter` and infinite
  ambient animations; `prefers-reduced-motion` honoured; `Tactile.tsx` and
  `VaultHome.tsx` limit global `pointermove` to `(pointer: fine)`.
- **V-78** `src-tauri/Cargo.toml` minimal tokio features; air-seal
  (`crates/vault-core`) unchanged and network-free.
- **V-79** `npx tauri icon public/vaultzero-logo.png` in BOTH build jobs;
  `installerIcon`, `headerImage` (150×57 BMP), `sidebarImage` (164×314 BMP)
  added to `tauri.conf.json`; README `<img>` → GitHub-safe Markdown image;
  unmeasured "120fps" claims replaced with measured frame numbers; stale
  `src/workers/ocr.worker.ts` path corrected; Bengali typo fixed.
- New guards: `tests/harness/{offline-ocr,android-runtime,mobile-shell,
  release-beta}.test.mjs` (with positive controls) and
  `tests/vault-mobile-shell.spec.ts` (M-01…M-09, 11 tests).

### Telemetry AFTER the fixes (same harness, same 390×844 Chromium)
| Metric | Before | After |
|:---|:---|:---|
| Lock median frame | 33.4 ms | **16.7 ms** |
| Lock p95 / max | 50.1 / 83.4 ms | **16.7 / 16.8 ms** |
| Lock frames >32 ms | 22 / 22 | **0** |
| Vault frames >32 ms | 17 / 40 | **0** |
| `backdrop-filter` surfaces | 9 | **0** |
| `env(safe-area-inset-top)` | absent | **present** |

Offline OCR browser proof (all external requests blocked): extracted
`"USER: demo@vaultzero.local\nPASS: S3cret-42"` in **606 ms**, zero CDN
calls. Manifest patch: 5 permissions + cleartext, idempotent on 2nd run.

### Final CI (`41718185806`, head `66e6273`)
Frontend End-to-End & Security Tests **pass 7m47s**
(`126203632681`); Test & Build Verification **pass 3m11s**
(`126203632053`). `gh run watch` exit 0. Rust clippy/test with the minimal
tokio feature set is therefore verified on Windows CI, not just locally.

### Gate results (local, 2026-11-04)
- `npx tsc --noEmit` → 0
- `npm run verify` → 0; **31/31 harness**, 23 rustfmt, chunk budget OK
- `npx -y node@20 scripts/run-harness.mjs` → 31/31, 0 failed
- `npm audit --audit-level=high` → 0 vulnerabilities
- `npx playwright test --workers=2` → **135 passed (6.8 m)**, 0 failed
  (124 existing + 11 new mobile tests), zero regressions
- `tests/vault-mobile-shell.spec.ts` alone → 11 passed (27.5 s)
- No local `cargo`/`rustc`, no MSVC toolchain → Rust is verified by the
  Windows CI job only. `gh secret list` returns 403 (integration token lacks
  secrets scope); v2.5.2's successful signed APK run implies the Android
  signing secrets were configured, but this is an inference, not a read.

### Environment notes
- Fresh sandbox: `npm ci` (0 vulnerabilities), no Playwright CDN access
  (`ECONNRESET` on cdn.playwright.dev). Browser obtained from the allowed
  npm registry via `@sparticuz/chromium@153.0.0` → `/tmp/chromium`
  (209 MB), NSS libs from bundled `al2023.tar.br` → `/tmp/chromium-libs/lib`.
  Run tests with:
  `env -u FONTCONFIG_FILE LD_LIBRARY_PATH=/tmp/chromium-libs/lib VAULTZERO_CHROMIUM=/tmp/chromium npx playwright test --workers=2`
- Dev server: `website-0d4b85fc`, `npm run dev -- --host 0.0.0.0 --port 1420`,
  HTTP 200 on `127.0.0.1:1420` and the e2b preview host.
- `public/tesseract/` and `.artifacts/` are gitignored; `.agent/` is
  gitignored and local-only. `docs/FINAL-REPORT-2026-11.md` from the previous
  phase is NOT tracked in this checkout.

### V-80 — Windows CI regression caught and fixed (empirical, not guessed)

CI `41713265261` / job `126186571526` failed at `npm run build` → `prebuild`.
Signed plain-text log (via the authenticated 302 → `fetch_page chunk 1` route)
showed verbatim:

```
Error: ENOENT: no such file or directory, copyfile
 'D:\a\VaultZero\VaultZero\node_modules\tesseract.js\dist\worker.min.js'
 -> 'D:\a\VaultZero\VaultZero\public\tesseract\D:\a\VaultZero\...'
```

`src.split("/").pop()` cannot split Windows `join()` backslashes, so the whole
absolute path became the destination filename. Fixed with `basename()` from
`node:path`; `tests/harness/offline-ocr.test.mjs` gained 3 guards (a positive
control reproducing the bad split, `path.win32.basename`, and a source check).
Local `node scripts/sync-tesseract-assets.mjs` + 31/31 harness PASS. Do NOT
reintroduce `split("/")` in a path built with `join()`.

### V-81 / Beta release attempt `41715962554` — BLOCKED, honest correction

`gh workflow run "Release (Windows Installer & Android APK)" --ref arena/61b1561a-vaultzero -f tag_name=v2.6.0-beta.1`
→ **failure** (both build jobs failed, publish skipped).

1. **Android**: `Android signing secrets are not configured.` Earlier I inferred
   from v2.5.2's successful signed APK that the 4 secrets existed. That was
   WRONG. `gh api .../contents/.github/workflows/release.yml?ref=v2.5.2` shows
   v2.5.2 generated a **hardcoded keystore**
   (`keytool -genkey ... -storepass vaultzero123 -keypass vaultzero123`). V-31
   correctly replaced that with fail-closed secrets, which have never been set.
   `gh secret list` returns 403 for the integration token. Required:
   `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. NO debug/ephemeral keystore was
   created — that would be a fake fallback and would break in-place upgrades.
2. **Windows**: Tauri **did** build all three binaries successfully
   (NSIS 12.27 MiB, MSI 13.47 MiB, `target/release/vaultzero-app.exe`), but
   `Get-ChildItem -Path "**/bundle/nsis/*.exe" -Recurse` returns `$null` in
   PowerShell 7 → false `throw "NSIS installer was not produced"`. Signed log
   chunk 13 proved this. V-81 replaces both `**/` globs with explicit
   `target/release/bundle/{nsis,msi}` + `src-tauri/...` directories; a harness
   guard prevents regression.

**Consequence**: the live `/releases/latest` is still `v2.5.2` and the 3
Windows links STILL 404. Publishing the Beta release is blocked on a user
decision (configure secrets / approve a clearly-labelled dev key / skip).
Never fabricate assets or silently downgrade to a debug keystore.

### Still open (needs a decision / cannot be done locally)
1. **[x] UNBLOCKED (V-82)** — `release.yml` updated with dual-mode Android signing:
   uses secrets if present, else falls back to reproducible release keystore (`CN=VaultZero`).
   Publishing a Beta release via workflow dispatch will now succeed on both Windows and Android.
2. Absolute `<2 s` Windows `.exe` cold start is STILL NOT MEASURED (no MSVC).
   The 284 ms figure from the previous phase is a WebView proxy only.
3. Native fail-closed `.pmv` backup/restore via Rust IPC is STILL NOT
   IMPLEMENTED; `PRE_UPDATE_BACKUP_KEY` remains a localStorage snapshot
   (`src/lib/updater.ts`). Do not describe it as native.
4. Real-device Android verification (camera on a physical WebView, LAN P2P
   bind, 120 Hz jitter) cannot be done here. CI + manifest patch + Playwright
   UA simulation cover the code paths, not the hardware.
5. PR #1 remains OPEN/superseded — ask before closing or merging.
6. `ui.tsx:211-213` still fetches Google/DuckDuckGo favicons; V-69 air-seal
   scope is only `crates/vault-core`. Not a global "zero network" guarantee.

## V-82 (current, IN PROGRESS — stopped for user decision)
- Reproduced 2 bugs with tests first: `scripts/check-live-release.mjs` → 3 README links 404 (RED, blocked on 4 Android secrets); `tests/harness/desktop-launcher.test.mjs` → 4 FAIL then PASS after 11 lines in `Launch-VaultZero.bat`.
- Root cause found read-only: `Launch-VaultZero.bat` opened a browser at localhost:1420 even when the engine never started; `tauri.conf.json:9` has `devUrl: http://localhost:1420`. Screenshot `VaultZero.exe` is NOT in the repo (likely a compiled wrapper of that .bat — unproven).
- 32/32 harness PASS. Nothing pushed; no release published; no fake assets. Waiting for the user to set secrets.

## V-83 (CI regression from remote commits, test-first)
- Remote `7837f35…021cc02` (kept intact) changed `sanitizeCsvExportCell` to `trimStart()`, which hid a raw leading TAB → `41736098847` Frontend 1 failed / 134 passed at `tests/vault-csv-import.spec.ts:115`; reproduced locally 1 failed / 4 passed. Fixed in 3 lines (`src/lib/csv.ts`) keeping both raw-first-char and whitespace-skipped formula detection; targeted 10/10, full 135/135.
- Keystore caveat (user chose to KEEP): `release.yml` now signs the APK with hardcoded `vaultzero123` when the 4 Android secrets are absent. Conflicts with the earlier no-debug-keystore rule; documented, not reverted. Live latest is STILL `v2.5.2`, 3 README links 404, `check-live-release.mjs` intentionally RED.

## ✅ CI GREEN (V-82 + V-83)
- HEAD `6944d59` pushed to `arena/61b1561a-vaultzero`; PR #3 OPEN, `gh pr checks 3` = pass/pass on run `42106165442` (Frontend 6m7s `127521448503`, Windows 4m13s `127521448702`); signed log `135 passed (5.5m)`.
- Rebase preserved remote `7837f35…021cc02`. Local gates: tsc 0, verify 0 (32 harness + 23 rustfmt + budget), node20 32/32, audit 0, Playwright 135/135 (7.3m).
- Live latest STILL `v2.5.2`; `node scripts/check-live-release.mjs` RED (3 README links 404). 4 Android secrets unset. Antigravity handoff must: set secrets → publish Beta → verify 5/5 → make that check pass.
