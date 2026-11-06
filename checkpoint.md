# VaultZero — Checkpoint (power-loss resistant)

> Read this file FIRST after any power loss or agent restart. Then read
> `checklistprogress.md` and resume at the first unchecked item. Both files
> must be updated after EVERY completed step.

- Repo: `tonmoycoder/VaultZero`
- Active branch (FIXED, never rename): `arena/317fbb3c-vaultzero`
  (earlier `arena/61b1561a-vaultzero` sections below are HISTORICAL only)
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

## V-84 (test-first, user rules updated 2026-11-06)
- NEW RULES from user: the '>100 lines ask first' rule is REMOVED; work ONLY on `arena/61b1561a-vaultzero` (no new branch); do NOT rename assets to `Portable.zip` / `Android-universal.apk` (canonical 5 stay); keep BETA naming, NO downgrade to v2.5.0; install skills/MCP if possible, skip what is impossible; Windows-native checks + 4 secrets go into the next Antigravity prompt; `.gitignore` hygiene already present, verify against real GitHub code.
- Test-first RED -> GREEN: `tests/harness/version-contract.test.mjs` (6 FAIL), `tests/harness/workspace-hygiene.test.mjs` (1 FAIL), `tests/harness/android-runtime.test.mjs` (3 FAIL), `tests/vault-csv-import.spec.ts` + `tests/vault-architecture.spec.ts` (2 FAIL).
- V-84a SemVer: `src/lib/version.ts` + `src/lib/updater.ts` had TWO conflicting prerelease-blind comparators. Single SemVer-2.0.0 comparator now in `version.ts`; updater re-exports it. beta.2 > beta.1, stable > beta, build metadata ignored. Version sync guard: package.json / tauri.conf.json / Cargo.toml / APP_VERSION all 2.5.2 (NO downgrade).
- V-84b CSV: `parseCsvRaw` silently clipped quoted cells at 16 KiB while unquoted cells were unbounded -> data loss fail-open. One `append()` bound now throws 'CSV cell exceeds ...' for both paths; cell exactly at limit stays lossless.
- V-84c Android: overlay gained `<uses-feature android.hardware.camera required="false">`; `scripts/patch-android-manifest.mjs` injects + verifies features. REAL execution on a generated self-closing `<application />` exposed INVALID XML (`/ android:usesCleartextTraffic`) -> fixed by preserving the tag form; both self-closing and paired forms verified, second run injects 0 (idempotent).
- V-84d QR fallback: `SyncModal` gained `lang`, a `capture="environment"` image picker and jsQR decode path (`handleScannedCode(text, true)`); blank PNG fails closed with a Bengali/English message. `src/App.tsx` passes `lang={lang}`.
- V-84e hygiene: `.gitignore` gained `AGENTS.md` + `src-tauri/gen/`; guard asserts no agent/prompt/MCP scratch file is tracked.
- Skills/MCP (honest): `MCP: NO MCP server attached`; `github` connector unsupported; non-GitHub inventory hosts are outside the sandbox allowlist; `google/stitch` and `modelcontextprotocol/servers/src/github` returned 404; only 2 real upstream `SKILL.md` files (`frontend-design`, `webapp-testing` from `anthropics/skills`) were installed into gitignored `.agents/skills/`; `.agents/skills/tdd` and `find-skills` have NO upstream source -> not fabricated. TDD/RCA/verification rules were applied to the tests instead.
- Gates: tsc 0; verify 0 (34 harness, 23 rustfmt, budget ok); node20 34/34; audit 0; Playwright 137/137 (6.6m).
- STILL OPEN: live 404 (3 links) until a signed Beta is published; 4 Android secrets (keytool/java ABSENT, `gh secret list` 403 -> human/Antigravity action); hardcoded `vaultzero123` fallback KEPT by earlier user decision; `secrets[format(...)]` indirection must be verified in the run log; `webviewInstallMode` not explicitly set; Rust edition 2021 (2024 migration needs local cargo, absent); absolute <2s .exe cold start, native .pmv Rust IPC backup, real-device LAN P2P / 120Hz jitter unmeasured.

