# VaultZero — Checkpoint (power-loss resistant)

> Read this file FIRST after any power loss or Antigravity restart. Then read
> `checklistprogress.md` and resume at the first unchecked item. Both files must
> be updated after EVERY completed step.

- Repo: `tonmoycoder/VaultZero`
- Active branch (FIXED, never rename): `arena/907dafa8-vaultzero`
- Active PR: **#2** — https://github.com/tonmoycoder/VaultZero/pull/2 (OPEN, head `ab2a8ca`)
- Superseded PR: **#1** (`arena/79f3d1ba-vaultzero` @ `5c98a1f`), OPEN — DO NOT inspect / push
- Base: `main` @ `53c026c` · tag `v2.5.2` @ `1090a66`
- Commits: `0758b23` → `ee17368` → `b3a6125` → `c6fe373` → `ab2a8ca`
- Screenshot: `/tmp/arena-coding-uploads/image-3.png` CURRENT (two open PRs); `image-2.png` STALE
- Tags/repos conclusion: only `VaultZero` is relevant; all other repos are read-only references
- Gitignored workspace memory (`.gitignore:41`): `.agent/IMMUTABLE_RULES.md`, `.agent/PROGRESS_LEDGER.md`

## Live preview (restored 2026-11-03)

- Process `website-3326e381` (`npm run dev -- --host 0.0.0.0 --port 1420`) — RUNNING,
  listening on `0.0.0.0:1420`. Previous process `vaultzero-dev-server-5f76b3d2` stopped
  cleanly before restarting (no duplicate port owner).
- `vite.config.ts` already has `host: "0.0.0.0"`, `strictPort: true`, `allowedHosts: true`
  (so the per-session `*.e2b.app` host is NOT rejected with 403). `index.html` has no
  CSP/`X-Frame-Options`, so iframe embedding is allowed.
- Verified after restart: `HTTP 200` for localhost AND a spoofed
  `Host: 1420-907dafa8.e2b.app`; `/src/main.tsx` 200; `/@vite/client` 200;
  headless Chromium renders `VaultZero v2.5.2 LOCAL-ONLY VAULT` shell,
  `#root` has 1 child, zero page/console errors (expected offline
  `api.github.com` cert noise filtered). No preview-breaking warnings reported.

## Rules (immutable)

User-facing prose/replies/final report MUST be Bengali; technical spec may be English.
ROPE empirical engineering. No guesses, stubs, fake fallbacks, half-finished tasks or
over-engineering. Fail-closed native `local-vault.pmv`. Zero regressions. "Make no mistake".

Gates: `cargo clippy --all-targets -- -D warnings` (Windows CI; no local cargo/rustc),
`npx tsc --noEmit`, `npm run verify`, `npx -y node@20 scripts/run-harness.mjs`,
`npx playwright test`, `npm audit --audit-level=high`, `gh pr checks 2` BOTH green,
absolute `<2s` `.exe` cold-start (**NOT YET MEASURED** — no MSVC toolchain; the 284 ms
figure is a headless-Chromium WebView proxy, never claim it satisfies the exe gate).

## Verified at `ab2a8ca`

```
npx tsc --noEmit                       PASS
npm run verify                         PASS  25/25 harness · 23 Rust formatted · bundle budget OK
npx -y node@20 scripts/run-harness.mjs  PASS  25/25
npx playwright test --workers=1        PASS  124/124 (9.3m)
npx playwright test (CI workers:2)     PASS  124/124 (6.4m)  [local only]
npm audit --audit-level=high           PASS  0
CI 41544347392 / 41555106402           PASS  both jobs green
cold-start proxy                       TTFB 3ms · DCL 72ms · paint 52–64ms · React shell 284ms
```

## ✅ V-70 — CI 41558464980 root cause FOUND and fixed (2026-11-03)

`blob.core.windows.net` is not in the sandbox allowlist, so
`gh run download 41558464980` ended in EOF. The authenticated job-log redirect
was captured WITHOUT following it (`curl -D` on `actions/jobs/125663019229/logs`
→ 302 to a signed plain-text Azure URL) and the plain-text log was read with
`fetch_page` (different network). **8 chunks**; chunk 6/7 contain:

