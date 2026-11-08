// V-74: OCR must work fully offline on Android. tesseract.js defaults its
// worker script and WASM core to cdn.jsdelivr.net, so an air-gapped device
// stalls at "loading tesseract core" with no error. This guard makes the
// offline contract explicit and proves the detector is not a stub.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, win32 } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const has = (rel) => existsSync(join(ROOT, rel));

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

const ocr = read("src/lib/ocr.ts");
const pkg = JSON.parse(read("package.json"));

console.log("=== positive control: detector really detects CDN defaults ===");
t(
  "flags a synthetic CDN worker path",
  /cdn\.jsdelivr\.net/.test('workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@v5/dist/worker.min.js"')
);
t("accepts a local worker path", !/cdn\.jsdelivr\.net/.test('workerPath: "/tesseract/worker.min.js"'));

console.log("=== real OCR engine ===");
t("uses a local workerPath", /workerPath\s*:/.test(ocr) && /\/tesseract\/worker\.min\.js/.test(ocr));
t("uses a local corePath", /corePath\s*:/.test(ocr) && /\/tesseract/.test(ocr));
t("uses a local langPath", /langPath\s*:/.test(ocr) && /\/tessdata/.test(ocr));
t("no CDN URL remains in the OCR engine", !/cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com/.test(ocr));
t(
  "no silent CDN fallback on createWorker failure",
  !/catch\s*\([\s\S]{0,300}createWorker/.test(ocr)
);
t("fails closed with an actionable error", /offline|Offline|অফলাইন/.test(ocr));

console.log("=== offline assets ===");
const syncScript = "scripts/sync-tesseract-assets.mjs";
t("asset sync script exists", has(syncScript));
t("npm predev syncs assets", /"predev"\s*:\s*"[^"]*sync-tesseract-assets/.test(JSON.stringify(pkg.scripts)));
t("npm prebuild syncs assets", /"prebuild"\s*:\s*"[^"]*sync-tesseract-assets/.test(JSON.stringify(pkg.scripts)));
if (has(syncScript)) {
  const sync = read(syncScript);
  t("sync copies the worker", /worker\.min\.js/.test(sync));
  t("sync copies LSTM cores (oem=1)", /simd-lstm\.wasm\.js|tesseract-core-lstm\.wasm\.js/.test(sync));
  t("sync output is gitignored", /tesseract/.test(read(".gitignore")));
  // V-80: regression guard for CI job 126186571526. On Windows, join()
  // produces backslashes; splitting on "/" returned the whole absolute path.
  const winPath = "D:\\a\\VaultZero\\VaultZero\\node_modules\\tesseract.js\\dist\\worker.min.js";
  t("detects the Windows path-splitting bug", winPath.split("/").pop() === winPath);
  t("path.win32.basename extracts the real filename", win32.basename(winPath) === "worker.min.js");
  t("sync uses basename() (cross-platform)", /basename\(src\)/.test(sync));
}
const tessdata = has("public/tessdata") ? readdirSync(join(ROOT, "public/tessdata")) : [];
t("bundles English traineddata", tessdata.includes("eng.traineddata"), tessdata.join(", "));
t("bundles Bengali traineddata", tessdata.includes("ben.traineddata"));
t("OCR language list includes dual eng+ben", /"eng\+ben"/.test(ocr));

console.log("=== V-94: real recognised text, never image metadata ===");
const capture = read("src/components/captureModals.tsx");
t("returns the worker's recognised text", /ret\.data\?\.text/.test(ocr) && /rawText\s*=\s*\(ret\.data/.test(ocr));
t("throws when the worker finds no characters", /No readable characters detected/.test(ocr));
t("never assigns file.name to rawText", !/rawText\s*=\s*[^;]*file\.name/.test(ocr));
t("never assigns file.size or dimensions to rawText", !/rawText\s*=\s*[^;]*(file\.size|width|height)/.test(ocr));
t("progress is streamed from real engine stages", /onProgress\(10\)/.test(ocr) && /onProgress\(25\)/.test(ocr) && /onProgress\(100\)/.test(ocr));
t("worker logger drives intermediate progress", /recognizing text/.test(ocr) && /onProgress\(Math\.min\(99/.test(ocr));
t("OCR modal seeds the editable pad with rawText", /const \{ rawText, creds \} = await runLocalOcr/.test(capture) && /OcrCopyPad[\s\S]{0,200}rawText=/.test(capture));
t("dual eng+ben worker is wired to the language picker", /setOcrLang\(item\.id\)/.test(capture) && /runLocalOcr\(file,\s*\(p\) => setProgress\(p\),\s*ocrLang\)/.test(capture));
t("OCR caption describes the real engine, not a fake vision model", !/on-device vision model/i.test(capture));

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
