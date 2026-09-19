// Run with: npm run verify  (builds first)
import { AURAS, validateAura, validateRegistry, motionFor, MOTION, deriveAuraFromVideo, tempoFromCuts, composeExperience } from "../dist/src/design/index.js";
import { pages } from "../dist/examples/pages.config.js";

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "pass" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
};

// 1. every aura is accessible and well-formed
for (const a of AURAS) {
  const problems = validateAura(a);
  check(`aura ${a.id}`, problems.length === 0, problems.join("; "));
}

// 2. auras are distinct from each other
const ids = new Set(AURAS.map((a) => a.id));
const accents = new Set(AURAS.map((a) => a.palette.accent));
check("aura ids unique", ids.size === AURAS.length);
check("aura accents unique", accents.size === AURAS.length);

// 3. reduced motion is always a short opacity fade
for (const tempo of Object.keys(MOTION)) {
  const m = motionFor(tempo, true);
  check(`reduced motion (${tempo})`, m.durations.long <= 120 && m.allowedProperties?.[0] === "opacity");
}

// 4. video derivation
check("tempoFromCuts", tempoFromCuts(2) === "slow" && tempoFromCuts(30) === "kinetic");
const derived = deriveAuraFromVideo(AURAS[0], { cutsPerMinute: 12, dominantColors: ["#101010", "#F0C080"], meanLuminance: 0.3 });
check("video aura keeps accessible accent", derived.palette.accent === "#F0C080" && validateAura(derived).length === 0);

// 5. example registry
const errs = validateRegistry(pages);
check("example registry", errs.length === 0, errs.join("; "));
const bad = validateRegistry([{ ...pages[0] }, { ...pages[0], id: "dupe", route: "/dupe" }]);
check("registry rejects near-duplicate pages", bad.some((e) => e.includes("share section")));
const exp = composeExperience(pages[0]);
check("composeExperience", exp.composition("compact") === "vertical-story" && exp.cssVars["--aura-accent"] === "#CDB784");

console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
