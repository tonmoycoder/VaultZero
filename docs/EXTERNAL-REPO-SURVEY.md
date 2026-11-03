# বাহ্যিক রিপোজিটরি জরিপ — ২০২৬-১১-০৩

**উদ্দেশ্য:** ব্যবহারকারীর দেওয়া ২৩টি রিপোজিটরির প্রতিটির কোডবেস পর্যালোচনা করে VaultZero-র বাইরের ফিচার শনাক্ত করা; ফিচারটি সত্যিই কাজ করে ও অপটিমাইজড কি না যাচাই করা; VaultZero-তে বসানো সত্যিই সম্ভব কি না বিচার করা; তারপর অনুমোদন/প্রত্যাখ্যান। **কেবল যুক্তিসহ অনুমোদিত ও টেস্ট-যাচাইকৃত ফিচার যোগ করা; বাকি সব skip।**

**পদ্ধতি (ROPE):** *Role* — senior Rust/Tauri-2/React নিরীক্ষক; *Objective* — শূন্য রিগ্রেশনে ফিচার নির্বাচন; *Parameters* — নিচের অপরিবর্তনীয় সীমা; *Example* — প্রতি রিপোর file-tree, README, টেকনিক্যাল/SECURITY ডক ও প্রযোজ্য ক্ষেত্রে আসল সোর্স ফাইল পড়ে সিদ্ধান্ত। কোনো অনুমান, স্টাব বা "README-তেই আছে তাই কাজ করে" ধরনের দাবি নেই।

**VaultZero-র অপরিবর্তনীয় সীমা:** একক fail-closed `local-vault.pmv` · ১০০% অফলাইন standalone Tauri 2 (Windows + Android), ব্রাউজার ট্যাব নয় · Argon2id + XChaCha20-Poly1305 · কোনো সার্ভার/অ্যাকাউন্ট/ক্লাউড/টেলিমেট্রি/বাধ্যতামূলক এক্সটেনশন নেই · WebCrypto RFC 6238 TOTP · Windows/Android ছাড়া অন্য প্ল্যাটফর্মের ডেলিভারেবল নেই।

---

## সারণী

