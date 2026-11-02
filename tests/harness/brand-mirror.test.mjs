// Mirror of the Rust brand matching logic (V-27) — verifies the behaviour
// without a Rust toolchain. The Rust source of truth is
// `crates/vault-core/src/brands.rs`.
const MULTI = [
  "co.uk", "org.uk", "ac.uk", "gov.uk", "co.jp", "co.kr", "com.au", "com.br",
  "com.cn", "co.in", "co.nz", "com.mx", "com.za", "com.tr", "com.sg", "com.hk",
  "com.tw", "com.ar", "github.io", "gitlab.io",
];

function extractHost(url) {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return null;
  const idx = trimmed.indexOf("://");
  const after = idx >= 0 ? trimmed.slice(idx + 3) : trimmed;
  const hostPart = after.split(/[/?#]/)[0] ?? after;
  const hostOnly = hostPart.split("@").pop() ?? hostPart;
  const noPort = hostOnly.split(":")[0] ?? hostOnly;
  if (!noPort) return null;
  return noPort.replace(/\.+$/, "").toLowerCase();
}

function registrable(host) {
  const labels = host.split(".").filter(Boolean);
  if (labels.length <= 2) return host;
  const lastTwo = labels.slice(-2).join(".");
  if (MULTI.includes(lastTwo) && labels.length >= 3) return labels.slice(-3).join(".");
  return lastTwo;
}

/**
 * The brand table, transcribed from `crates/vault-core/src/brands.rs`.
 *
 * Each brand owns a list of domain keywords. A keyword that contains a dot
 * is matched against the registrable domain exactly; a bare keyword is a
 * whole-word match against the title.
 */
const BRAND_KEYWORDS = {
  "github": [
    "github.com",
    "github"
  ],
  "google": [
    "google.com",
    "gmail.com",
    "google"
  ],
  "airbnb": [
    "airbnb.com",
    "airbnb"
  ],
  "discord": [
    "discord.com",
    "discord.gg",
    "discord"
  ],
  "microsoft": [
    "microsoft.com",
    "live.com",
    "outlook.com",
    "office.com",
    "azure.com"
  ],
  "apple": [
    "apple.com",
    "icloud.com",
    "apple"
  ],
  "amazon": [
    "amazon.com",
    "aws.amazon.com",
    "amazon"
  ],
  "netflix": [
    "netflix.com",
    "netflix"
  ],
  "linkedin": [
    "linkedin.com",
    "linkedin"
  ],
  "paypal": [
    "paypal.com",
    "paypal"
  ],
  "figma": [
    "figma.com",
    "figma"
  ],
  "twitter": [
    "x.com",
    "twitter.com"
  ],
  "reddit": [
    "reddit.com",
    "reddit"
  ]
};

/** "Visit google.com now" -> ["google.com"]; "google.com.hacker.io" -> ["google.com.hacker.io"]. */
function extractTitleHosts(title) {
  const hosts = [];
  for (const token of String(title ?? "").split(/[\s,;]+/)) {
    const cleaned = token
      .replace(/^[^a-zA-Z0-9.-]+/, "")
      .replace(/[^a-zA-Z0-9.-]+$/, "")
      .toLowerCase();
    if (!cleaned || !cleaned.includes(".")) continue;
    const labels = cleaned.split(".").filter(Boolean);
    if (labels.length < 2) continue;
    const tld = labels[labels.length - 1];
    if (tld.length < 2 || !/^[a-z]+$/.test(tld)) continue;
    if (!/[a-z]/.test(labels[0])) continue;
    hosts.push(cleaned);
  }
  return hosts;
}

/** Whole-word match, mirroring `contains_whole_word` in `brands.rs`. */
function containsWholeWord(text, keyword) {
  if (!keyword) return false;
  const haystack = String(text ?? "").toLowerCase();
  const needle = keyword.toLowerCase();
  let start = 0;
  while (start < haystack.length) {
    const at = haystack.indexOf(needle, start);
    if (at === -1) return false;
    const end = at + needle.length;
    const leftOk = at === 0 || !/[a-z0-9]/.test(haystack[at - 1]);
    const rightOk = end === haystack.length || !/[a-z0-9]/.test(haystack[end]);
    if (leftOk && rightOk) return true;
    start = at + 1;
  }
  return false;
}

/**
 * Mirrors `BrandRegistry::match_brand` from `crates/vault-core/src/brands.rs`.
 *
 * A URL host or a host-like title token must match a brand's domain
 * keyword **exactly** at the registrable-domain level. A bare brand name
 * matches the title only when the title is not itself a host — otherwise
 * "google.com.hacker.io" would be judged as a bag of words and match
 * "google", which is precisely the phishing case this logic prevents.
 */
function matchBrand(title, url) {
  const candidates = [];
  const host = extractHost(url);
  if (host) candidates.push(registrable(host));
  for (const token of extractTitleHosts(title)) candidates.push(registrable(token));

  const titleIsHostLike = extractTitleHosts(title).length > 0;
  const tClean = String(title ?? "").toLowerCase();

  for (const [brand, keywords] of Object.entries(BRAND_KEYWORDS)) {
    for (const raw of keywords) {
      const keyword = raw.toLowerCase();
      if (keyword.includes(".")) {
        // A domain keyword must match the registrable domain exactly.
        if (candidates.includes(keyword)) return brand;
      } else {
        // A bare keyword matches the title only when the title is not
        // itself a host-like token.
        if (titleIsHostLike) continue;
        if (containsWholeWord(tClean, keyword)) return brand;
      }
    }
  }
  return null;
}

let pass = 0;
let fail = 0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok
    ? pass++
    : (fail++, console.log(`FAIL ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`));
};

t("exact github.com", matchBrand("Some Login", "https://github.com"), "github");
t("subdomain github.com", matchBrand("x", "https://accounts.github.com/login"), "github");
t("look-alike is blocked", matchBrand("x", "https://fake-netflix-login.com"), null);
t("notgoogle.com is blocked", matchBrand("Some Login", "https://notgoogle.com"), null);
t("googleish title", matchBrand("Googleish", ""), null);
t("google in sentence", matchBrand("I use google daily", ""), "google");
t("title host real", matchBrand("google.com", ""), "google");
t("title host evil", matchBrand("google.com.hacker.io", ""), null);
t("title visit google.com", matchBrand("Visit google.com now", ""), "google");
t("host path", extractHost("https://a.b/c?d=1"), "a.b");
t("host creds port", extractHost("user:pw@host.example.com:8443/x"), "host.example.com");
t("host trailing dot", extractHost("example.com."), "example.com");
t("host empty", extractHost(""), null);
t("reg sub", registrable("accounts.google.com"), "google.com");
t("reg notgoogle", registrable("notgoogle.com"), "notgoogle.com");
t("reg co.uk", registrable("a.b.c.example.co.uk"), "example.co.uk");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
