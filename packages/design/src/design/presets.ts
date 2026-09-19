import type { Aura } from "./aura.js";

/**
 * Starter auras. Each is a proposal: rename, retune, or replace them as the
 * product's real pages are mapped. All must pass validateAura.
 */
export const AURAS: readonly Aura[] = [
  {
    id: "obsidian-command",
    codename: "Obsidian Command",
    domain: "Executive",
    meaning: "Quiet power. A room where decisions are made without raising a voice.",
    feel: ["commanding", "strategic", "restrained"],
    palette: { surface: "#0D0F1A", surfaceRaised: "#171B2C", ink: "#EDE9E1", inkMuted: "#A6ACC2", accent: "#CDB784", signal: "#82AAFF" },
    tokens: { auraIntensity: 0.35, motionTempo: "slow", visualDensity: 2, depthLevel: 2, lighting: "directional", typographicDrama: 0.7, imageTreatment: "graded", videoIntensity: 0.2, interactionDensity: 2 },
  },
  {
    id: "midnight-ledger",
    codename: "Midnight Ledger",
    domain: "Finance",
    meaning: "Precision after hours. Every figure accounted for, nothing ornamental.",
    feel: ["precise", "controlled", "trustworthy"],
    palette: { surface: "#08121A", surfaceRaised: "#10202D", ink: "#E6EEF2", inkMuted: "#93A8B6", accent: "#5FD0C0", signal: "#E8C26A" },
    tokens: { auraIntensity: 0.25, motionTempo: "measured", visualDensity: 4, depthLevel: 1, lighting: "diffuse", typographicDrama: 0.3, imageTreatment: "monochrome", videoIntensity: 0, interactionDensity: 4 },
  },
  {
    id: "velvet-product",
    codename: "Velvet Product",
    domain: "Product",
    meaning: "Desire, slowly revealed. The object is the light source.",
    feel: ["desirable", "cinematic", "tactile"],
    palette: { surface: "#17100F", surfaceRaised: "#251A18", ink: "#F4ECE6", inkMuted: "#BCAAA0", accent: "#E8A9AD", signal: "#F1D9A0" },
    tokens: { auraIntensity: 0.7, motionTempo: "slow", visualDensity: 2, depthLevel: 4, lighting: "spot", typographicDrama: 0.9, imageTreatment: "graded", videoIntensity: 0.8, interactionDensity: 3 },
  },
  {
    id: "signal-marketing",
    codename: "Signal Marketing",
    domain: "Marketing",
    meaning: "A campaign in motion. Energy that points somewhere.",
    feel: ["energetic", "kinetic", "creative"],
    palette: { surface: "#130C22", surfaceRaised: "#21153A", ink: "#F3EEFF", inkMuted: "#B4A8D6", accent: "#FF78B0", signal: "#7CF0D0" },
    tokens: { auraIntensity: 0.85, motionTempo: "kinetic", visualDensity: 3, depthLevel: 3, lighting: "directional", typographicDrama: 0.85, imageTreatment: "duotone", videoIntensity: 0.6, interactionDensity: 4 },
  },
  {
    id: "orbit-customer",
    codename: "Orbit Customer",
    domain: "Customer",
    meaning: "A person, remembered. Warm light, a history that follows them.",
    feel: ["human", "warm", "personal"],
    palette: { surface: "#1A1512", surfaceRaised: "#282019", ink: "#F6EFE6", inkMuted: "#BFAE9C", accent: "#F2B57F", signal: "#A2CDA6" },
    tokens: { auraIntensity: 0.5, motionTempo: "measured", visualDensity: 2, depthLevel: 2, lighting: "ambient", typographicDrama: 0.5, imageTreatment: "natural", videoIntensity: 0.3, interactionDensity: 3 },
  },
  {
    id: "flowline-operations",
    codename: "Flowline Operations",
    domain: "Operations",
    meaning: "Systems working together. Motion that never quite stops.",
    feel: ["mechanical", "continuous", "systematic"],
    palette: { surface: "#0A1613", surfaceRaised: "#12251F", ink: "#E8F2EE", inkMuted: "#98B4AB", accent: "#7BD8B0", signal: "#F2C46B" },
    tokens: { auraIntensity: 0.4, motionTempo: "brisk", visualDensity: 4, depthLevel: 2, lighting: "diffuse", typographicDrama: 0.3, imageTreatment: "monochrome", videoIntensity: 0.1, interactionDensity: 5 },
  },
  {
    id: "neural-atlas",
    codename: "Neural Atlas",
    domain: "Analytics",
    meaning: "Information becoming intelligence. Depth you can read.",
    feel: ["clear", "layered", "revealing"],
    palette: { surface: "#0A0E1F", surfaceRaised: "#131A38", ink: "#E9ECFA", inkMuted: "#9CA6D2", accent: "#8FA6FF", signal: "#FFB86B" },
    tokens: { auraIntensity: 0.55, motionTempo: "measured", visualDensity: 4, depthLevel: 3, lighting: "ambient", typographicDrama: 0.4, imageTreatment: "duotone", videoIntensity: 0, interactionDensity: 4 },
  },
  {
    id: "sentinel-security",
    codename: "Sentinel Security",
    domain: "Security",
    meaning: "Defensive and minimal. Nothing on screen that is not a signal.",
    feel: ["defensive", "minimal", "alert"],
    palette: { surface: "#0A0A0C", surfaceRaised: "#151518", ink: "#EFEFF1", inkMuted: "#9E9EA9", accent: "#F2685E", signal: "#E8E8EA" },
    tokens: { auraIntensity: 0.15, motionTempo: "brisk", visualDensity: 3, depthLevel: 0, lighting: "spot", typographicDrama: 0.2, imageTreatment: "monochrome", videoIntensity: 0, interactionDensity: 3 },
  },
  {
    id: "chorus-agents",
    codename: "Chorus Agents",
    domain: "Agents",
    meaning: "Living intelligence with distinct voices, each visibly at work.",
    feel: ["alive", "specialised", "dynamic"],
    palette: { surface: "#0F1220", surfaceRaised: "#1A1F36", ink: "#EEF0FA", inkMuted: "#A4AAD0", accent: "#BBA3FF", signal: "#70E2FF" },
    tokens: { auraIntensity: 0.65, motionTempo: "brisk", visualDensity: 3, depthLevel: 3, lighting: "ambient", typographicDrama: 0.6, imageTreatment: "graded", videoIntensity: 0.3, interactionDensity: 4 },
  },
];

export const auraById = (id: string): Aura | undefined => AURAS.find((a) => a.id === id);