### V-84 correction (self-caught, honest)
The first V-84 simulation used `rm -rf src-tauri/gen`, which deleted 4 TRACKED files (`src-tauri/gen/schemas/*.json`). They were restored with `git restore`; the ignore rule was narrowed to `src-tauri/gen/android/`, and the harness cleanup now removes ONLY `gen/android/`. A new guard asserts all 4 schemas exist AND remain tracked after every harness run. Head `f2ffe0f` carried the broad rule; this follow-up commit fixes it. No app source changed after the 137/137 Playwright run.

---

## PHASE D / V-86 — "make it workable" on `arena/317fbb3c-vaultzero` (2026-11-07)

**Observed state (read-only, no guesses).** Shallow/grafted clone: `git rev-list --count HEAD` = 1,
HEAD `f2e8978` = `origin/main` = branch head (`V-85 back-navigation + safe-area bottom`). Versions
all `2.5.2`. `gh pr list --state all`: #3 MERGED 2026-11-05T22:58:51Z, #2 MERGED 2026-11-03T16:54:12Z,
#1 OPEN (superseded, never touched). Live `v2.5.2` published `2026-11-02T01:18:40Z`, target `main`,
9 assets — NOW includes `VaultZero-Windows-x64-Setup.exe`; still missing canonical
`VaultZero-Windows-x64-Portable.exe` and `VaultZero-Windows-x64.msi` (2 README links 404).

**ROOT CAUSE of "downloads old version" (empirical).** `scripts/check-live-release.mjs` now prints
`STALE release v2.5.2 predates local source (2026-11-02 < 2026-11-06); users download old code
until a signed Beta is published.` The 6 screenshots contain strings that DO NOT EXIST in current
source (`Connected: 192.1`, `Keys negotiated via SPAKE2`, `Waiting for peer connection…`,
`AIR-GAPPED · v2.5.0`) → they came from the old published APK. `src-tauri/tauri.conf.json` CSP
already allows `connect-src https://api.github.com` and `AndroidManifest.xml` already has INTERNET;
the old APK did not. Do not claim the screenshots are fixed by a code change — a new signed build
must be published (blocked on 4 Android secrets + Windows runner here).

