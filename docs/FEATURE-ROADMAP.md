# VaultZero — Feature Roadmap & Optimization Proposals

Generated as part of the 2026-11 security & quality audit
(see [`AUDIT-2026-11.md`](./AUDIT-2026-11.md)).

---

## 1. High-value product features

### 1.1 Browser extension + native autofill  ⭐ highest impact
**Why:** The vault exists, but there is no path *into* a browser. A password
manager without autofill is a notes app. This is the single biggest gap
between VaultZero and Bitwarden/1Password.

**Scope:**
- A minimal MV3 extension that talks to the Tauri app over a
  **localhost native-messaging host** (never a cloud relay).
- Autofill matching on the active tab's registrable domain, with a
  **fuzzy-match ranking** (exact host > eTLD+1 > registered-domain).
- Never send secrets to the extension unless the user explicitly releases
  them; the extension asks the Rust core, the Rust core answers.

**Security constraints:** the extension must hold no vault data at rest; the
Rust core must gate every read behind an *unlocked session + idle timer*.

### 1.2 Passkeys / WebAuthn (platform authenticator)
**Why:** TOTP is increasingly the weakest link in a 2FA stack — phishable,
clonable, and increasingly deprecated by major services.

**Scope:**
- Extend the `Entry` model with a `passkeys: Vec<PasskeyEntry>` collection
  (`credential_id`, `public_key`, `sign_count`, `transports`, `aaguid`).
- Store the credential id and public key encrypted alongside the vault.
- Sign `webauthn.get` challenges in Rust (the private key never leaves the
  core, satisfying the existing "keys never cross into the WebView" claim).
- Support `credProps` and resident keys.

### 1.3 Encrypted blind-index search
**Why:** `SearchEngine::search` currently filters over **plaintext** entry
summaries in the Rust process, and the frontend also keeps a plaintext array
in memory.

**Scope:**
- Build a per-vault blind index: `HMAC-SHA256(index_key, lowercase(token))`
  for every token of every searchable field.
- The index is encrypted with the data key and persisted next to the payload.
- Search becomes: tokenize the query → HMAC each token → intersect.
- Enables searching without keeping plaintext resident, and scales to
  100k+ entries.

### 1.4 Signed auto-updates
**Why:** `src/lib/updater.ts` fetches a GitHub release and opens
`browser_download_url` with **no integrity verification**. The README
advertises checksums, but nothing in the code verifies them. A compromised
release (or a hijacked asset) would be silently installed.

**Scope:**
- Publish a signed manifest (`SHA256SUMS` + minisign/ed25519 signature).
- Verify before download; refuse to install on mismatch.
- Prefer Tauri's built-in updater with a configured `pubkey` over the
  hand-rolled GitHub polling.

### 1.5 Per-entry keyfile binding
**Why:** Today the `.vzkey` hardware keyfile unlocks the **entire** vault.
A stolen keyfile plus a weak master password is still a full compromise.

**Scope:** a per-entry wrapping key, `KEK_entry = Argon2id(master, salt ‖
entry_id)` combined with the hardware key, so a leaked keyfile only exposes
entries the attacker can also unlock with the master password.

### 1.6 Duress "plausible deniability" hardening
Already improved in this release (the decoy now has filler entries). Next:
- **Plausible vault size** — pad the decoy to a similar entry count.
- **Plausible timestamps** — decoy entries should have a believable
  modification history.
- **Decoy-on-keyfile-failure** — an optional "duress keyfile" that unlocks
  the decoy when the wrong keyfile is presented.
- **Duress wipe trigger** — a duress PIN that *appears* to unlock but also
  schedules a local wipe.

---

## 2. Performance & optimization

### 2.1 Release profile (done in this release)
`opt-level = "z"` → `opt-level = 3`, and `panic = "abort"` → `"unwind"`.
Argon2id and XChaCha20 are the hot path; the old profile penalised them.

### 2.2 Search indexing
`SearchEngine::search` lowercases every field of every entry on **every
keystroke** — 6 `to_lowercase()` allocations per entry per query. At 10k
entries that is ~60k allocations per keypress.

**Fix:** precompute a lowercase `search_blob` on the `EntrySummary` when the
entry is created/updated, and match against that single string. Expect a
large constant-factor win with zero behaviour change.

### 2.3 Domain-group caching
`group_by_domain` clones every summary and re-sorts on each call. The result
only changes when the vault does — cache it and invalidate on mutation.