```
1) tests/vault-architecture.spec.ts:97:3 › ... › Multi-select checkboxes trigger Floating Bulk Actions Bar
   Error: expect(locator).toBeVisible() failed
   Locator: getByRole('button', { name: 'Delete selected' })
   Expected: visible / Timeout: 7000ms / Error: element(s) not found
   at tests/vault-architecture.spec.ts:106:73
   123 passed (6.5m) · 1 failed
```

Root cause: `checkbox.click({ force: true })` bypasses Playwright's stability +
hit-target checks while `VaultHome.tsx` renders the card with
`whileHover={{ y: -4 }}` bouncy spring. Under `workers: 2` load the force-click
lands on the moving card body (opening the inspector) instead of the 16px
checkbox, so `checkedIds` stays empty and the bulk bar never mounts. Language
hypothesis RULED OUT (`readStoredLanguage()` defaults to `en`, `beforeEach`
clears localStorage). Fix = `card.hover()` + normal `checkbox.click()` +
`expect(checkbox).toHaveAttribute("aria-checked", "true")` before asserting the
bar. Verified targeted `--repeat-each=20 --workers=2` → **20/20 passed**.

## ✅ Completed this step

- V-69 `tests/harness/air-seal.test.mjs` WRITTEN and PASS (7 positive controls,
  19 `crates/vault-core/src/*.rs` files + `Cargo.toml` guarded), Node 20 parity OK.
- V-71 `tests/harness/bengali-kit.test.mjs` WRITTEN and PASS (Node 20 parity OK):
  `EmergencyKitModal` now takes `lang`, every visible kit string goes through
  `S("bn","en")`, printed HTML has `lang` + Bengali fonts, and the JSX preview's
  literal `${documentId}` bug is fixed to `{documentId}`. English mode intact.
- README lines 6–165 converted to Bengali prose (all 10 stable asset links,
  tables, code blocks, labelled "English Documentation" section preserved);
  `এম্যানুয়ালিভাবেও` typo fixed to `থেকেও ম্যানুয়ালিভাবেও`.
- `npx tsc --noEmit` PASS after all source edits.

## ✅ Full gate set on the new working tree (before push)

```
npx tsc --noEmit                          PASS
npm run verify                            PASS  27/27 harness · 23 rustfmt · bundle OK
npx -y node@20 scripts/run-harness.mjs    PASS  27/27
V-70 targeted --repeat-each=20 --workers=2 PASS 20/20 (2.0m)
npx playwright test (exact CI config)     PASS  124/124 (6.4m)
npm audit --audit-level=high              PASS  0
```

`docs/AUDIT-2026-11.md` Follow-up 6 documents V-69/V-70/V-71;
`docs/EXTERNAL-REPO-SURVEY.md` V-69 status is now IMPLEMENTED.

## ⚠ STILL OPEN — resume here

1. Commit + push `arena/907dafa8-vaultzero` and require `gh pr checks 2` BOTH
   green on the NEW run. Do NOT claim CI green until observed.
2. Still open: native `.pmv` backup, Android install UX, `tokio features=["full"]`,
   `SecurityCenter.tsx`/`VaultHome.tsx` physics rollout, published release asset
   existence, absolute `<2s` `.exe` cold-start (NOT measured), no local cargo.
4. Deliver the final Bengali report (verification numbers + Big-O + memory
   trade-offs + honest caveats), THEN the Gemini 3.8 Flash / Entry Gravity master
   prompt LAST, referencing BOTH this file and `checklistprogress.md`.

## Environment notes

- Chromium: `VAULTZERO_CHROMIUM=/tmp/chromium/chromium`,
  `LD_LIBRARY_PATH=/tmp/chromium-libs/lib:/tmp/chromium`, **unset** `FONTCONFIG_FILE`.
- Node locally 22.22.3; CI Node 20 (use `npx -y node@20` for parity).
- No `cargo`/`rustc` locally → Rust gates only verified in Windows CI;
  rustfmt via WASM `scripts/check-rust-format.mjs`.
- `gh pr edit 2 --title` fails (Projects classic deprecation); use
  `gh api -X PATCH repos/tonmoycoder/VaultZero/pulls/2`.
- Never `pkill -9 -f "node.*1420"` (it once deleted `node_modules`); never
  `npm run verify 2>&1 | tail` as a success check (that exit code is tail's).
- 2026-11-03: E2B workspace was DOWN for two full turns; that outage is now over.
  No commits were made during it. This turn restored the preview and wrote the
  three previously blocked documents. No commit/push yet.
