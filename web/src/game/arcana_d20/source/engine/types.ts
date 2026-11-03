import type { Frame } from './frame';
import type { Rng } from './math';
import type { RGB, School } from './palette';

export interface FX {
  /** impulses (call from update for deterministic scrubbing) */
  shake(a: number): void;
  flash(c: RGB, k: number): void;
  kick(chroma: number): void;
  /** per-frame post values (reset before every render) */
  invert: number;
  desat: number;
  chroma: number;
  bloom: number;
  /** ambient-time controls (set inside update each step) */
  ambient: number;
  ambientEcho: number;
}

export interface Inst {
  update(dt: number, t: number): void;
  render(f: Frame, t: number): void;
}

export interface SpellDef {
  id: number;
  name: string;
  school: School;
  dur: number;
  climax: number;
  blurb: string;
  make(rng: Rng, fx: FX): Inst;
}