| # | Repo | Codebase (প্রকৃত) | Extra features | কাজ করে / অপটিমাইজড? | VaultZero-তে ফিট? | সিদ্ধান্ত |
|:--|:--|:--|:--|:--|:--|:--|
| 1 | `Mrlopez62/stash` | macOS Swift app + Rust `crates/` + `browser/`; ১০৩ commit, CI | Touch ID, browser autofill, SSH agent + git signing, MCP agent approval (encrypted audit log), Chrome/Safari/Firefox/LastPass/Bitwarden/`.1pux` import, concealed clipboard 30s | হ্যাঁ; তবে স্বয়ং "early development v0.18, no outside security review" | না — macOS-only + এক্সটেনশন + MCP এজেন্ট air-gap ভঙ্গ করে; import dedup আগেই আছে (`mergeVaultItems` id-union, local-wins) | **REJECT** |
| 2 | `Max-Zit/passzit` | ১ commit; শুধু README/LICENSE/CONTRIBUTING/brand | সবই `## Planned` (E2EE, shared vault, extension, time-limited share, health, TOTP, self-host, 14 ভাষা) | না — কোড নেই, release নেই | না | **REJECT (vaporware)** |
| 3 | `sapientorius/nodePass` | TS/FeathersJS 5 + Vue 3 + MariaDB/MySQL + Docker; v0.1.7, ১৬ open issue | sysPass migration, passkey sign-in, TOTP MFA policy, Argon2id upgrade, server-managed keyring, LDAP/SMTP, authenticated backups | হ্যাঁ, কিন্তু README-তেই স্পষ্ট: **"not end-to-end encrypted. The running server can decrypt secrets"** | না — zero-knowledge ভঙ্গ | **REJECT** |
| 4 | `Iamsujithd/VeyraKey` | TS monorepo, MV3 Chrome/Firefox, ৫৬ commit, ২৫৯ টেস্ট, release-manifest + SBOM + external gates | WebAuthn **PRF**, Google Drive BYOS sync, private email alias, exact-origin autofill, immutable revisions | হ্যাঁ, কিন্তু স্বয়ং "portfolio-grade RC, not independently audited" | না — ক্লাউড সিঙ্ক + এক্সটেনশন-ফার্স্ট | **REJECT** |
| 5 | `toshost/passvault` | Go binary + `web/` + `extension/` (MV3) + Postgres; `go test ./...`, ~২০০-line `web/crypto.js` | Send (scheduled reveal), emergency access (SMTP), email alias, rate limiting, audit log, offline recovery kit, X25519 sharing, PWA | হ্যাঁ (`internal/crypto`-এ unit test), কিন্তু সার্ভার-নির্ভর | না — সার্ভার/Postgres/SMTP চায় | **REJECT** |
| 6 | `clane-ai/clane-vault` | Fastify+Prisma API, React web, MV3 ext, `e2e/` Playwright; ৯৮ commit | ১৪ record type, ১০০MB encrypted attachment, one-time links, SSO, groups/policies, MCP agent gateway | হ্যাঁ, কিন্তু **"pre-audit, use for evaluation"** | না — কনটেইনার + Postgres + এজেন্ট গেটওয়ে | **REJECT** |
| 7 | `girishlade111/ls-pass` | Kotlin/Jetpack Compose/Room, ৩৫ commit, রিপোতেই APK | Android **AutofillService**, configurable clipboard auto-clear, offline health score ০–১০০ (weak/reused/missing-2FA/empty), Bitwarden CSV, ৬ item type | হ্যাঁ, ভালো অপটিমাইজড (Argon2id 64 MiB, per-field AES-GCM 12-byte IV) | আংশিক — AutofillService-এ native Kotlin চায় (Tauri WebView দেবে না); health audit-এর বড় অংশ `SecurityCenter.tsx`-এ আছে | **REJECT (এখন)** |
| 8 | `hmalvee/EnigmaKeep` | browser/PWA, `src/crypto/`, `src/workers/`; ৫ commit | 128-bit Secret Key two-secret KDF, WebAuthn PRF, BIP-39, Shamir **guardian recovery + time-lock puzzle**, decoy vault + random padding, **rollback detection**, strict CSP | হ্যাঁ (টেকনিক্যাল ডক + `/bench` benchmark) | rollback detection-এ Rust storage + টেস্ট লাগবে; লোকালে `cargo` নেই → যাচাই অসম্ভব | **REJECT (future candidate)** |
| 9 | `antoniopelusi/KeyHolder` | Java 11 + JavaFX + Maven | offline CSV DB, keyboard shortcuts, `.exe/.deb/.rpm/.appimage/.jar` | হ্যাঁ, কিন্তু **AES/ECB/PKCS5Padding + SHA-256** — ECB pattern লিক করে | না — আমাদের চেয়ে দুর্বল ক্রিপ্টো | **REJECT** |
| 10 | `CyberNilsen/CyberVault` | C#/.NET WPF, stable, MIT | Chrome extension autofill, **multiple vaults**, portable mode, JSON import/export, TOTP, encrypted backup | হ্যাঁ (AES-256-CBC + PBKDF2 1,000,000), কিন্তু unauthenticated CBC | multiple-vault একক fail-closed `.pmv` চুক্তি ভাঙে; autofill-এ এক্সটেনশন লাগে | **REJECT** |
| 11 | `Chiranth…/vaultx-offline…` | React Native/Expo, F-Droid, R8 full mode/ProGuard | ৬-digit PIN, screenshot protection, clipboard monitor, auto-categorisation, **deterministic master-derived password**, ১৫–২৫MB APK | হ্যাঁ (APK অপটিমাইজড), কিন্তু PBKDF2 < Argon2id; deterministic password একটি security anti-pattern | না — বেশিরভাগ ফিচার VaultZero-তে আছে | **REJECT** |
| 12 | `TheTallProgrammer/Password-Manager` | Windows-only, Inno Setup, unsigned exe | ৪ থিম, delete-all, "thought bank", JSON import/export | README-তেই **custom XOR-based encryption** + SHA-256; Defender warning স্বীকৃত | না — ক্রিপ্টোগ্রাফিকভাবে ভাঙা | **REJECT** |
| 13 | `deepakvamsi/kosh` | Go + Wails + React; `internal/seal/seal.go` **+ `seal_test.go`** পড়া হয়েছে | hash-chained HMAC audit log, build-time **no-network guard**, credential health, screen-capture exclusion, encrypted backups, xlsx/csv import | হ্যাঁ; `ForbiddenImports`/`ForbiddenPrefixes` আসল কোড + টেস্ট; আমাদের মতোই Argon2id + XChaCha20-Poly1305 envelope | Audit-log = নতুন subsystem (over-engineering); blanket no-network ban অসম্ভব (updater legitimately `fetch` ব্যবহার করে) — **তবে scoped guard-টি গ্রহণযোগ্য, নিচে দেখুন** | **REJECT ফিচার / APPROVE ধারণা (V-69)** |
| 14 | `DevsFromHiddenFlame/Qlerky` | **শুধু** `README.md`, `Policy.md`, `index.html`, `qlerky-technical.html`; ৩ commit, কোনো Kotlin/Gradle নেই | **next 2FA code preview**, ৪ export (`.qlerky`/QR/LSB steganography/CSV), biometric | Play-তে অ্যাপ আছে, কিন্তু রিপোতে TOTP-র কোড নেই — শুধু SEO HTML-এ বর্ণনা | ধারণা RFC-বৈধ (`currentT+1`) ও `generateTotp(secret, epoch)`-এ ফিট করে; কিন্তু যাচাইযোগ্য সোর্স নেই | **SKIP** |
| 15 | `ngankt2/kiwi-password-manager` | TS core + **Tauri v2** + Expo; signed/notarized macOS, ৫ ভাষা | KeePass `.kdbx` import, ৮MB attachment, per-entry version history, **Minisign-verified updates**, clipboard auto-clear | হ্যাঁ, কিন্তু স্বয়ং "not independently audited" | version history আছে (V-51); KDBX/Minisign নতুন ইনফ্রা | **REJECT** |
| 16 | `sapthesh/offline-vault` | একটিমাত্র `index.html` | JSON merge-or-replace import, ১২+ থিম, live preview, category/filter/sort | **দাবির সাথে অসঙ্গতি:** "100% offline" অথচ favicon fetch করে; PBKDF2 ১০০k; localStorage-এ ভল্ট (browser data clear = ভল্ট মুছে যায়) | না | **REJECT** |
| 17 | `calinux-py/ShieldPass` | **শুধু `readme.md`** (১৭ commit, কোনো সোর্স নেই) | scrypt, ChaCha20, AES-GCM ZIP, TOTP MFA, USB physical key, "Discord backup" | না — কোড নেই; Discord-এ ব্যাকআপ একটি red flag | না | **REJECT** |
| 18 | `dawei2077/Secure-Password-Manager-vapor-vault` | single-file HTML (React 19/Vite), Win95 UI | master password change (re-encrypt), encrypted JSON backup | README-তেই **"educational … should not be used to secure sensitive production data"**; PBKDF2 ১০০k; localStorage | না | **REJECT** |
| 19 | `aviondb/aviondb-p2p-sync` | ৬ বছর পুরনো Todo ডেমো, ১১ commit, WTFPL, `"TODO: Write an article"` | OrbitDB/IPFS QR P2P sync | না — ডেমো-গ্রেড, টেস্ট নেই | না — VaultZero-র X25519/PAKE LAN P2P + QR one-time transfer শক্তিশালীতর | **REJECT** |
| 20 | `Fundaments-Work/Theorem` | **Tauri 2 + React + TS + Rust** reading app; ১,৬০৬ commit, ৩০ tag | EPUB/PDF/MOBI/CBZ/RSS, highlight/TTS, P2P sync, Markdown export, `AGENTS.md`/`context.md`/`design.md` | হ্যাঁ, খুব পরিপক্ব — তবে পাসওয়ার্ড ম্যানেজার নয় | শুধু **একটি কনভেনশন** গৃহীত: persistent resumable context file = `checkpoint.md` + `checklistprogress.md` | **REJECT ফিচার / ADOPT কনভেনশন** |
| 21 | `mHamzaIqbal1998/VaultPeer-Desktop` | **Tauri 2 + React + Rust `keepass` crate**, MSI/NSIS, Vitest + `cargo test` | KDBX, WebRTC live sync (Phonebook signaling server), auto-type hotkey, Windows Hello DPAPI, browser localhost API | হ্যাঁ, সবচেয়ে কাছের স্ট্যাক | signaling server = air-gap ভঙ্গ; KDBX = `.pmv` ফরম্যাট ভঙ্গ; Windows Hello Windows-only | **REJECT** |
| 22 | `karefined-eng/the-mainframe` | **Tauri 2 + React + Rust + SQLite + Android**, আমাদের মতোই NSIS/MSI + signed universal APK, `desktop.yml`/`android.yml` | PIN-paired LAN/USB (`adb reverse`) bidirectional merge, RFC1918-only, **pre-merge timestamped backup** | হ্যাঁ, প্রকৌশলগতভাবে সবচেয়ে মিল | আমাদের native LAN P2P + QR আছে; pre-merge snapshot-এ Rust storage + টেস্ট লাগবে (`cargo` লোকালে নেই) | **REJECT (এখন), future candidate** |
| 23 | `lively-community/lively` | WinUI 3 / C# wallpaper engine; ১,০৯৯ commit, ৬৪ tag | animated wallpaper/screensaver, mpv, LivelyProperties | হ্যাঁ — কিন্তু ভল্ট/ক্রিপ্টো/সিক্রেট বলে কিছুই নেই | না, ডোমেইন-বহির্ভূত; শুধু অ্যানিমেশন-মানের রেফারেন্স | **REJECT** |

