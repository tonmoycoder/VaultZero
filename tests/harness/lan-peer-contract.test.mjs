// V-92 / Batch 3 — strict RFC-1918 peers + a REAL LAN IPv4 from the Rust core.
// Positive controls prove the detector would have caught the old behaviour.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const bundle = (name) => pathToFileURL(join(ROOT, ".harness-build", name)).href;
const m = await import(bundle("p2pMerge-built.mjs"));

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

console.log("=== positive control: the OLD validator accepted public IPs ===");
const legacy = (v) => /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/.test(v.trim());
t("legacy shape check WOULD accept 8.8.8.8:1420", legacy("8.8.8.8:1420"));
t("detector is sensitive (a blank snippet has no UdpSocket)", !/UdpSocket::bind/.test("fn lan_ipv4() {}"));

console.log("=== strict RFC-1918 peer validation ===");
const PRIVATE = [
  "10.0.0.5", "10.255.255.254:52137", "172.16.0.1", "172.31.255.254:52137",
  "192.168.1.5:52137", "192.168.0.1",
];
const PUBLIC = [
  "8.8.8.8:1420", "1.1.1.1", "172.15.0.1:52137", "172.32.0.1",
  "192.169.1.5", "169.254.1.1", "127.0.0.1:1420", "localhost",
  "tauri.localhost", "192.1", "192.168.1.5:99999", "999.1.1.1:1420",
];
for (const v of PRIVATE) t(`accepts private ${v}`, m.isValidPeerAddress(v) === true);
for (const v of PUBLIC) t(`rejects ${v}`, m.isValidPeerAddress(v) === false);
t(
  "QR JSON with a public ip yields no peer",
  m.parsePeerInput('{"app":"vaultzero","ip":"8.8.8.8","port":1420,"code":"729184"}').address === null,
);
t(
  "QR JSON with a private ip:port still works",
  m.parsePeerInput('{"ip":"10.0.0.7","port":42222,"code":"112233"}').address === "10.0.0.7:42222",
);

console.log("=== Rust: real LAN IPv4 via the UDP-socket trick ===");
const p2pRust = read("src-tauri/src/p2p_lan.rs");
const libRust = read("src-tauri/src/lib.rs");
const rust = p2pRust + "\n" + libRust;
t("a lan_ipv4 command is defined", /fn lan_ipv4\s*\(/.test(rust));
t("binds an ephemeral UDP socket", /UdpSocket::bind\("0\.0\.0\.0:0"\)/.test(rust));
t("uses the connect-to-a-route trick (no packet is sent)", /connect\("8\.8\.8\.8:80"\)/.test(rust));
t("reads local_addr()", /local_addr\(\)/.test(rust));
t("filters to private LAN ranges", /10\.|192\.168|172\.16/.test(rust));
t("registered in generate_handler!", /commands::lan_ipv4/.test(libRust));

console.log("=== Renderer: uses it, never advertises tauri.localhost ===");
const modals = read("src/components/toolModals.tsx");
t("the renderer calls lan_ipv4", /"lan_ipv4"/.test(modals));
t("native runtime is detected before the call", /isNativeRuntime\s*\(/.test(modals));
t("a manual LAN-IP fallback exists", /manualLanIp|Enter your LAN IP/.test(modals));
t("hostname is not the only source of truth", /hostPayload[\s\S]{0,220}lanHost/.test(modals));
t("no hardcoded tauri.localhost advertisement", !/IP:\s*\{?\s*["']tauri\.localhost/.test(modals));

console.log("=== V-92 review fix: the LAN probe must be REUSABLE ===");
const reProbeRe = /const handleDiscover = async \(\) => \{[\s\S]{0,400}?if \(!lanHost\) void probeLanIp\(\)/;
t("the probe is a reusable callback, not a one-shot effect", /const probeLanIp = useCallback/.test(modals));
t("Discover re-probes when Wi-Fi appeared after mount", reProbeRe.test(modals));
t("positive control: a handler WITHOUT re-probe is rejected", !reProbeRe.test(
  "const handleDiscover = async () => { await invoke('discover_peers'); " + "x".repeat(500) + " }; const probeLanIp = () => {};"
));

console.log(`=== ${failures === 0 ? "GREEN" : "RED"}: ${failures} failure(s) ===`);
process.exit(failures === 0 ? 0 : 1);
