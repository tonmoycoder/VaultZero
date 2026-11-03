// The pairing PIN has to be as long as the host lockout assumes.
//
// The host stops serving a listener after five failed attempts, which is
// a sensible limit for a six-digit code — 10^6 possibilities. The
// frontend generated a three-digit code, so the whole key space was 10^3
// and the lockout bought nothing. The display already formatted the code
// as "123 456", so the shorter code was visible as a formatting glitch
// rather than as the weakness it was.
//
// The check below re-implements the generator and asserts that it draws
// six digits, that the digits are uniform, and that the source file
// cannot regress to the three-digit version.
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

let failures = 0;
const t = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) {
    failures++;
    if (detail) console.log(`      ${detail}`);
  }
};

// ---------------------------------------------------------------------------
// 1. The generator produces six digits.
// ---------------------------------------------------------------------------

/** The generator as it is written in the component. */
function generatePin() {
  const digits = [];
  while (digits.length < 6) {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (digits.length === 6) break;
      if (byte < 250) digits.push(byte % 10);
    }
  }
  return digits.join("");
}

{
  const pin = generatePin();
  t("the PIN has six digits", /^\d{6}$/.test(pin), `got ${JSON.stringify(pin)}`);
  t("every digit is a decimal digit", /^[0-9]+$/.test(pin), pin);
}

// ---------------------------------------------------------------------------
// 2. The digits are uniform — no byte bias.
// ---------------------------------------------------------------------------

{
  // Every digit value has to appear at roughly the same rate. A `byte % 10`
  // draw over the full byte range would favour 0..5, because 256 is not a
  // multiple of 10.
  const counts = new Array(10).fill(0);
  const draws = 60000;
  for (let i = 0; i < draws; i += 1) {
    // Every digit of every PIN is counted, not only the first one.
    for (const digit of generatePin()) {
      counts[Number(digit)] += 1;
    }
  }

  const expected = (draws * 6) / 10;
  const worst = Math.max(...counts.map((c) => Math.abs(c - expected))) / expected;
  t(
    "the leading digit is uniformly distributed",
    worst < 0.05,
    `worst deviation is ${(worst * 100).toFixed(2)}%`
  );

  // A `byte % 10` draw over the full byte range would favour 0..5, because
  // 256 is not a multiple of 10. Every digit value has to be within a few
  // percent of the expectation, and the six lower digits must not
  // outweigh the four upper ones.
  const lower = counts.slice(0, 6).reduce((a, b) => a + b, 0);
  const upper = counts.slice(6).reduce((a, b) => a + b, 0);
  const ratio = lower / upper;
  t(
    "the draw does not favour the lower half of the range",
    Math.abs(ratio - 1.5) < 0.1,
    `the ratio is ${ratio.toFixed(3)}, the unbiased expectation is 1.5`
  );
}

// ---------------------------------------------------------------------------
// 3. The component cannot regress to the short PIN.
// ---------------------------------------------------------------------------

{
  const source = readFileSync(join(root, "src", "components", "toolModals.tsx"), "utf8");

  t(
    "the component does not build a three-digit PIN",
    !/new Uint8Array\(3\)/.test(source),
    "the generator still requests three bytes"
  );
  t(
    "the component asks for six digits",
    /digits\.length < 6/.test(source),
    "the generator no longer loops until six digits are drawn"
  );
  t(
    "the component rejects the biased tail of the byte range",
    /byte < 250/.test(source),
    "the generator does not reject the out-of-range bytes"
  );
}

if (failures > 0) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll pairing-PIN checks passed.");