---

## সিদ্ধান্তের শ্রেণিবিন্যাস

| শ্রেণি | রিপো | কারণ |
|:--|:--|:--|
| (ক) সার্ভার/ক্লাউড/এক্সটেনশন/OS-native নির্ভরতা | 1, 3, 4, 5, 6, 10, 15, 21 | standalone air-gapped invariant ভঙ্গ করে |
| (খ) দুর্বল/ভাঙা ক্রিপ্টো | 9 (ECB), 11 (PBKDF2 + deterministic), 12 (XOR), 16, 18 | Argon2id + XChaCha20-Poly1305-এর চেয়ে নিচু |
| (গ) কোড নেই / স্ব-ঘোষিত ডেমো | 2, 14, 17, 19 | যাচাইযোগ্য নয় |
| (ঘ) VaultZero-তে আগেই আছে | 1, 7, 11, 15, 19 | ডুপ্লিকেট কাজ = over-engineering |
| (ঙ) এখন ইম্পিরিক্যালি যাচাই অসম্ভব | 8, 13 (audit-log), 22 | Rust storage/`cargo`/টেস্ট চায় |

**মোট: ২৩/২৩ পর্যালোচিত · ০ বাহ্যিক ফিচার যোগ করা হয়েছে · ১টি ধারণা অনুমোদিত ও বাস্তবায়িত (V-69) · ১টি কনভেনশন গৃহীত (resumable context files)।**

