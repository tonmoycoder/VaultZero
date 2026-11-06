# VaultZero — সাইনড Beta প্রকাশের রানবুক

> **এই ডকumentটি কেন আছে:** "ডাউনলোডে পুরনো ভার্সন আসছে" অভিযোগের মূল কারণ সোর্স কোডের বাগ নয়, **প্রকাশনা**। ২০২৬-১১-০৭ পর্যবেক্ষণে live latest release `v2.5.2`, প্রকাশিত `2026-11-02T01:18:40Z`, target `main`, ৯টি অ্যাসেট; অথচ সোর্সে V-85/V-86/V-87/V-88 পর্যন্ত কাজ হয়েছে। ফলে ব্যবহারকারী ৫ দিন পুরনো বিল্ড পাচ্ছেন। `scripts/check-live-release.mjs` এটাকেই `STALE` বলে ধরে এবং দেখায় যে ২টি canonical নাম অনুপস্থিত (`VaultZero-Windows-x64-Portable.exe`, `VaultZero-Windows-x64.msi`) → README-র ২টি লিংক 404।
>
> **এখানে (sandbox-এ) প্রকাশ সম্ভব নয়:** ৪টি Android signing secret নেই, `gh secret list` → HTTP 403 (`Resource not accessible by integration`), `keytool`/`java` নেই, Windows runner নেই। নিচের ধাপগুলো মানুষ বা Antigravity-কে locally চালাতে হবে। কোনো fake/debug অ্যাসেট তৈরি করা যাবে না।

---

## ১. পূর্বশর্ত — ৪টি GitHub Secret (একবারই)

Repo → **Settings → Secrets and variables → Actions → New repository secret**।

| Secret | মান |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | নিচে বানানো `vaultzero-release.jks`-এর base64 |
| `ANDROID_KEYSTORE_PASSWORD` | `-storepass` যেটি দিলেন |
| `ANDROID_KEY_ALIAS` | `vaultzero` |
| `ANDROID_KEY_PASSWORD` | `-keypass` যেটি দিলেন |

একটিমাত্র **long-lived** keystore বানান; প্রতি রিলিজে নতুন key বানালে Android in-place update ভেঙে যাবে (V-31)। Keystore অফলাইনে রাখুন, কখনো repo-তে কমিট করবেন না।

```bash
keytool -genkeypair -v -keystore vaultzero-release.jks -storetype PKCS12 \
  -alias vaultzero -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=VaultZero, OU=Security, O=VaultZero, L=Dhaka, ST=Dhaka, C=BD"
```

Windows-এ base64:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("vaultzero-release.jks")) | Set-Clipboard
```

Linux/macOS-এ: `base64 -w0 vaultzero-release.jks`

> **সতর্কতা (user সিদ্ধান্ত):** `.github/workflows/release.yml`-এ secret না থাকলে `vaultzero123` দিয়ে deterministic fallback keystore বানানোর কোড আছে এবং আপাতত **রাখা হয়েছে** (পুরনো সিদ্ধান্ত `keep_document`)। এটা নীরবে revert করবেন না; তবে production রিলিজের আগে fail-closed করা উচিত। Secret ঠিকমতো পৌঁছেছে কি না যাচাই করাই এই ধাপের উদ্দেশ্য।

---

## ২. ভার্সন নির্বাচন

- **প্রস্তাবিত:** `v2.5.2-beta.1` — একই core (`2.5.2`), তাই ইনস্টল করা অ্যাপে চিরস্থায়ী "Update Now" প্রম্পট আসবে না। `src/lib/version.ts`-এর SemVer comparator prerelease-aware (`beta.2 > beta.1`, stable > beta)।
- `v2.6.0-beta.1` বেছে নিলে **৫টি জায়গা** একসাথে বাড়াতে হবে: `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src/lib/version.ts`-এর `APP_VERSION`, এবং `tests/vault-v250.spec.ts:45`। নাহলে ইনস্টল করা Beta নিজেকেই `2.5.2` বলবে ও আপডেট প্রম্পট আটকে যাবে।
- `v2.5.0`-এ নামানো **নিষিদ্ধ** (downgrade)। canonical ৫টি নাম বদলানো **নিষিদ্ধ** (README + updater + `release-contract` harness ভেঙে যাবে)।

---

## ৩. প্রকাশের আগে গেট (locally)

```bash
npx tsc --noEmit
npm run verify
npx -y node@20 scripts/run-harness.mjs
npx playwright test
npm audit --audit-level=high
git status --short          # খালি হতে হবে
```

Windows/Rust গেট (`cargo clippy --all-targets -- -D warnings`, `cargo test`) শুধু CI-তেই চলে; এখানে `cargo`/`rustc` নেই।

`src-tauri/tauri.conf.json`-এ `connect-src 'self' https://api.github.com …` CSP আর `AndroidManifest.xml`-এ `android.permission.INTERNET` আগে থেকেই আছে — পুরনো APK-তে ছিল না, তাই পুরনো বিল্ডে "Cannot reach remote release server" দেখা যেত। নতুন বিল্ডে updater-এর ৮-সেকেন্ড timeout + সৎ `offline`/`error` classification আছে (V-86)।

---

## ৪. Release workflow চালানো

Workflow: `.github/workflows/release.yml`, trigger = `push` on `v*` tag অথবা `workflow_dispatch` (`inputs.tag_name`, default `v2.5.2`)।

```bash
# অপশন A — manual dispatch (branch থেকে, tag ছাড়াই)
gh workflow run "Release (Windows Installer & Android APK)" \
  --ref arena/317fbb3c-vaultzero -f tag_name=v2.5.2-beta.1

# অপশন B — tag push
git tag v2.5.2-beta.1
git push origin v2.5.2-beta.1
```

