// V-82: reproduces the desktop "localhost refused to connect" error page.
// Launch-VaultZero.bat opened a browser at http://localhost:1420 even when the
// local engine never started, so the user saw an Edge error page instead of
// the app. This guard is deterministic (reads the launcher, no network).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const bat = readFileSync(join(ROOT, "Launch-VaultZero.bat"), "utf8");

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

console.log("=== positive control: detector is not a stub ===");
const broken = "start msedge.exe --app=\"http://localhost:1420\"\r\nexit\r\n";
t("flags an unconditional browser launch", !/if %ERRORLEVEL%/.test(broken));
const fixed = "if %ERRORLEVEL% neq 0 exit /b 1\r\nstart msedge.exe --app=\"http://localhost:1420\"\r\n";
t("accepts a readiness gate", /if %ERRORLEVEL% neq 0/.test(fixed));

console.log("=== real launcher ===");
t(
  "never opens a browser before confirming the engine answered HTTP 200",
  /if %ERRORLEVEL% neq 0[\s\S]{0,220}exit \/b 1/.test(bat) &&
    bat.indexOf("if %ERRORLEVEL% neq 0") < bat.indexOf("start msedge")
);
t("readiness flag is set only on HTTP 200", /\$ready = \$true/.test(bat) && /StatusCode -eq 200/.test(bat));
t("readiness probe fails closed when the engine never starts", /if \(-not \$ready\)[\s\S]{0,200}exit 1/.test(bat));
t(
  "prefers the published portable .exe over any dev-server fallback",
  /VaultZero-Windows-x64-Portable\.exe/.test(bat) &&
    bat.indexOf("VaultZero-Windows-x64-Portable.exe") < bat.indexOf("npm run dev")
);

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