---

## V-69 — একমাত্র অনুমোদিত ধারণা (বাস্তবায়িত)

`deepakvamsi/kosh`-এর `internal/seal/seal.go` + `seal_test.go` হলো একটি build-time invariant: first-party প্যাকেজে `net/http`, `net/rpc`, `net/smtp`, gRPC বা websocket import ঢোকামাত্র CI ভেঙে যায়। VaultZero-র ক্ষেত্রে একই ধারণা **`crates/vault-core`-এ scoped** করে বসানো যায়:

**সোর্স-স্তরের যাচাই (সম্পন্ন, read-only, `ab2a8ca`):**

- `crates/vault-core/Cargo.toml`-এ `argon2`, `chacha20poly1305`, `sha2`, `hmac`, `hkdf`, `x25519-dalek`, `url`, `regex`, `rmp-serde` … — **কোনো `reqwest`/`hyper`/`tokio`/socket ডিপেন্ডেন্সি নেই**।
- `crates/vault-core/src/p2p.rs` পড়া হয়েছে: সম্পূর্ণ pure X25519 / HKDF / HMAC / MessagePack ক্রিপ্টো; কোনো socket বা `std::net` নেই। নেটওয়ার্ক শুধু `src-tauri/src/p2p_lan.rs`-এ (explicit opt-in native ফিচার) — তাই গার্ড **শুধু `crates/vault-core`**-এ সীমাবদ্ধ রাখতে হবে, পুরো workspace-এ নয়।
- `scripts/run-harness.mjs` `tests/harness/*.test.mjs` **অটো-ডিসকভার** করে → নতুন হার্নেসের জন্য কোনো রেজিস্ট্রেশন-পরিবর্তন লাগবে না, অর্থাৎ শূন্য রিগ্রেশন ঝুঁকি।
- `tests/harness/release-contract.test.mjs`-এর স্টাইল (`t(name, ok, extra)` + `process.exit`) অনুসরণীয়।

