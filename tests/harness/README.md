# Browserless verification harnesses

These are Node scripts that exercise the pure-logic parts of the app
without a browser. They exist because the CI image can run `node` but the
Playwright browser download is not always available.

Every harness imports a **bundle built from the real source** — run
`node scripts/build-test-bundles.mjs` first. The bundles are generated into
`.harness-build/` inside the repository and are gitignored.

Two conventions make the suites portable:

- every path is derived from `import.meta.url`, so a harness runs from any
  working directory;
- every bundle is imported through a `file://` URL, because a bare Windows
  path is not a valid ESM specifier.

| Harness | What it proves |
| --- | --- |
| `url-sanitizer.test.mjs` | V-40 — user-supplied URLs can never reach a code-executing sink (`javascript:`, `data:`, …). |
| `lock-flush.test.mjs` | V-36 — the final coalesced write survives a vault lock. |
| `lock-flush-regression-proof.mjs` | V-36 — reproduces the old ordering's data loss and shows the new one fixes it. |
| `legacy-migration.test.mjs` | V-35 — a legacy PBKDF2 vault still opens and is migrated to Argon2id. |
| `checksum-e2e.test.mjs` | V-32 — the release checksum is genuinely enforced end to end. |
| `kdf-parity.test.mjs` | V-35 — the browser keyfile mixing matches the native core. |
| `rust-kdf-mirror.test.mjs` | V-35 — the Rust `derive_kek` behaviour, mirrored, matches the browser. |
| `keyfile-edge.test.mjs` | V-35 — an empty keyfile file does not brick the vault. |
| `storage-growth.test.mjs` | V-39 — `localStorage` does not grow without bound. |
| `storage-security.test.mjs` | V-29 — no plaintext secrets survive in the session object. |
| `autolock.test.mjs` | The auto-lock timer locks the vault on inactivity. |
| `breach.test.mjs` | The breach scanner is offline by default and caches ranges. |
| `round2.test.mjs` | Entropy, uniqueness and updater URL trust. |
| `copyall.test.mjs` | Copy All omits TOTP secrets and recovery codes. |
| `argon-perf.test.mjs` | Argon2id performance and slot metadata. |
| `argon-recovery.test.mjs` | The recovery slot is Argon2id. |
| `brand-mirror.test.mjs` | The Rust brand-matching behaviour, mirrored. |

Run them all:

```bash
node scripts/build-test-bundles.mjs
for f in tests/harness/*.test.mjs; do node "$f" || exit 1; done
```