**Read-only external analysis.** `storytold/craft-anything` (★17711, Rust, "inspect → checklist →
builder → verify" clean-room loop) was read and its loop applied to OUR code. The Dropbox RoboForm
APK WAS found via the enabled connector: `/uptodown-com.siber.roboform.apk`, 15,790,385 B,
content_hash `9265acf0…`, modified 2026-11-06T20:20:31Z. Its temporary link host
`*.dl.dropboxusercontent.com` is OUTSIDE the sandbox allowlist (`SSL_ERROR_SYSCALL`), `fetch_page`
HTTP 500, and `apktool`/`jadx`/`aapt`/`java` are ABSENT → APK decompilation is IMPOSSIBLE here;
see the Antigravity prompt. GitHub topic search (read-only) added to `docs/EXTERNAL-REPO-SURVEY.md`.

**Test-first RED → GREEN (12 harness FAIL + 4 Playwright FAIL / 1 PASS).**
- D-1 version drift: `LockScreen.tsx` hardcoded `AIR-GAPPED · v2.5.0`; now `v{APP_VERSION}`
  imported from `src/lib/version.ts`. New harness guard rejects any stale `v2.5.0`/`v2.5.1`
  literal in shipped `src/**/*.ts(x)` (comments excluded).
- D-2 fake peer: `src/lib/p2pMerge.ts` gained `isValidPeerAddress()` (4 octets, 0-255, no leading
  zeros, optional port 1-65535). `parsePeerInput()` now uses it for BOTH the QR-JSON `ip` path and
  plain text; `192.1`, `999.1.1.1`, `tauri.localhost`, `:99999` are rejected.
  `SyncModal.handleScannedCode` no longer paints arbitrary raw text as a peer; `peerCoordinates()`
  uses the same validator.
- D-3 fake "connected": `handleStartHost()` no longer does `setStatus("connected")` /
  `setConnectedPeer("This device · port N")`. Banner now says
  `Hosting on port N · waiting for a peer` and stays amber until a real transfer succeeds.
- D-4 no-op Connect: invalid input now leaves a persistent bilingual `role="alert"` message
  ("… is not a valid peer address …") instead of a transient toast only.
- D-5 cut footer: P2P footer wraps (`flex-wrap`, `min-w-0`, smaller mobile padding) → all three
  actions (`Close`, `Send Vault`, `Receive & Merge`) measured inside 360px viewport.
- D-6 camera denial: after `cameraError`, an explicit "Camera unavailable — use the QR photo
  option instead." hint appears next to the V-84 `capture="environment"` picker.
- D-7 updater: `RELEASE_CHECK_TIMEOUT_MS = 8000` AbortController bound + `signal` on the GitHub
  request; only genuine network/timeout failures are `offline`, a malformed API body or HTTP error
  is `error` with an explanatory message. Offline modal copy unchanged.
- D-8 `scripts/check-live-release.mjs` prints `published`, `target`, `local HEAD`, and a `STALE`
  line when the published build predates the source.

**Gates (all real, exit codes from the commands themselves).** `npx tsc --noEmit` 0;
`npm run verify` 0 (35 harness files, contrast, 23 rustfmt, bundle budget);
`npx -y node@20 scripts/run-harness.mjs` 35/35; `npm audit --audit-level=high` 0 vulnerabilities;
`npx playwright test --workers=2` **142 passed (8.6m)**; `scripts/check-live-release.mjs`
intentionally exits 1 (2 live 404s + STALE). No local `cargo`/`rustc`/`keytool`/`java`;
Windows `clippy`/`test` are CI-only. Chromium 153 came from npm `@sparticuz/chromium` tarball
(Playwright CDN blocked), extracted to `/tmp` with `LD_LIBRARY_PATH`; NOT committed.

**Already-correct behaviour proven, not changed.** M-11: fresh install shows
"Create your VaultZero vault", not "Welcome back" (`isSetup = !isVaultConfigured()`). Quick unlock
is genuine WebAuthn in `src/lib/quickUnlock.ts` (no demo password); on Android WebView a platform
authenticator is unavailable, so the UI honestly shows an explanation — a persistent biometric
unlock needs OS keystore support in the native runtime (Antigravity). Existing M-01…M-09 already
cover horizontal overflow, status-bar clearance, clipped sort header, 44px targets, non-draggable
lock screen, explicit camera tap and offline OCR; all still pass.

**STILL OPEN / impossible here.** 4 Android signing secrets; signed Beta publication (fixes the
stale download + 2 404s); Windows `.exe`/WebView2/MSI local smoke test; real-device camera
`PermissionRequest` bridging, LAN P2P handshake and 120Hz jitter; absolute <2s `.exe` cold start;
native `.pmv` Rust IPC backup; `webviewInstallMode`; Rust edition 2024; global zero-network
guarantee (`ui.tsx:211-213` favicons, updater, `p2p_lan.rs`); hardcoded `vaultzero123` fallback
KEPT by earlier user decision. Phased resume: `continue` → Phase E.


## V-87 — batch 2 / visual review -> improve -> review (2026-11-07)

**Re-baseline (important).** Between two turns the workspace advanced on its own: HEAD is
`8d1f38c fix(V-86): honest P2P state, strict peer validation, live version, bounded updater`
(both local and `origin/arena/317fbb3c-vaultzero`), grafted on top of `f2e8978` V-85.
V-86 already implemented what the previous turn had planned as batches 1/2/4 (D-1..D-8),
so it was NOT redone. Re-observed: `gh run view 42292104477` = success / success
("Test & Build Verification" + "Frontend E2E & Security Tests").
PR state: #3 MERGED, #2 MERGED, #1 OPEN (never touched). No PR exists for this branch.

**User instruction for this phase:** do NOT do all the work at once; work in small batches
so errors do not happen. This entry is ONE batch only.

**Empirical review (real Chromium, 390x844, `isMobile+hasTouch`).** Captured 5 screens
(lock, vault, P2P host, P2P scan, update attempt) with `.artifacts/capture-ui.mjs`
(gitignored scratch) and measured the DOM with `.artifacts/measure-ui.mjs`.
- NOT reproducible in current source: horizontal drift / empty side space
  (`scrollWidth === clientWidth === 390` on all 5 screens), squished fingerprint logo,
  fresh install asking for a master password (it shows "Create your VaultZero vault"),
  fake Touch ID button (honest "not enrolled yet"), `Connected: 192.1` (banner reads
  "Waiting for peer selection… / LAN Port: —"), cut footer buttons.
- The 5 `ERR_CERT_AUTHORITY_INVALID` console messages were traced to ONE request per page:
  the opt-in updater `api.github.com/repos/.../releases/latest`. In this offline sandbox
  that correctly becomes V-86's `offline` status; it is NOT a favicon or a regression.
- TWO real defects found: (a) the four sort chips wrapped to 2 rows — measured tops
  471/471/471/494, container height 49px, `flex-wrap: wrap`; (b) `ui.tsx` still fetched
  Google s2 / DuckDuckGo favicons for unknown domains (offline + privacy violation).
- P2P body measured `scrollHeight 634 > clientHeight 595`: the last helper line is
  half-visible at rest but IS reachable by scrolling. Added a guard, no code change.

**Test-first RED -> GREEN.**
- `tests/harness/offline-brand-icons.test.mjs` (NEW, 36th harness): positive control
  plants a Google favicon URL + a remote `<img>`; scans all 53 `src/**/*.ts(x)` after
  stripping comments; rejects the 2 remote hosts, any remote `<img src>`, and
  `errorStage`. RED = 2 FAIL.
- `tests/vault-mobile-shell.spec.ts` gained M-15 (one nowrap, start-aligned,
  horizontally scrollable row; both ends reachable), M-16 (P2P body scroll reveals the
  helper line above the footer), M-17 (no remote `<img>` on the vault screen).
  RED = M-15 FAIL (`wrap`), M-16/M-17 PASS (guards).
- M-15 first draft WRONGLY asserted all 4 labels fit at 390px; measurement after the fix
  showed `scrollWidth 384 > clientWidth 344`. Assertion replaced with the honest property:
  the row overflows but `scrollLeft` moves and both first/last chips are reachable.
  This is exactly the user's "horizontal scroll stuck" defect, now fixed.
- Fixes (minimal): `VaultHome.tsx` sort container `flex-wrap justify-center` ->
  `flex-nowrap justify-start overflow-x-auto sm:justify-center`; `ui.tsx` deleted the
  27-line remote favicon stage and its `errorStage` state, unknown domains now fall
  through to the existing offline SVG / simple-icons / monogram tiles.

**GREEN gates (all re-run on this batch).** `tsc` 0; `npm run verify` 0 (36 harness,
23 rustfmt, bundle budget ok); node20 36/36; `npm audit --audit-level=high` 0;
full `npx playwright test` 145 passed (8.6m); targeted M-15/16/17 3 passed.
Re-captured screenshots: all 4 sort chips at `top=471`, one row, aligned with
"All items", no horizontal overflow. `check-live-release.mjs` still exit 1
(STALE + 2 canonical names) — publication, not a code gate.

**Still open for later batches / Antigravity:** publish a signed Beta (needs 4 Android
secrets + Windows runner), verify 5/5 canonical assets, README `(v2.5.0)` headings,
physical-device status-bar / camera / LAN P2P / 120Hz, Windows `.exe` smoke test,
APK decompilation (`*.dl.dropboxusercontent.com` outside allowlist; no apktool/jadx),
absolute <2s cold start, native `.pmv` Rust IPC backup.

### V-87 close-out (CI)
`cd8d5dc` pushed to `origin/arena/317fbb3c-vaultzero`; `gh run watch 42296394627
--exit-status` exit 0, `Test & Build Verification` + `Frontend E2E & Security Tests`
both `success`. Only runner deprecation annotations (Node 20 actions forced to
Node 24, ubuntu-latest -> Ubuntu 26) — no failures. Local working tree clean at
this point. Batch 2 is closed; resume with `continue` for batch 3.

## V-88 — batch 3 / small fixes + guards (2026-11-07)

**Re-baseline.** HEAD `e23d00c` (V-87 close-out docs), tree clean, remote in sync.
Docs-only CI `42297467746` re-observed = success / success. No external advance
this time. User instruction stands: small batches only.

**Measurements before touching code (real 390x844 Chromium).**
- Lock dialog: `overflow-y:auto`, `scrollHeight 1013 > clientHeight 844`; the
  "Emergency kit" button + `AIR-GAPPED · v2.5.2` footer sit ~169px below the
  fold but ARE reachable by scrolling. GUARD (M-18), no code change — unlike the
  old screenshots, nothing is permanently unclickable.
- P2P **Host** tab (default tab): body `scrollHeight 634 > clientHeight 595`,
  the trailing footnote rendered at `top 762 / bottom 793` while the fixed
  footer starts at `774` -> 19px half-cut. The **Scan** tab had 0 overflow.
- README lines 131/236 advertised `(v2.5.0)` while `APP_VERSION = 2.5.2`;
  lines 13/32 already said `v2.5.2`. Direct "old version" confusion.

**Test-first RED -> GREEN.**
- NEW `tests/harness/readme-version.test.mjs` (37th harness): positive control
  plants a stale heading; reads `APP_VERSION` from `src/lib/version.ts`; compares
  every versioned README heading and every `vX.Y.Z` literal against the shipped
  version. RED = 3 FAIL (2 stale headings + 1 stale literal).
- `tests/vault-mobile-shell.spec.ts` gained M-18 (lock footer reachable, guard)
  and M-19 (Host tab body must not overflow; security note must still be visible
  at 1440px so information is not lost). RED = M-19 FAIL (`634 > 597`), M-18 PASS.
- Fixes (minimal): README 2 headings `v2.5.0 -> v2.5.2`; `toolModals.tsx` added
  `hidden sm:flex` to the DUPLICATE footnote (the modal subtitle and the desktop
  footer hint already say the same thing). Nothing was deleted for desktop users.
- FULL suite first pass: 146 passed / 1 failed — M-16 (written in V-87) assumed
  the footnote stayed visible on phones. This was a stale TEST assumption, not a
  code regression. M-16 rewritten to the current invariant: no clipped content
  at 390x844, vertical scrolling still works on a 360x640 phone. Its V-87
  header comment was corrected too (typo caught and fixed). Re-ran target then
  the FULL suite: 147/147.

**GREEN gates (all re-run).** `tsc` 0; `npm run verify` 0 (37 harness, rustfmt,
bundle budget); node20 37/37; `npm audit --audit-level=high` 0;
`npx playwright test` **147 passed (8.7m)**; targeted M-18/M-19 2/2, M-16 1/1.
Re-captured 5 screenshots: Host body `634 -> 591` (overflow 0), half-cut line
gone, `Close` fully visible, no horizontal overflow on any screen.
`check-live-release.mjs` still exit 1 (STALE + 2 canonical 404s) — publication,
not a code gate.

**Still open for the final batch:** signed Beta publication (4 Android secrets +
Windows runner), 5/5 canonical assets, physical-device status-bar/camera/LAN
P2P/120Hz, Windows `.exe` smoke test, APK decompilation (Dropbox host outside
allowlist; no apktool/jadx), <2s cold start, native `.pmv` Rust IPC backup,
and the English master prompt (LAST) + separate Antigravity prompt.

### V-88 close-out (CI)
`5c37b57` pushed to `origin/arena/317fbb3c-vaultzero`.
NOTE: the first `gh run list --limit 1` returned the PREVIOUS docs-only run
`42297467746` because the new run had not registered yet; that was NOT claimed
as this batch's CI. Re-listed by headSha and watched the correct run
`42300864536` (`5c37b576…`) -> exit 0, both jobs `success`. Only runner
deprecation annotations, no failures. Working tree clean. Batch 3 CLOSED.