**বাস্তবায়ন (সম্পন্ন, টেস্ট-সহ):** `tests/harness/air-seal.test.mjs` লেখা হয়েছে — (১) নিষিদ্ধ crate-এর তালিকা (`reqwest`, `hyper`, `tokio`, `tonic`, `tungstenite`, `socket2`, `quinn` …), (২) **৭টি positive control** — সিন্থেটিক `reqwest = "0.12"`, `tokio`, `use std::net::TcpStream;`, `TcpListener` ধরা পড়ে; comment-এ লেখা `reqwest::get` ও benign ক্রিপ্টো import-এ false positive হয় না, (৩) comment-stripping-এর পর আসল `crates/vault-core/Cargo.toml` ও **১৯টি `*.rs`** স্ক্যান। Node 22 ও `node@20` দুটোতেই সব PASS; `scripts/run-harness.mjs` অটো-ডিসকভার করায় কোনো রেজিস্ট্রেশন-পরিবর্তন লাগেনি। V-71 (`tests/harness/bengali-kit.test.mjs`) যোগ হওয়ায় `npm run verify`-এ মোট **২৭/২৭** হার্নেস ফাইল প্রত্যাশিত।

**Big-O / মেমরি:** গার্ডটি `npm run verify`-এ `O(F·S)` সময় (`F` = Rust ফাইল সংখ্যা, `S` = মোট সোর্স বাইট) ও `O(S)` transient মেমরি ব্যবহার করে; রানটাইম অ্যাপে কোনো কোড, কোনো allocation, কোনো নতুন dependency যোগ হয় না — অর্থাৎ production hot-path-এ সময় ও মেমরি দুটোই **অপরিবর্তিত**।

---

## স্বচ্ছতা

এই জরিপ GitHub-এর public পেইজ/API, README, টেকনিক্যাল ডক ও উল্লিখিত সোর্স ফাইলের **read-only** পর্যালোচনার উপর ভিত্তি করে তৈরি; কোনো বাহ্যিক রিপো ক্লোন করা, বিল্ড করা বা তার টেস্ট চালানো হয়নি। "কাজ করে" বলতে বোঝানো হয়েছে: রিপোতে সংশ্লিষ্ট ফিচারের প্রকৃত কোড/টেস্ট/রিলিজ আছে এবং দাবির সাথে অসঙ্গতি নেই — কোনো স্বাধীন security audit দাবি করা হচ্ছে না। `checkpoint.md` ও `checklistprogress.md`-এ বাকি কাজের হালনাগাদ অবস্থা আছে।
