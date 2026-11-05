// V-84: Stage 5.1 workspace hygiene. Agent memory / prompt / MCP scratch
// files must stay out of Git; a fresh clone must not depend on them.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ignore = readFileSync(join(ROOT, ".gitignore"), "utf8");
const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n");

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

console.log("=== positive control ===");
t("detects an ignore file that misses AGENTS.md", !/AGENTS\.md/.test("# empty\n"));
t("accepts an ignore file that covers it", /AGENTS\.md/.test("AGENTS.md\n"));

console.log("=== every scratch convention is ignored ===");
for (const pattern of [
  ".agent/", ".agents/", "agent/", "*PROMPT*.md", "*HANDOFF*.md",
  "MEMORY_BANK.md", "TASK_QUEUE.md", "AGENTS.md", ".mcp.json", "src-tauri/gen/",
]) {
  t(`.gitignore covers ${pattern}`, ignore.includes(pattern));
}

console.log("=== nothing scratch is tracked ===");
const forbidden = tracked.filter((f) =>
  /\/(AGENTS\.md|MEMORY_BANK\.md|TASK_QUEUE\.md|\.mcp\.json)$/.test(f) ||
  /^(AGENTS\.md|MEMORY_BANK\.md|TASK_QUEUE\.md|\.mcp\.json)$/.test(f) ||
  /(^|\/)\.agent(s)?\//.test(f) ||
  /(PROMPT|HANDOFF)/.test(f)
);
t("git ls-files has no agent/prompt/MCP scratch file", forbidden.length === 0, forbidden.join(", "));

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
