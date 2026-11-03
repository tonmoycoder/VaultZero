# VaultZero — Master Audit & Remediation Brief
### For Antigravity (and any senior engineer picking this up)

**Repo:** `tonmoycoder/VaultZero`
**Branch:** `arena/79f3d1ba-vaultzero`
**Reference PR (Round 1 — already merged into this branch):** [#1](https://github.com/tonmoycoder/VaultZero/pull/1)
**Round 1 audit doc:** [`docs/AUDIT-2026-11.md`](./docs/AUDIT-2026-11.md)
**Round 2 (this file):** deeper pass — modules skipped in round 1, release
pipeline, CI, performance, and UI/UX.

> **READ THIS FIRST.** The code in the reference PR is a **working
> implementation** of the fixes described here. It is a *reference*, not a
> spec to copy verbatim. **Write your own implementation.** Where the
> reference has a bug or a shortcut, do it better. The goal is a correct,
> fast, maintainable codebase — not a diff that matches PR #1.

---

## 0. How to use this document

Each finding has a stable ID (`V-18` … `V-48`). The IDs are referenced by the
tests in `tests/` and by the prompt at the end of this file.

Priority legend:

| P | Meaning |
|---|---|
| **P0** | Ships a false security guarantee, or leaks secrets. Fix before release. |
| **P1** | Real vulnerability or data-loss. Fix this cycle. |
| **P2** | Correctness / performance / robustness. Fix this cycle if cheap. |
| **P3** | Polish, UX, docs. Next cycle. |

---

# ROUND 2 — NEW FINDINGS

## V-18 · P1 · `breachScanner.ts` contradicts the "Air-Gapped by Design" claim

**File:** `src/lib/breachScanner.ts:123`

```ts
const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, { ... });
```

`SECURITY.md` states:

> **Air-Gapped by Design**: No telemetry, analytics, remote crash reporters, or
> **outbound internet HTTP requests** exist anywhere in the codebase.

That is false. The breach scanner makes an outbound HTTPS request to a
third-party service — for **every password** in the vault.

**Consequence chain:**
1. Round 1 tightened the CSP to `connect-src 'self'`, which now **blocks**
   the call on the desktop build. The feature silently degrades to
   "offline only" with no user-visible explanation. (Round 1 caused this;
   round 2 must resolve it properly rather than leave a broken feature.)
2. The **web/Vite build has no CSP at all**, so the call *does* go out there.
3. The two platforms behave differently for the same user action.

**Required fix:**
- Make the network behaviour **explicit and opt-in**, not silent:
  - Default = fully offline. The offline dictionary still runs.
  - If the user opts in to "online breach check", show a clear consent dialog
    that states *exactly* what leaves the device (a 5-character SHA-1 prefix
  per password — see V-19).
- Make the two build targets behave identically. If the desktop build must
  stay air-gapped, the web build should either get a matching CSP **or** the
  feature should be disabled on both with a clear message.
- Update `SECURITY.md` so the claim matches reality. Either remove the
  outbound request, or document it precisely as an *opt-in* exception.

---

## V-19 · P0 · The k-anonymity implementation leaks a per-password fingerprint

**File:** `src/lib/breachScanner.ts:82-160`, `src/components/SecurityCenter.tsx:97-120`

The k-anonymity model is: send a hash *prefix*, receive the whole range, and
match locally. The prefix must be **coarse enough that many users share it**.

The current code computes a **fresh 5-character SHA-1 prefix for every
password** and queries it **one password at a time**:

```ts
for (const item of items) {
  const res = await checkPasswordBreach(item.password, "en");  // one fetch per item
```

**Why this breaks the guarantee:**
- HIBP's range for a 5-char prefix contains ~800k hashes. But if only *one*
  password in the vault maps to that prefix, the server learns "this client
  owns the one password in range `A3F2B`". The anonymity of the bucket is
  destroyed for that prefix.
- Across a 500-item vault, 500 distinct prefixes are queried **sequentially**,
  one at a time. The server can trivially correlate them into one session and
  build a fingerprint of the whole vault.
- Every request is sequential (`await` in a `for` loop) — 500 HTTPS
  round-trips, no concurrency, no batching, no caching.

**Required fix:**
- **Batch**: collect all distinct prefixes, fetch the unique set **in
  parallel** (bounded concurrency, e.g. 4–8), then match every password
  against the downloaded ranges.
- **Dedupe**: identical passwords must produce exactly **one** prefix and
  **one** fetch. Cache the range response in memory (and optionally on disk,
  with a TTL) so re-scanning is free.
- **Widen the prefix** where the API allows, or at minimum document the
  residual fingerprinting risk honestly.
- Add a **request counter** and show it in the UI ("3 range queries for 250
  passwords") so the user can reason about the leakage themselves.

---

## V-20 · P0 · The security audit log writes vault metadata to `localStorage` in plaintext

**File:** `src/lib/breachScanner.ts:246-278`, `src/components/SecurityCenter.tsx:114`

```ts
const logDetail =
  leaked.length > 0
    ? `Found ${leaked.length} compromised password(s): ${leaked
        .map((b) => `"${b.item.title} (${b.item.username || "no email"})"`)
        .join(", ")} via HIBP k-anonymity ...`
    : ...;

localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
```

The vault itself is encrypted. This audit log — sitting in the **same
`localStorage`**, right next to it — contains **every entry title and every
username/email in plaintext**, unencrypted, for up to 30 entries.

`src/components/SecurityCenter.tsx:110`:

```ts
`Found ${leaked.length} compromised password(s): ${leaked
    .map((b) => `"${b.item.title} (${b.item.username || "no email"})"`)
    .join(", ")} via HIBP k-Anonymity [SHA1: ${leaked[0]?.result.sha1Prefix || ""}***]`
```

This defeats the purpose of the encrypted vault: an attacker with disk access
(or any XSS) reads `localStorage` and gets a cleartext index of every
account in the vault (but not the passwords).

**And it leaks the hash prefix too.** The `SHA1: <prefix>***` fragment in the
same string means the log hands an attacker the **first 5 hex characters of
the SHA-1 of a real password**. That is exactly the value the k-anonymity
scheme sends to HIBP — it is enough to confirm a *candidate* password
offline (the attacker hashes their guesses and compares the prefix) and it
is enough to correlate the user with their HIBP request. Putting it in a
persistent, plaintext log extends the k-anonymity leak from "one request" to
"forever, on disk".

**Required fix:**
- The audit log must be **encrypted** with the same data key, or held in
  **memory only** (matching the in-memory `SecurityAuditLog` added to the Rust
  core in PR #1).
- It must never contain secret material. Entry **titles and usernames are
  metadata about secrets** — treat them as sensitive.
- **Remove the `SHA1: <prefix>***` fragment entirely.** Never persist a hash
  prefix, a hash, or any derivative of a password — not even a prefix, not
  even in a log.
- Decide explicitly: is this log meant to survive a restart? If yes, encrypt
  it. If no, keep it in memory and say so in the UI.

---

## V-21 · P1 · `SecurityCenter` deep audit is O(n) sequential network calls

**File:** `src/components/SecurityCenter.tsx:97-120`

See V-19. For a 500-item vault this is 500 sequential HTTPS requests. The UI
blocks with a `setTimeout(..., 500)` fake delay while the real work happens
afterwards.

**Required fix:** see V-19 (batch + dedupe + bounded concurrency). Also:
report progress ("47 / 250 checked"), and allow cancel.

---

## V-22 · P2 · `ItemSecurity` fires a breach request per item, unmemoised

**File:** `src/components/ItemSecurity.tsx:59-67`

Every mount of the inspector panel triggers a network request. Opening and
closing the inspector repeatedly re-hits the API.

**Required fix:** share the range cache from V-19 across the whole app so a
second scan of the same prefix is free.

---

## V-23 · P0 · The passphrase wordlist is ~78 words — 51% weaker than EFF Diceware

**Files:** `src/lib/generate.ts:6-15` (78 words), `crates/vault-core/src/generator.rs` (`DICEWARE_WORDLIST`, 77 words)

```
TS  wordlist size      : 78   -> 6.29 bits/word
EFF Diceware standard  : 7776 -> 12.93 bits/word
5-word passphrase      : 31.4 bits   (EFF: 64.6 bits)
10-word passphrase     : 62.9 bits   (EFF: 129.3 bits)
```

A 5-word passphrase from this list has **31.4 bits** of entropy. A modern
GPU rig tries ~10^10 guesses/second. 31 bits is cracked in **under a second**
by an offline attack. The README advertises this as a security feature.

This is the single most damaging finding in round 2: it is not a bug, it is
a **catastrophically weak primitive shipped as a strength**.

**Required fix:**
- Replace the wordlist with the **EFF large wordlist (7,776 words)**, or at
  minimum a list of ≥2,048 words. Both lists must live in **one** shared
  place (Rust is the source of truth; the TS list should be generated from it
  or vice versa) so the two implementations cannot drift.
- **Deduplicate words** inside a passphrase (sampling *without* replacement)
  to remove the repetition leak.
- Re-verify the entropy claim in the UI against the *actual* list size. Show
  the real bit count, not a hand-waved number.
- If you cannot ship the full 7,776-word list in this change, then **disable
  the passphrase generator** and say why. A weak generator that looks strong
  is worse than no generator.

---

## V-24 · P1 · Passphrase entropy is reported wrong

**Files:** `src/lib/generate.ts` (`generatePassphrase` appends `!` + a random
digit — a token of ~6.6 bits that is *not* counted anywhere), `crates/vault-core/src/generator.rs`
(no separator entropy counted).

The trailing `!" + digit` suffix adds entropy but is invisible to any UI
that displays "N words = X bits". The displayed number is therefore wrong in
one direction; the repetition allowance is wrong in the other.

**Required fix:** compute the reported entropy from the *actual* construction,
including the suffix, and account for word repetition.

---

## V-25 · P1 · `start_p2p_host` accepts an arbitrary payload from the renderer

**File:** `src-tauri/src/lib.rs:478-488`

```rust
pub async fn start_p2p_host(
    pin: String,
    payload: String,      // <-- arbitrary renderer-supplied string
    device_name: Option<String>,
    ...
```

Two problems:

1. The renderer chooses the bytes that get encrypted and shipped to the peer.
   A compromised renderer can make the host serve *any* content to any peer
   that knows the PIN — a confused-deputy.
2. **The frontend currently passes `payload: ""`** — an empty string. So the
   "Send Vault" feature ships nothing at all.

**Required fix:** the Rust command should take **no payload**. It should
read the vault from its own `AppState` session, encrypt it in-core, and serve
that. The renderer never handles the snapshot bytes. Then wire the frontend
to it properly.

---

## V-26 · P1 · `VaultError` strings leak internal detail to the UI

**Files:** `crates/vault-core/src/errors.rs`, `src/lib/platform.ts:33-40`

```ts
const msg = err instanceof Error ? err.message : String(err ?? 'Native IPC error');
...
safeMessage: msg.slice(0, 240),
```

The Rust error variants include things like
`"File header is invalid or has wrong magic bytes (expected PMV1)"` and
`"RAM memory lock error: ..."`. These are surfaced to the user verbatim.

**Required fix:** map Rust error variants to **stable, user-safe codes**
(`AUTH_FAILED`, `VAULT_MISSING`, `TAMPERED`, `IO`) and send a fixed safe
message per code. Keep the detailed text in the Rust-side audit log only.

---

## V-27 · P1 · Brand matching uses substring `contains()` — phishing look-alikes get the real brand's icon

**File:** `crates/vault-core/src/brands.rs:126-139`

```rust
if u_clean.contains(kw) || t_clean.contains(kw) {
    return Some(b);
}
```

Verified mis-matches:

| Title / URL | Matched brand | Should be |
|---|---|---|
| `https://notgoogle.com` | **google** | no brand |
| `https://fake-netflix-login.com` | **netflix** | no brand |
| `My Github Account` | github | github (ok) |

A password manager showing the **real Google logo** next to
`notgoogle.com` is an active phishing aid: the user's eye has been trained to
trust that icon.

**Required fix:**
- Match on the **registrable domain** (eTLD+1), not a raw substring.
  `notgoogle.com` → registrable domain `notgoogle.com` ≠ `google.com`.
- Only allow a **whole-label** match: `mail.google.com` → `google.com` is
  correct; `notgoogle.com` must not match `google.com`.
- Do **not** match brand names against the user-entered *title* at all, or
  require a whole-word match (`"My Github Account"` is fine;
  `"Not Google"` is not).
- Add a regression test for every look-alike in the table above.

---

## V-28 · P2 · `PasswordHistoryEntry` and `TotpConfig.secret` are never zeroized

**File:** `crates/vault-core/src/models.rs`

`Entry` implements `Drop` + `ZeroizeOnDrop` (good), but:

- `PasswordHistoryEntry.password` — a **previous** password — is a plain
  `String` with no zeroization.
- `TotpConfig.secret` — the **2FA seed** — is a plain `String` with no
  zeroization.
- `RecoveryCode.code` — same.

`Entry::zeroize()` (implied by the `Drop` impl) cannot wipe these because
they are nested plain `String`s unless it explicitly does so.

**Required fix:** implement `Zeroize`/`ZeroizeOnDrop` for
`PasswordHistoryEntry`, `TotpConfig`, and `RecoveryCode`, and make
`Entry::zeroize()` recurse into every field. `SECURITY.md` claims "Keys,
intermediate digests, and decrypted memory blocks are wiped with zeroes
immediately upon leaving scope" — make that literally true.

---

## V-29 · P1 · The master password lives in the WebView as an immutable JS string

**File:** `src/lib/storage.ts:95-101`

```ts
export interface UnlockedSession {
  isDuress: boolean;
  items: VaultItem[];
  masterPassword?: string;   // <-- immutable JS string, cannot be wiped
  keyfileHex?: string;        // <-- the raw hardware keyfile, hex
  recoveryKey?: string;
}
```

`SECURITY.md` claims:

> **Key Isolation**: Master keys and raw derived secrets **never** cross into
> the frontend WebView JavaScript runtime.

They do. And a JS `String` is **immutable and interned** — assigning `""` to
the field does not erase the original bytes; they stay in the heap until
GC, and may be copied into other strings along the way.

**Required fix (pick one, in order of preference):**
1. **Best:** stop holding the master password in the frontend at all. The Rust
   core derives and keeps the key; the frontend never sees it. The browser
   path needs a redesign (keep the derived `CryptoKey` only — WebCrypto
   `CryptoKey` objects with `extractable: false` are non-exportable by
   design).
2. If the browser path must keep it: store it in a `Uint8Array` and
   `.fill(0)` on lock, and accept that copies may exist. Document the
   limitation honestly.
- `keyfileHex` is the **raw hardware keyfile** — that is strictly worse than
  the master password. It must never be retained after use.
- `recoveryKey` likewise.

---

## V-30 · P1 · "Copy all" puts the 2FA setup key on the clipboard

**File:** `src/lib/vault.ts:135-148`

```ts
(item as any).totpSecret ? `2FA Setup Key: ${(item as any).totpSecret}` : "",
```

The quick-copy bundle includes the **TOTP secret** (the seed). Anyone who
pastes that text anywhere — a password manager, a chat, a support ticket —
now holds a permanent 2FA bypass for that account. The setup key is
*strictly more sensitive than the password*, because it never rotates.

**Required fix:** never include the TOTP secret in a copy bundle. Include the
*current code* only. If a user genuinely needs the setup key (e.g. to move to
another authenticator), make that a **separate, explicitly-confirmed action**
with its own warning.

---

## V-31 · P1 · Release pipeline: Android signing key is generated with a public password, per release

**File:** `.github/workflows/release.yml:160-176`

```yaml
keytool -genkey -v -keystore release.keystore ... -storepass vaultzero123 -keypass vaultzero123 ...
...
apksigner sign --ks release.keystore --ks-pass pass:vaultzero123 --key-pass pass:vaultzero123 ...
```

Problems:
1. The keystore password is **in the public repository**.
2. A **new key is generated on every release**, so every APK has a different
   signing identity. Android will refuse to update an existing install
   ("package not signed with the same key"). Users are forced to uninstall
   and reinstall — which loses app data — on every single release.
3. Anyone can produce an APK that Android will accept as "the official
   VaultZero" build.

**Required fix:**
- Use a **long-lived signing key** stored as a **GitHub Actions secret**
  (base64-encoded `.keystore`), generated once out-of-band.
- Read the password from a secret, never a literal.
- Fail the job loudly if the secret is missing — do **not** silently fall
  back to generating a throwaway key.
- Document the key-rotation procedure (play-services / upload key rotation).

---

## V-32 · P1 · The auto-updater downloads and opens binaries with no integrity check

**File:** `src/lib/updater.ts:96-140`, `src/components/UpdateModal.tsx:114`

```ts
window.open(downloadUrl, "_blank", "noopener,noreferrer");
```

The updater reads the latest GitHub release, finds an asset by **filename
substring** (`.exe` + "Setup"), and hands the URL to the browser. There is:
- no checksum verification,
- no signature verification,
- no check that `downloadUrl` is actually on `github.com` (it comes from the
  API response, so a compromised API response redirects the user anywhere),
- and the README advertises checksums that nothing verifies.

**Required fix:**
- Verify the downloaded artifact against a **signed manifest** (minisign /
  ed25519). Fail closed on mismatch.
- Pin the expected host: reject any `browser_download_url` that is not
  `https://github.com/tonmoycoder/VaultZero/releases/download/...`.
- Prefer Tauri's built-in updater with a configured `pubkey`.

---

## V-33 · P2 · The vault path is a hardcoded **relative** path

**File:** `src/lib/storage.ts:407,560`

```ts
await invokeNativeCommand("create_vault", { path: "local-vault.pmv", ... });
```

A relative path resolves against the **current working directory**, which
varies by launch method (Explorer, Task Scheduler, shortcut, service). The
vault can end up in an unexpected, possibly world-readable location — and a
second launch from a different CWD will not find the vault at all.

**Required fix:** resolve to an absolute path in an OS-appropriate app-data
directory (`%APPDATA%` / `~/.local/share` / Android app-private dir), created
with restrictive permissions. Expose a Tauri command that returns the
canonical path so the frontend never constructs one.

---

## V-34 · P2 · `KdfParams::calibrate_hardware()` is dead code

**File:** `crates/vault-core/src/crypto.rs:43`

Never called anywhere. The 64 MiB default always applies, so a low-RAM
device (an old Android phone — the project's stated target) may fail to
unlock, and the "we calibrate to your hardware" behaviour is absent.

**Required fix:** either call it (and persist the chosen parameters in the
vault header so they are stable across devices), or delete it and stop
implying the behaviour exists.

---

## V-35 · P2 · Two different KDFs protect the same vault format

| Path | KDF |
|---|---|
| Rust native (`.pmv`) | Argon2id — 64 MiB, t=3, p=4 |
| Web fallback (`localStorage`) | PBKDF2-SHA256 — 600,000 iterations |

PBKDF2-SHA256 at 600k iterations is **substantially weaker** than Argon2id at
64 MiB against GPU/ASIC attack. A user who creates a vault in the browser and
opens it on the desktop gets a weaker vault than one created natively, with
no warning.

**Required fix:** use **Argon2id in both paths**. WebCrypto does not provide
Argon2, so either (a) implement Argon2id in the frontend (WASM), or
(b) drop the browser fallback entirely and make the native core the only
implementation. Option (b) is the honest one for a "zero-knowledge" product.

---

## V-36 · P2 · Every single edit re-encrypts the whole vault and rotates 5 backups

**Files:** `src/lib/storage.ts:703+` (`persistVaultChanges`),
`src-tauri/src/lib.rs:354` (`upsert_entry` → `StorageEngine::save_vault`),
`crates/vault-core/src/storage.rs:530-531`

```rust
Self::rotate_backups(path)?;   // 4 renames + 1 full file copy
Self::atomic_write(path, &final_data)?;  // full re-encrypt + full rewrite
```

Each edit → full vault re-serialize → full re-encrypt → full file rewrite →
**plus a full copy of the file** for the backup. For a 10 MB vault, that is
~60 MB of I/O per keystroke-triggered save.

**Required fix (make it fast):**
- **Debounce** saves (e.g. 500 ms coalescing window) in the frontend.
- **Batch** the backup rotation — rotate at most once per N minutes, not on
  every save.
- Consider an **append-only log** of changes with periodic compaction, or a
  **per-entry** encrypted file layout, instead of rewriting everything.
- Measure before and after; the goal is a single edit costing O(1), not
  O(vault size).

---

## V-37 · P2 · The entry list is not virtualised

**File:** `src/components/VaultHome.tsx:1089` (`sortedItems.map(...)`)

Every entry renders a full `ItemCard` DOM subtree. A 10,000-entry vault
creates 10,000 cards — the "120fps" claim does not survive.

**Required fix:** virtualise the list (render only the visible window ±
overscan). `react-window` / `@tanstack/react-virtual` are the usual choices;
a hand-rolled windowing implementation is fine too if you want zero
dependencies. Keep the existing `memo(ItemCard)` — it is already correct
(verified: only mutated items get a new object reference).

---

## V-38 · P2 · `clearClipboardWipe` name/ behaviour mismatch (fixed in PR #1 — verify)

PR #1 fixed `clearClipboardWipe()` to actually wipe the clipboard. Confirm it
is still correct, and confirm the `copySecure` timer path does not wipe a
value the user copied *after* the secret (data-loss bug). Both were fixed in
PR #1 — re-verify after any refactor.

---

## V-39 · P3 · Accessibility gaps remain in the modals

`CsvImportModal`, `ItemSecurity`, `UpdateModal`, `UserProfileModal`,
`VaultRecoveryModal` and `AmbientScene` still have **zero** `aria-label`
attributes. PR #1 fixed `Tooltip` to inject `aria-describedby` into its
child, which helps — but a `<button>` with only an icon inside still needs
an accessible *name*.

**Required fix:** give every icon-only control an `aria-label`. Verify with
an automated axe pass.

---

## V-40 · P3 · Playwright suite was never executed in CI (fixed in PR #1 — verify)

PR #1 added a CI job that runs `npx playwright test`. Confirm it is green.
Note that the round-1 tests reference `/src/lib/storage.ts` — that import path
only resolves under the Vite dev server; make sure the CI job uses the same
`webServer` config.

---

# ROUND 1 — ALREADY FIXED IN PR #1 (verify, do not redo)

| ID | Severity | Finding | Fix in PR #1 |
|---|---|---|---|
| V-01 | **Critical** | P2P LAN sync sent the vault in **cleartext**; the crypto module was dead code | Real authenticated handshake; payload sealed with XChaCha20-Poly1305 before the socket |
| V-02 | **Critical** | The "SPAKE2" PAKE was plain X25519+HKDF — **fully MitM-able** | Transcript-bound PAKE + channel-binding hash; 11 crypto properties verified |
| V-03 | **Critical** | Plaintext vault items written to `sessionStorage` | Only non-sensitive flags persisted; reload requires re-unlock |
| V-04 | High | Duress decoy vault was **empty** (an instant tell) | Decoys populated with plausible filler entries, both paths |
| V-05 | High | Native unlock **silently fell back** to the browser vault | Native runtime is fail-closed; errors propagate |
| V-06 | High | **No auto-lock at all** | Idle/blur/visibility auto-lock + clipboard scrub |
| V-07 | High | No audit trail for secret reveals | In-memory `SecurityAuditLog` in the Rust core |
| V-08 | Medium | Password generator **modulo bias** | Rejection sampling over u32 |
| V-09 | Medium | `calculate_entropy()` overstated strength wildly | Conservative estimate w/ repetition, sequence, dictionary penalties |
| V-10 | Medium | HLC `ms << 24` **overflowed u64** | Repacked 48/8/8 |
| V-11 | Medium | `atomic_write` didn't fsync the parent dir | Directory fsync added |
| V-12 | Medium | Backup copy non-atomic; backups never shredded | Atomic copy + shred oldest |
| V-13 | Low | Unbounded file read before the size check | Size checked before allocating |
| V-14 | Low | `opt-level = "z"` + `panic = "abort"` | `opt-level = 3`, `panic = "unwind"` |
| V-15 | Low | CSP allowed `localhost:*` in `connect-src` | Tightened (⚠️ see V-18 — this broke the breach scanner) |
| V-16 | Low | Icon-only buttons inaccessible | `Tooltip` injects `aria-describedby` (⚠️ see V-39) |
| V-17 | Medium | P2P UI was a **pure mock** | Wired to real IPC; honest status reporting |

---

# CROSS-CUTTING THEMES

These are the *patterns* behind the findings. Fixing the pattern prevents the
next instance, not just this one.

### 1. The documentation describes an architecture the code does not implement

`SECURITY.md` claims: no outbound HTTP, keys never enter the WebView,
memory is zeroized, SPAKE2, fail-closed. Each of those was **false** at the
time of writing (V-01, V-18, V-29, V-28, V-02, V-05).

**Action:** after every security change, re-read `SECURITY.md` and
`README.md` and make sure each claim is backed by a line of code or a test.
Treat the docs as a **specification with testable assertions**.

### 2. Two implementations of the same thing, drifting

| Concern | Rust | TypeScript |
|---|---|---|
| Password generator | `crates/vault-core/src/generator.rs` | `src/lib/generate.ts` |
| Passphrase wordlist | 77 words | 78 words (different!) |
| Entropy estimate | `calculate_entropy` | `calculatePasswordAnatomy` |
| KDF | Argon2id | PBKDF2-SHA256 |
| Breach check | — | `breachScanner.ts` |
| TOTP | `crates/vault-core/src/totp.rs` | `src/lib/totp.ts` |
| Base32 decode | `decode_base32` | `decodeBase32` |
| CSV export | `export.rs` | `csv.ts` |

Six duplicated crypto surfaces. Every one is a place where the two can
disagree about what "secure" means.

**Action:** pick a **single source of truth** per concern. The Rust core
should own everything security-critical. The TS layer should be a thin
renderer. If the browser build genuinely needs its own crypto, the two must
be generated from one definition (or covered by a **shared test vector**
suite that runs against both).

### 3. Features that report success without doing the work

V-17 (P2P "sent!"), V-25 (payload: `""`), V-18 (CSP silently blocks the
fetch and the UI says "offline mode" as if it were a designed state).

**Action:** every user-visible success message must be backed by an
**observable fact**. "Sent" requires a confirmed send. "Encrypted" requires
the ciphertext. If the operation was skipped, say it was skipped.

### 4. "Offline / air-gapped" is a claim about *every* subsystem

The breach scanner was the only outbound path — but it was added casually and
nobody re-checked the global invariant.

**Action:** add a **CI test** that fails if any outbound URL appears in the
frontend or if `connect-src` grows a wildcard. Make the invariant
*mechanically enforced*, not a documentation promise.

---

# ACCEPTANCE CRITERIA

A change is done when:

1. **Every P0 and P1 finding** above is fixed, or explicitly deferred in a
   comment on the PR with a reason.
2. `npm run build` and `npx tsc --noEmit` are clean.
3. `cargo clippy --workspace --all-targets -- -D warnings` is clean.
4. `cargo test -p vault-core` passes (Windows runner — the Rust toolchain is
   not available in every environment).
5. `npx playwright test` passes, and **new tests are added** for each fix:
   - a test that fails **before** the fix and passes after.
   - a Rust unit test for every Rust change.
   - a Playwright test for every frontend change.
6. `SECURITY.md` and `README.md` are updated so every claim matches the code.
7. Performance-sensitive changes (V-36, V-37) include a **before/after
   measurement** in the PR description.

---

# PROMPT FOR ANTIGRAVITY

> Copy everything below this line into Antigravity.

---

You are working on the VaultZero repository (`tonmoycoder/VaultZero`), a
Tauri 2 + Rust + React 19 offline password manager.

## Step 1 — Read the reference PR (do NOT copy it)

Open **PR #1**: https://github.com/tonmoycoder/VaultZero/pull/1

and read the files it touches:
- `crates/vault-core/src/p2p.rs`, `crates/vault-core/src/storage.rs`,
  `crates/vault-core/src/crdt.rs`, `crates/vault-core/src/generator.rs`
- `src-tauri/src/p2p_lan.rs`, `src-tauri/src/lib.rs`
- `src/lib/storage.ts`, `src/lib/autoLock.ts`, `src/App.tsx`
- `docs/AUDIT-2026-11.md`

**Treat PR #1 as a reference implementation, not as the target.** It fixes
round-1 findings V-01 … V-17. Understand *what problem* each change solves
and *why*, then write your own implementation. Where PR #1 has a shortcut,
a bug, or an over-simplification, improve on it. The goal is the best
codebase, not the smallest diff.

Two specific things to carry forward from PR #1:
- The P2P key-exchange design (transcript-bound PAKE + channel binding) is
  **correct** — but verify it against the PoC in `docs/AUDIT-2026-11.md`
  before you build on it.
- PR #1's CSP change (`connect-src 'self'`) **broke** the breach scanner.
  Round-2 finding **V-18** covers how to resolve that properly.

## Step 2 — Read the master brief

Read `docs/AUDIT-2026-11.md` (round 1) and the round-2 brief. The round-2
brief lists **23 new findings** (`V-18` … `V-40`) across security,
correctness, performance, and release engineering.

## Step 3 — Work the queue in priority order

```
P0  V-19  k-anonymity leaks a per-password fingerprint
P0  V-20  security audit log writes vault metadata to localStorage in clear
P0  V-23  passphrase wordlist is 78 words (51% weaker than EFF Diceware)
P1  V-18  breachScanner contradicts the "Air-Gapped by Design" guarantee
P1  V-21  security center deep audit = O(n) sequential network calls
P1  V-22  item inspector re-fires breach requests, no shared cache
P1  V-25  start_p2p_host takes an arbitrary payload from the renderer
P1  V-26  Rust error strings leak internal detail to the UI
P1  V-27  brand matching via substring contains() (phishing look-alikes)
P1  V-28  password history / TOTP secret / recovery codes never zeroized
P1  V-29  master password + keyfile retained as immutable JS strings
P1  V-30  "copy all" puts the 2FA setup key on the clipboard
P1  V-31  Android signing key generated with a public password, every release
P1  V-32  auto-updater opens binaries with no integrity verification
P2  V-24  passphrase entropy reported incorrectly
P2  V-33  vault path is a hardcoded relative path
P2  V-34  calibrate_hardware() is dead code
P2  V-35  two different KDFs protect the same vault format
P2  V-36  every edit re-encrypts the whole vault + rotates 5 backups
P2  V-37  entry list is not virtualised
P3  V-38  verify the clipboard fixes from PR #1 survived
P3  V-39  remaining aria-label gaps in the modals
P3  V-40  verify the CI now actually runs Playwright
```

## Step 4 — For each finding

1. **Reproduce it first.** Write a failing test that demonstrates the
   problem. If you cannot make it fail, you have not understood it yet.
2. **Implement the fix yourself.** Do not copy the reference PR's approach
   unless it is clearly the best one.
3. **Add the regression test** to the suite.
4. **Update the docs** if the finding invalidates a claim.

## Step 5 — Quality bar

- **Be a QA tester.** Every fix needs a test that fails before it and passes
  after. Include the *edge cases*: empty input, unicode, maximum length,
  concurrent calls, offline mode, error paths.
- **Be a top-level engineer.** Match the existing architecture. Do not
  introduce a framework for one function. Prefer deleting code over adding
  it. Leave every file better than you found it.
- **Be fast.** The product is marketed as "blazing fast, 120fps". For
  V-36 and V-37, measure before and after and put the numbers in the PR
  description. A password manager that takes 400 ms to save one field is a
  broken password manager.
- **Do not break what works.** Run the full suite after every change:
  `npm run build && npx tsc --noEmit && cargo clippy --workspace --all-targets -- -D warnings && cargo test -p vault-core && npx playwright test`

## Step 6 — Deliver

- One commit per logical finding, with a message that states the problem,
  the fix, and the test.
- Push to the current branch and open a PR against `main`.
- In the PR description: a table of findings fixed, the before/after
  measurements for the performance work, and an explicit list of anything
  you deliberately deferred and why.

## Step 7 — Then keep hunting

The brief documents what we found. It does not document everything. After
the queue is clear:

- Re-read every file the brief mentions and look for the **same class** of
  bug in a place we did not check.
- Look for the gaps between the Rust core and the TypeScript layer — that
  seam has produced the most findings.
- Look for anything that **claims** a security property and does not
  deliver it. Grep the README and `SECURITY.md` for words like "zero",
  "air-gapped", "unhackable", "military-grade", "never", "always", and verify
  each one against the code.
- Look for performance cliffs: O(n) work inside a render, a loop, or a
  keystroke handler.
- Then write a short addendum to `docs/AUDIT-2026-11.md` with whatever you
  find, so the next person does not have to rediscover it.

**Commit your work to the current branch. Do not create a new branch.**

---

*Prepared by Arena.ai Agent Mode — round 2 deep audit.*