### 2.4 OCR worker tuning
`src/workers/ocr.worker.ts` — add a `Worker` pool (2–4 workers) so multiple
screenshots can be processed concurrently, and stream partial results back so
the UI can show words as they are recognised rather than waiting for the
whole page.

### 2.5 Frontend render cost
`VaultHome.tsx` is 1,166 lines and `toolModals.tsx` is 951. The TOTP ticker is
already `React.memo`-isolated (good). The next win is virtualising the entry
list: render only the visible window of a 10k-item vault.

### 2.6 Tauri IPC batching
`list_entries` returns every summary on every call. For large vaults, add
pagination + an `updated_since` cursor so the renderer can fetch deltas.

---

## 3. Robustness & correctness

| Area | Proposal |
|---|---|
| **Durability** | `atomic_write` now fsyncs the parent directory. Add a `fsync` on the backup rotation path too. |
| **Recovery** | Add a "restore from backup" UI flow — `.bak1`…`.bak5` exist but the user cannot browse them. |
| **Import** | `parse_csv_import` is a naive line splitter; it cannot handle quoted fields containing newlines. Port the RFC 4180 parser from `src/lib/csv.ts` to Rust. |
| **P2P** | The Rust `start_p2p_host` accepts an arbitrary `payload` string from the renderer. Add a typed command that takes the vault and encrypts it in-core, so the plaintext snapshot never exists in the WebView. |
| **P2P** | Add an mDNS service-name validation so a hostile device cannot advertise a conflicting `_vaultzero._tcp.local.` service. |
| **TOTP** | Add per-entry clock-drift calibration; the current implementation assumes a perfectly synced clock. |
| **Audit** | Extend the in-memory audit trail to record *failed* unlock attempts and duress activations. |
| **Clipboard** | `copySecure` cannot read the clipboard in most browsers, so the wipe falls back to an unconditional clear — which can erase an unrelated value the user copied afterwards. Track a content hash instead. |

---

## 4. UI/UX & accessibility

### 4.1 Accessibility (V-16)
- Icon-only buttons need accessible names. `CsvImportModal`, `ItemSecurity`,
  `UpdateModal`, `UserProfileModal`, `VaultRecoveryModal` and `AmbientScene`
  currently have **zero** `aria-label` attributes.
- `Tooltip` is visual-only; expose its text to assistive tech via
  `aria-describedby`.
- Ensure every modal traps focus and restores it on close.
- Verify the colour contrast of `--faint` text against the glass surfaces at
  the smallest font scale.

### 4.2 New UX
- **Vault health dashboard** — surface the Security Center score on the home
  screen with a one-tap "fix the 3 weakest passwords" action.
- **Inline TOTP** in the item list, not only in the inspector.
- **Drag-and-drop reordering** for folders and tags.
- **Quick-add from the browser** via the `vaultzero://` URL scheme.
- **Command palette for actions**, not just search (currently search-only).

### 4.3 Duress UX
The duress password field on the Lock Screen is a plain text input with the
label "Duress decoy password (optional)". A user under coercion could be
hunted by muscle memory. Consider a dedicated gesture (e.g. long-press the
avatar) that toggles duress mode, and a decoy "recover" flow.

---

## 5. Build, CI & release hygiene

| Item | Current state | Proposal |
|---|---|---|
| **Rust toolchain in CI** | `dtolnay/rust-toolchain@stable` — unpinned | Pin to a specific version and add `rust-toolchain.toml` |
| **Frontend tests** | Playwright tests exist but **were not run in CI** | Add `npx playwright test` to `ci.yml` |
| **Audit of dependencies** | none | Add `cargo audit` + `npm audit` to CI |
| **Formatter check** | none | Add `cargo fmt --check` to CI |
| **Clippy** | present with `-D warnings` ✅ | keep |
| **Reproducible builds** | not pinned | Pin npm deps with `npm ci` ✅ (already done) |
| **Signing** | releases are unsigned | Sign the Windows installer and Android APK |
| **SBOM** | none | Generate a CycloneDX SBOM per release |

---

## 6. Suggested priority order

1. **Browser extension + autofill** — the feature that makes this a product.
2. **Signed auto-updates** — closes a supply-chain hole.
3. **Encrypted blind-index search** — correctness + scale + no plaintext resident.
4. **Passkeys / WebAuthn** — future-proofs the 2FA story.
5. **Search performance** (precomputed blob) + **virtualised list** — cheap, high impact.
6. **Restore-from-backup UI** — users will hit a corrupt vault eventually.
7. **Accessibility pass** — required for a serious security product.
