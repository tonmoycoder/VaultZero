// V-71: the printable emergency kit is a user-facing document, so it must
// follow the app's language switch instead of being hardcoded to English.
// The app keeps an English mode (that is a feature, not a violation), so the
// invariant is: every visible string of the kit is routed through the
// language selector `S("bn", "en")` — no bare English literal may return.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

const MARKER = "Emergency kit —";
const source = read("src/components/toolModals.tsx");
const start = source.indexOf(MARKER);
const kit = start === -1 ? "" : source.slice(start);
const app = read("src/App.tsx");

// Every one of these used to be a bare user-facing English literal.
const labels = [
  "Emergency kit",
  "VaultZero Emergency Kit",
  "A physical lifeline for a digital vault. Fill it in by hand and keep it safe.",
  "Emergency access · confidential",
  "Offline recovery document",
  "Emergency access kit",
  "Master password",
  "Password hint",
  "Vault created",
  "Emergency contact name",
  "Phone / relationship",
  "Recovery key",
  "DOCUMENT ID",
  "VAULTZERO · LOCAL ONLY",
  "PAGE 1 / 1",
  "Print",
  "Save as PDF",
  "Preview · A4 portrait",
  "Fill by hand",
  "Private · offline · sealed",
  "Emergency access",
  "CONFIDENTIAL",
  "Recovery key · four groups",
  "Emergency contact · name and phone",
  "Generated just now · 1 page",
  "Close preview",
  "PDF saved locally. Nothing sent online.",
  "Emergency kit prepared — save as PDF",
  "Allow pop-ups to save your emergency kit",
];

// A string is translated when it appears as the second argument of S(...).
const isTranslated = (code, label) => code.includes(`, "${label}")`);

console.log("=== positive control: the invariant is not a stub ===");
t(
  "detects a bare untranslated literal",
  !isTranslated("<span>Master password</span>", "Master password")
);
t(
  "accepts a genuinely translated literal",
  isTranslated('<span>{S("মাস্টার পাসওয়ার্ড", "Master password")}</span>', "Master password")
);
// `onClose={() => ...}` contains a `>`, so the wiring check cannot use [^>]*.
const wired = (code) => /<EmergencyKitModal[\s\S]{0,300}?lang=\{lang\}/.test(code);
t(
  "detects a kit rendered without lang",
  !wired("<EmergencyKitModal key=\"emergency\" onClose={() => setModal(null)} />")
);

console.log("=== real emergency kit component ===");
t("kit section exists", kit.length > 1000, `${kit.length} chars`);
t("kit accepts the app language", /lang\?:\s*Language/.test(kit) && /lang\s*===\s*"bn"/.test(kit));
t("App passes lang to the kit", wired(app));
for (const label of labels) {
  t(`translated: ${label.slice(0, 46)}`, isTranslated(kit, label));
}

// The printable HTML itself must carry the language and a Bengali-capable font.
t("printed document declares lang", /<html lang="\$\{S\("bn", "en"\)\}">/.test(kit));
t(
  "printed document can render Bengali",
  /Hind Siliguri/.test(kit) && /Noto Sans Bengali/.test(kit)
);
t(
  "Bengali copy is actually present",
  (kit.match(/[\u0980-\u09FF]/g) || []).length > 300
);
t(
  "document id is really interpolated in JSX, not printed literally",
  !/>DOCUMENT ID[^<]*\$\{documentId\}/.test(kit) && /\{documentId\}/.test(kit)
);

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
