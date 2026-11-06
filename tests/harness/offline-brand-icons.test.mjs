// V-87: a "100% OFFLINE" password manager must not ship brand tiles that
// fetch Google / DuckDuckGo favicons over the network. On an air-gapped
// device those requests fail (cert/DNS errors in the console) and on a
// connected device they leak every vault domain to a third party.
//
// The built-in offline SVG map, simple-icons vectors and the monogram
// fallback already cover every tile. Removing the remote stages keeps the
// exact same visual language with zero network calls.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

const stripComments = (code) =>
  code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join("\n");

const REMOTE_HOSTS = ["www.google.com/s2/favicons", "icons.duckduckgo.com"];

console.log("=== positive control: the detector is not a stub ===");
const synthetic = "const faviconUrl = `https://www.google.com/s2/favicons?domain=x&sz=128`;";
t("a planted Google favicon URL is detected", REMOTE_HOSTS.some((h) => synthetic.includes(h)));
const syntheticImg = '<img src="https://cdn.example.com/logo.png" alt="x" />';
t("a planted remote <img> is detected", /<img[^>]*src=["']https?:\/\//.test(syntheticImg));

console.log("=== shipped UI contains no remote brand icon fetch ===");
const walk = (dir) =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    return entry.isDirectory() ? walk(rel) : [rel];
  });
const sources = walk("src").filter((f) => /\.tsx?$/.test(f));
t("the scan actually saw source files", sources.length > 20, `${sources.length} files`);

const offenders = [];
for (const file of sources) {
  const code = stripComments(read(file));
  for (const host of REMOTE_HOSTS) {
    if (code.includes(host)) offenders.push(`${file} -> ${host}`);
  }
  if (/<img[^>]*src=(?:\{)?["'`]https?:\/\//.test(code)) offenders.push(`${file} -> remote <img>`);
}
t(
  "no shipped source fetches a remote brand icon",
  offenders.length === 0,
  offenders.join("; ") || `${sources.length} files clean`,
);

const ui = stripComments(read("src/components/ui.tsx"));
t("BrandMark has no remote-fallback error state", !/\berrorStage\b/.test(ui));

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
