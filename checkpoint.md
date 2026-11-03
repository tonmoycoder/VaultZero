# VaultZero — Checkpoint (power-loss resistant)

> Read this file FIRST after any power loss or agent restart. Then read
> `checklistprogress.md` and resume at the first unchecked item. Both files
> must be updated after EVERY completed step.

- Repo: `tonmoycoder/VaultZero`
- Active branch (FIXED, never rename): `arena/61b1561a-vaultzero`
- Base: `main` @ `df048f9d3276c4eaf7b2b0f3220c69ff4b56d800`
  (`docs(readme): update version badge to v2.5.2`, 2026-11-03 22:53 +0600)
- PR #3 OPEN (`arena/61b1561a-vaultzero` → `main`), head `910a23b`.
  CI `41713265261`: Frontend PASS 6m38s, Windows FAIL 42s (V-80, see below).
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

### Still open (needs a decision / cannot be done locally)
1. Publish a **Beta** release via
   `gh workflow run "Release (Windows Installer & Android APK)" --ref arena/61b1561a-vaultzero -f tag_name=v2.6.0-beta.1`
   AFTER this branch is pushed and CI is green. This is the ONLY way to put
   real Windows binaries on `/releases/latest` and end the 404s; the local
   sandbox has no MSVC/WebView2/Android NDK. Watch the run and verify all 5
   assets with `gh release view`. If Android signing secrets are missing the
   Android job will fail closed (that is by design).
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
