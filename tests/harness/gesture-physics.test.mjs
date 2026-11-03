// V-58: Elastic Stretch & Rebound + Speed-Responsive Physics.
//
// These are the pure maths behind the UI springs. Testing them without a
// browser makes the physics deterministic: no animation timing flake.
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const BUNDLE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".harness-build") + "/";
const m = await import(pathToFileURL(join(BUNDLE_DIR, "gesture-built.mjs")).href);

let failures = 0;
const t = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

console.log("=== rubber-band stretch ===");
t("zero / negative offset has no stretch", m.rubberBand(0, 600) === 0 && m.rubberBand(-40, 600) === 0);
const smallPull = m.rubberBand(20, 600, 1);
t("small pull moves almost 1:1", smallPull > 18 && smallPull < 20, String(smallPull));
t("stretch grows monotonically", m.rubberBand(100, 600) < m.rubberBand(200, 600));
t("stretch is bounded by the surface dimension", m.rubberBand(100000, 600) < 600);
t("large pulls asymptote instead of growing linearly", m.rubberBand(100000, 600) - m.rubberBand(10000, 600) < 100);
t("invalid dimension is rejected", m.rubberBand(50, 0) === 0 && m.rubberBand(50, NaN) === 0);
t("NaN / Infinity offset is rejected", m.rubberBand(NaN, 600) === 0 && m.rubberBand(Infinity, 600) === 0);

console.log("=== speed intensity and labels ===");
t("gentle speed maps to 0", m.speedIntensity(0) === 0 && m.speedIntensity(200) === 0);
t("firm speed maps to 1", m.speedIntensity(1500) === 1 && m.speedIntensity(99999) === 1);
t("labels", m.speedLabel(100) === "gentle" && m.speedLabel(800) === "balanced" && m.speedLabel(2200) === "firm");
t("negative speed is ignored (direction is a separate argument)", m.clampSpeed(-900) === 0);

console.log("=== speed-responsive springs ===");
const gentle = m.speedResponsiveSpring(120);
const firm = m.speedResponsiveSpring(2400);
t("fast gesture is stiffer", firm.stiffness > gentle.stiffness, `${gentle.stiffness} -> ${firm.stiffness}`);
t("fast gesture is less damped (more bounce)", firm.damping < gentle.damping, `${gentle.damping} -> ${firm.damping}`);
t("fast gesture carries velocity", firm.velocity > gentle.velocity);
t("direction flips velocity", m.speedResponsiveSpring(900, -1).velocity < 0);
t("gentle spring is nearly critically settled, firm one overshoots", (gentle.damping / (2 * Math.sqrt(gentle.stiffness * gentle.mass))) > (firm.damping / (2 * Math.sqrt(firm.stiffness * firm.mass))));
t("reduced motion uses an overdamped zero-velocity spring", m.speedResponsiveSpring(2400, 1, true).velocity === 0 && m.speedResponsiveSpring(2400, 1, true).damping === 100);
const pressGentle = m.pressSpring(100, true);
const pressFirm = m.pressSpring(2400, true);
t("press rebound scales with speed", pressFirm.stiffness > pressGentle.stiffness && pressFirm.damping < pressGentle.damping);
t("press-down spring is stiff", m.pressSpring(0, false).stiffness === 1050);
t("rebound overshoot is bounded", m.reboundOvershoot(0) === 1 && m.reboundOvershoot(99999) <= 1.045001);

console.log("=== elastic stretch of a pressed surface ===");
const idle = m.stretchFromDelta(0, 0);
const horizontal = m.stretchFromDelta(200, 0);
const vertical = m.stretchFromDelta(0, 200);
t("no delta = no distortion", idle.scaleX === 1 && idle.scaleY === 1);
t("horizontal pull compresses X, expands Y", horizontal.scaleX < 1 && horizontal.scaleY >= 1);
t("vertical pull compresses Y, expands X", vertical.scaleY < 1 && vertical.scaleX >= 1);
t("stretch is bounded for huge drags", m.stretchFromDelta(99999, 99999).scaleX >= 0.94 && m.stretchFromDelta(99999, 99999).scaleY >= 0.94);
t("speed from samples", Math.abs(m.speedFromSamples(0, 0, 100, 0, 100) - 1000) < 0.001);
t("zero elapsed time is not a division by zero", m.speedFromSamples(0, 0, 100, 0, 0) === 0);

console.log("=== dismiss decision follows velocity ===");
t("slow small pull stays open", m.shouldDismiss(20, 60, 60) === false);
t("slow large pull dismisses", m.shouldDismiss(200, 100, 60) === true);
t("fast short flick dismisses", m.shouldDismiss(35, 1200, 60) === true);
t("moderate pull + velocity dismisses", m.shouldDismiss(80, 400, 60) === true);
t("upward velocity alone never dismisses", m.shouldDismiss(10, -2000, 60) === false);
t("a tiny flick cannot fling a whole sheet away", m.shouldDismiss(30, 5000, 60) === false);

console.log("=== interaction speed registry ===");
m.resetInteractionSpeed();
t("empty registry is gentle", m.getInteractionSpeed() === 0);
m.reportInteractionSpeed(1250);
t("reported speed is readable", m.getInteractionSpeed() === 1250);
m.resetInteractionSpeed();
t("reset clears it", m.getInteractionSpeed() === 0);

console.log(`\nRESULT: ${failures === 0 ? "all passed" : failures + " failed"}`);
process.exit(failures === 0 ? 0 : 1);