`publish-release` job: দুই job-এর artifact ডাউনলোড → ৪টি binary-র উপস্থিতি যাচাই → **একটিমাত্র** `SHA256SUMS.txt` → `gh release create … --target "$GITHUB_SHA" --latest` (Beta নাম, কিন্তু `--prerelease` নয়; নাহলে `/releases/latest/download/...` 404 হবে) → প্রতিটি অ্যাসেট `--clobber` দিয়ে আপলোড → শেষে ৫/৫ নাম যাচাই। কোনো `|| true` নেই: আপলোড ফেল হলে release ফেল হবে।

**Signed run log-এ বাধ্যতামূলক যাচাই:**

```
Restored the long-lived release signing keystore from GitHub Secrets.
```

যদি বরং দেখা যায় —

```
Using consistent release keystore.
```

— তাহলে **থামুন**, release প্রকাশ করবেন না: ৪টি secret পৌঁছায়নি, debug/`vaultzero123` fallback ব্যবহৃত হয়েছে। Signed log পেতে `gh api -i .../actions/jobs/<JOB_ID>/logs` → 302 `location:` URL (সম্পূর্ণ `sig=`/`se=`/`sr=` সহ) → সেই URL পড়ুন; `gh run view --log` এই সেশনে EOF দেয়। `secrets[format('{0}', '…')]` indirection-এর কারণে লগ ছাড়া secret-এর উপস্থিতি অনুমান করা যায় না।

---

## ৫. প্রকাশের পরে যাচাই

```bash
gh run list --workflow "Release (Windows Installer & Android APK)" --limit 1
gh run watch <RUN_ID> --exit-status

gh release view v2.5.2-beta.1 --json tagName,publishedAt,targetCommitish,assets \
  --jq '{tag:.tagName,published:.publishedAt,target:.targetCommitish,assets:[.assets[].name]}'

node scripts/check-live-release.mjs     # exit 0 হতে হবে: STALE নেই, ৫/৫ লিংক ঠিক
```

`check-live-release.mjs` ছাড়াও হাতে যাচাই:

```bash
curl -L -O https://github.com/tonmoycoder/VaultZero/releases/latest/download/SHA256SUMS.txt
sha256sum -c SHA256SUMS.txt
```

Canonical ৫টি (ঠিক এই নামে, case-sensitive):

| অ্যাসেট | উৎস |
|---|---|
| `VaultZero-Windows-x64-Setup.exe` | NSIS |
| `VaultZero-Windows-x64-Portable.exe` | standalone `.exe` (বড় হাতের **P**) |
| `VaultZero-Windows-x64.msi` | WiX/MSI |
| `VaultZero-Android.apk` | signed arm64 APK |
| `SHA256SUMS.txt` | একটিমাত্র সম্মিলিত manifest |

live `v2.5.2`-এ ছিল ছোট হাতের `VaultZero-Windows-x64-portable.exe` — সেটা canonical নয়, তাই README লিংক 404। নাম বদলাবেন না; সঠিক নামে নতুন অ্যাসেট প্রকাশ করুন।

`Launch-VaultZero.bat` শুধু তখনই ব্রাউজার খোলে যখন portable `.exe` HTTP 200 দেয়; নাহলে `exit /b 1` (`tests/harness/desktop-launcher.test.mjs`)।

---

## 6. Rollback

কোনো ভুল release প্রকাশ হয়ে গেলে নতুন করে সোর্স প্যাচ করবেন না; প্রকাশনা ফিরিয়ে আনুন:

```bash
# 1. আগের ভালো release-কে আবার latest করুন
gh release edit v2.5.2 --latest

# 2. ভুল Beta সরান (অ্যাসেট সহ) — নিশ্চিত হয়ে
gh release view v2.5.2-beta.1 --json assets --jq '.assets[].name'
gh release delete v2.5.2-beta.1 --yes

# 3. secret / tag ঠিক করে ৪ নং ধাপ আবার চালান
node scripts/check-live-release.mjs
```

`--clobber` থাকায় একই tag পুনরায় চালালে অ্যাসেট overwrite হয়; তারপরও ৫/৫ যাচাই ও `sha256sum -c` ছাড়া "সফল" বলবেন না। কখনোই হাতে বানানো / unsigned binary আপলোড করবেন না।

---

## ৭. সৎ সীমাবদ্ধতা (এই ডক দিয়ে যা মেটে না)

- Android physical device-এ **camera permission**, LAN P2P, 120Hz jitter — WebView `PermissionRequest` bridging / native biometric এখনো নেই; QR-photo fallback ও honest "not enrolled" বার্তা আছে, কিন্তু real Touch ID / WebAuthn platform authenticator নেই।
- Windows `.exe` cold start-এর absolute `<2s` মাপা হয়নি (শুধু 284 ms WebView proxy)।
- native `.pmv` Rust IPC backup নেই (localStorage snapshot only)।
- `docs/ANTIGRAVITY-BRIEF.md` একটি **historical** round-2 audit brief (পুরনো ব্রাঞ্চ `arena/79f3d1ba-vaultzero`, PR #1); release-এর জন্য এটা অনুসরণ করবেন না।
- এই ডকের বাইরের local-only কাজগুলোর জন্য আলাদা Antigravity prompt ব্যবহার করুন।

*সর্বশেষ যাচাই: ২০২৬-১১-০৭, branch `arena/317fbb3c-vaultzero`।*
