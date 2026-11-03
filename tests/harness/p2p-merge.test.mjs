// V-52: "Receive & Merge" must actually merge a validated peer snapshot.
// V-51: the default vault ships exactly ONE demo password and nothing else.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUNDLE_DIR = join(ROOT, ".harness-build") + "/";
const bundle = (name) => pathToFileURL(join(BUNDLE_DIR, name)).href;
const m = await import(bundle("p2pMerge-built.mjs"));
const vault = await import(bundle("vault-built.mjs"));

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

console.log("=== parsePeerVaultPayload: Rust Vault shape ===");
const rustPayload = JSON.stringify({
  version: 1,
  metadata: { vault_id: "abc", created_at: 1, updated_at: 2, device_id: "dev", duress_enabled: false },
  folders: [],
  entries: [
    {
      id: "11111111-1111-1111-1111-111111111111",
      title: "GitHub", url: "github.com", username: "dev@example.com", email: "dev@example.com",
      password: "Tr0ub4dor&3xtra", notes: "work", folder_id: null, category: "Logins",
      tags: ["work"], favorite: true, brand_color: null, brand_icon_slug: "github",
      custom_icon_base64: null, totp_config: null,
      recovery_codes: [{ code: "RC-1", used: false, note: null }],
      last_autofill: null, created_at: 1700000000, updated_at: 1700000100,
      password_history: [{ password: "old-pass", changed_at: 1699999999 }],
      hlc_timestamp: 42, device_id: "dev", is_deleted: false,
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      title: "Deleted", url: "", username: "", email: "", password: "gone", notes: "",
      folder_id: null, category: "Safenotes", tags: [], favorite: false,
      brand_color: null, brand_icon_slug: null, custom_icon_base64: null, totp_config: null,
      recovery_codes: [], last_autofill: null, created_at: 1, updated_at: 1,
      password_history: [], hlc_timestamp: 1, device_id: "dev", is_deleted: true,
    },
  ],
});
const rustItems = m.parsePeerVaultPayload(rustPayload);
t("only non-deleted entries are imported", rustItems.length === 1);
t("rust category maps to login", rustItems[0].category === "login");
t("brand slug is preserved", rustItems[0].brand === "github");
t("password strength is estimated", rustItems[0].strength === "strong" && rustItems[0].score === 4);
t("recovery codes are carried over", rustItems[0].recoveryCodes?.[0] === "RC-1");
t("password history is carried over", rustItems[0].passwordHistory?.[0]?.password === "old-pass");
t("timestamp is rendered as a date", /^\d{4}-\d{2}-\d{2}$/.test(rustItems[0].modified));

console.log("=== browser-shaped payloads and validation ===");
const browserPayload = JSON.stringify([
  { id: "b1", title: "Dropbox", username: "me", password: "weak", url: "dropbox.com", category: "login", brand: "dropbox", favorite: false },
  { id: "b1", title: "Duplicate", username: "me", password: "weak", url: "", category: "login", brand: "vault", favorite: false },
  { id: "b2", title: "No password", username: "me", url: "", category: "login", brand: "vault", favorite: false },
]);
const browserItems = m.parsePeerVaultPayload(browserPayload);
t("duplicate ids collapse", browserItems.length === 1);
t("entries without a password are rejected", browserItems.every((item) => typeof item.password === "string"));
const throws = (raw) => { try { m.parsePeerVaultPayload(raw); return false; } catch { return true; } };
t("invalid JSON is rejected", throws("not json"));
t("empty payload is rejected", throws(""));
t("unexpected shape is rejected", throws(JSON.stringify({ hello: "world" })));
t("oversized payload is rejected", throws("x".repeat(8000001)));
const many = JSON.stringify(Array.from({ length: 5001 }, (_, i) => ({ id: `id-${i}`, title: "t", password: "p" })));
t("too many entries are rejected", throws(many));
t("object wrapper with items[] works", m.parsePeerVaultPayload(JSON.stringify({ items: [{ id: "i1", title: "T", password: "p" }] })).length === 1);
t("prototype keys are not spread", m.parsePeerVaultPayload(JSON.stringify([{ id: "p1", title: "T", password: "p", __proto__: { polluted: true }, extra: 1 }]))[0].polluted === undefined);

console.log("=== merge semantics ===");
const local = [
  { id: "a", title: "Local A", password: "local-a" },
  { id: "b", title: "Local B", password: "local-b" },
];
const remote = [
  { id: "b", title: "Remote B should NOT win", password: "remote-b" },
  { id: "c", title: "Remote C", password: "remote-c" },
  { id: "d", title: "Remote D", password: "remote-d" },
];
const merged = m.mergeVaultItems(local, remote);
t("new ids are appended", merged.length === 4 && merged[2].id === "c" && merged[3].id === "d");
t("local entry wins on conflict", merged[1].title === "Local B");
t("local array is not mutated", local.length === 2);
const unchanged = m.mergeVaultItems(local, [{ id: "a", title: "x", password: "x" }]);
t("no-op merge returns the same reference", unchanged === local);
const summary = m.mergeSummary(local, remote);
t("merge summary counts additions and duplicates", summary.added === 2 && summary.duplicates === 1);

console.log("=== manual peer input / QR parsing ===");
t("IP and port", m.parsePeerInput("10.0.0.5:52137").address === "10.0.0.5:52137");
t("IP + PIN", JSON.stringify(m.parsePeerInput("10.0.0.5:52137/123456")) === JSON.stringify({ address: "10.0.0.5:52137", pin: "123456" }));
t("PIN alone", JSON.stringify(m.parsePeerInput("654321")) === JSON.stringify({ address: null, pin: "654321" }));
t("QR JSON", JSON.stringify(m.parsePeerInput(JSON.stringify({ app: "vaultzero", ip: "10.0.0.7", port: 42222, code: "112233" }))) === JSON.stringify({ address: "10.0.0.7:42222", pin: "112233" }));
t("invalid octets rejected", m.parsePeerInput("999.1.1.1:1420").address === null);
t("invalid port rejected", m.parsePeerInput("10.0.0.5:99999").address === null);
t("garbage rejected", JSON.stringify(m.parsePeerInput("hello world")) === JSON.stringify({ address: null, pin: null }));

console.log("=== no demo/mock content except one demo password ===");
t("exactly one default item", vault.initialItems.length === 1);
t("it is the deletable demo account", vault.initialItems[0].id === "demo-account");
t("exactly one password in the default state", vault.initialItems[0].password === "V0-Secure$Demo2026" && (vault.initialItems[0].passwordHistory ?? []).length === 0);
const lockSource = readFileSync(join(ROOT, "src", "components", "LockScreen.tsx"), "utf8");
t("no hardcoded master password survives", !lockSource.includes("MasterPass2026"));
t("no biometric simulation survives", !/Biometric Simulation|Demo biometric/i.test(lockSource));
const syncSource = readFileSync(join(ROOT, "src", "components", "toolModals.tsx"), "utf8");
t("no hardcoded LAN IP survives", !syncSource.includes("192.168.1.103"));
t("receive really merges", /onMerge\(remote\)/.test(syncSource) || /parsePeerVaultPayload/.test(syncSource));

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
