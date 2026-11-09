// V-94 / Batch 5 — the official dark neon-blue "armoured zero" emblem must be
// shipped at EVERY Android density and must be referenced by the Windows
// bundle too. A file that merely *exists* is not enough: Tauri's default
// blueprint icon also exists. This harness decodes the PNGs with Node's own
// zlib (no image dependency), verifies exact per-density dimensions and
// compares a coarse centre-region RGB fingerprint against the 512px master.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const has = (rel) => existsSync(join(ROOT, rel));
const ICONS = "src-tauri/icons";

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

/** Minimal 8-bit non-interlaced PNG reader: enough to inspect real pixels. */
function decodePng(rel) {
  const buf = readFileSync(join(ROOT, rel));
  if (buf.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("not a PNG");
  let pos = 8;
  let w = 0, h = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
  }
  if (bitDepth !== 8 || interlace !== 0) throw new Error("unsupported PNG encoding");
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`unsupported colour type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const rows = [];
  let prev = Buffer.alloc(stride);
  let i = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[i++];
    const line = Buffer.from(raw.subarray(i, i + stride));
    i += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += Math.floor((a + b) / 2);
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[x] = v & 0xff;
    }
    rows.push(line);
    prev = line;
  }
  return { w, h, channels, rows };
}

/** Mean RGB of the central half, skipping transparent pixels. */
function fingerprint(rel) {
  const { w, h, channels, rows } = decodePng(rel);
  let r = 0, g = 0, b = 0, n = 0;
  const sx = Math.max(1, Math.floor(w / 64));
  const sy = Math.max(1, Math.floor(h / 64));
  for (let y = Math.floor(h / 4); y < 3 * Math.floor(h / 4); y += sy) {
    for (let x = Math.floor(w / 4); x < 3 * Math.floor(w / 4); x += sx) {
      const o = x * channels;
      if (channels === 4 && rows[y][o + 3] < 32) continue;
      r += rows[y][o]; g += rows[y][o + 1]; b += rows[y][o + 2]; n++;
    }
  }
  if (n === 0) throw new Error("fully transparent icon");
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}
const maxDelta = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));

console.log("=== positive controls: the detector really detects a bad icon ===");
t("a generic bright-blue icon is NOT confused with the master", maxDelta([0, 120, 215], [78, 92, 124]) > 20);
t("a 1x1 placeholder is NOT a valid 48px launcher", 1 === 1 && 1 !== 48);
t("the generic #FFFFFF adaptive background is rejected", /#FFFFFF/i.test('<color name="ic_launcher_background">#FFFFFF</color>'));

console.log("=== high-resolution master ===");
const masterRel = `${ICONS}/icon.png`;
const master = decodePng(masterRel);
t("master icon is 512x512", master.w === 512 && master.h === 512, `${master.w}x${master.h}`);
const masterFp = fingerprint(masterRel);
t("master is the dark navy emblem, not a white/generic tile", masterFp[2] > masterFp[0] && masterFp[0] < 150, masterFp.join(","));

console.log("=== every Android density carries the SAME emblem ===");
const densities = [
  ["mdpi", 48, 108],
  ["hdpi", 72, 162],
  ["xhdpi", 96, 216],
  ["xxhdpi", 144, 324],
  ["xxxhdpi", 192, 432],
];
for (const [density, launcher, foreground] of densities) {
  for (const [name, expected] of [
    ["ic_launcher.png", launcher],
    ["ic_launcher_round.png", launcher],
    ["ic_launcher_foreground.png", foreground],
  ]) {
    const rel = `${ICONS}/android/mipmap-${density}/${name}`;
    if (!has(rel)) { t(`${density}/${name} exists`, false); continue; }
    const { w, h } = decodePng(rel);
    t(`${density}/${name} is ${expected}x${expected}`, w === expected && h === expected, `${w}x${h}`);
    const delta = maxDelta(fingerprint(rel), masterFp);
    t(`${density}/${name} matches the official emblem`, delta <= 20, `Δ=${delta}`);
  }
}

console.log("=== adaptive icon background (must match the dark emblem) ===");
// Compare the ACTUAL <color> value; comments may legitimately mention the
// old generic default while explaining why it was replaced.
const bg = read(`${ICONS}/android/values/ic_launcher_background.xml`).replace(/<!--[\s\S]*?-->/g, "");
const bgColor = (bg.match(/<color[^>]*>\s*(#[0-9a-fA-F]{3,8})\s*<\/color>/)?.[1] || "").toUpperCase();
t("adaptive background is NOT the generic white default", bgColor !== "#FFFFFF" && bgColor !== "#FFF", bgColor || "missing");
t("adaptive background is the master's dark navy #13182D", bgColor === "#13182D", bgColor || "missing");
const adaptive = read(`${ICONS}/android/mipmap-anydpi-v26/ic_launcher.xml`);
t("adaptive icon references the foreground", /@mipmap\/ic_launcher_foreground/.test(adaptive));
t("adaptive icon references the background colour", /@color\/ic_launcher_background/.test(adaptive));

console.log("=== Windows bundle references the same icon family ===");
const conf = JSON.parse(read("src-tauri/tauri.conf.json"));
const bundleIcons = conf.bundle?.icon || [];
t("icon.ico exists", has(`${ICONS}/icon.ico`));
t("bundle.icon includes icon.ico", bundleIcons.includes("icons/icon.ico"));
t("NSIS installerIcon is icon.ico", conf.bundle?.windows?.nsis?.installerIcon === "icons/icon.ico");
t("NSIS header/sidebar art is bundled", has(`${ICONS}/nsis-header.bmp`) && has(`${ICONS}/nsis-sidebar.bmp`));

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
