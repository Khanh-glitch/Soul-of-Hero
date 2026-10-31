import { Framebuffer } from "./framebuffer";
import { RGB } from "./math";

export type School = "PYRE" | "TIDE" | "TEMPEST" | "VERDANT" | "ASTRAL";

export interface SpellInstance {
  update(dt: number, t: number): void;
  render(fb: Framebuffer, t: number): void;
  /** optional background displacement, returns a per-pixel sampler */
  bgWarp?(t: number): ((x: number, y: number) => [number, number, number] | null) | null;
  /** 0..1 light the caster receives this frame */
  casterLight?(t: number): number;
}

export interface SpellDef {
  id: number;
  name: string;
  school: School;
  duration: number;
  tagline: string;
  /** timeline position (0..1) of the climax, used for screenshots */
  climax: number;
  accent: RGB;
  /** persistence [amount, decay]; defaults per school */
  trail?: [number, number];
  make(): SpellInstance;
}

export const SCHOOL_META: Record<School, { color: string; accent: RGB; blurb: string }> = {
  PYRE: { color: "#ff6a2a", accent: [1.6, 0.6, 0.15], blurb: "Fire as a living catastrophe" },
  TIDE: { color: "#3fa9ff", accent: [0.3, 0.8, 1.5], blurb: "Water, ice & the architecture of pressure" },
  TEMPEST: { color: "#8c7cff", accent: [0.7, 0.8, 2.0], blurb: "Electricity as unstable intelligence" },
  VERDANT: { color: "#59e06b", accent: [0.45, 1.3, 0.5], blurb: "Life as a supernatural force" },
  ASTRAL: { color: "#c26aff", accent: [0.9, 0.5, 1.7], blurb: "Magic that breaks reality" },
};
