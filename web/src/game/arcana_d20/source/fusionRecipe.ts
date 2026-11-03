// ============================================================================
// Semantic fusion recipe engine — ONE reusable mechanism for all fusion slots.
//
// A recipe declares, per component: source engine (A/B/C), source SKILL id,
// role (structure/light/ink/arc/impact) and an optional phase window. The
// compositor NEVER averages complete world-composited RGB frames. Instead:
//   1. ONE world input (the real SOH region) is the only base.
//   2. The lead component renders the full structure (world + its own light).
//   3. Each secondary component is rendered on the SAME world, and only its
//      SIGNED DELTA vs that world (its ink/light contribution, not its floor)
//      is merged into the base — additively for light/arc/impact, as darkening
//      for ink — inside its phase window. Sizes are center-aligned, never
//      top-left cropped.
// ============================================================================
import { ARunner, A_W, A_H } from './aRunner';
import { BRunner, B_W, B_H } from './bRunner';
import { CRunner, C_W, C_H } from './cRunner';

export type SourceEngine = 'A' | 'B' | 'C';
export type ComponentRole = 'structure' | 'light' | 'ink' | 'arc' | 'impact';

export interface FusionComponent {
  engine: SourceEngine;
  skillId: number;          // which ORIGINAL source spell provides the component
  role: ComponentRole;
  phase?: [number, number]; // fraction of the lead duration in which it acts
}
export interface FusionRecipe {
  id: number;
  lead: FusionComponent;
  components: FusionComponent[]; // secondary components merged as signed deltas
}

/** Creator-approved fusion recipes (FUSION_DECISIONS.md). #11 uses C#09 arcs. */
export const RECIPES: Record<number, FusionRecipe> = {
  1: { id: 1, lead: { engine: 'A', skillId: 1, role: 'structure' },
       components: [{ engine: 'C', skillId: 1, role: 'light' }] },
  5: { id: 5, lead: { engine: 'A', skillId: 5, role: 'structure' },
       components: [{ engine: 'C', skillId: 5, role: 'light' }] },
  9: { id: 9, lead: { engine: 'A', skillId: 9, role: 'structure' },
       components: [{ engine: 'C', skillId: 9, role: 'arc' }, { engine: 'B', skillId: 9, role: 'impact' }] },
  11: { id: 11, lead: { engine: 'A', skillId: 11, role: 'structure' },
        components: [{ engine: 'C', skillId: 9, role: 'arc', phase: [0.25, 0.95] }] }, // C#09 bolt generator on A's connectors
  16: { id: 16, lead: { engine: 'A', skillId: 16, role: 'structure' },
        components: [{ engine: 'C', skillId: 16, role: 'light' }] },
};

export function recipeLabel(r: FusionRecipe): string {
  const parts = [r.lead, ...r.components].map(c => `${c.engine}#${c.skillId}`);
  return parts.join('+');
}

export interface RecipeRunner {
  setWorld(rgba: Uint8ClampedArray): void;
  cast(index: number): void;
  seek(t: number): void;
  readonly out: Uint8ClampedArray;
  readonly duration: number;
}
export interface RecipeRunners { a: RecipeRunner; b: RecipeRunner; c: RecipeRunner }

function engineSize(e: SourceEngine): [number, number] {
  return e === 'A' ? [A_W, A_H] : e === 'B' ? [B_W, B_H] : [C_W, C_H];
}

/**
 * Compose one fusion frame. `worldFor(size)` must return the real SOH world
 * region for a given component size. Output is written into `out` (lead size).
 */
export function composeFusion(
  recipe: FusionRecipe,
  runners: RecipeRunners,
  worldFor: (w: number, h: number) => Uint8ClampedArray,
  tFrac: number,
  out: Uint8ClampedArray,
): void {
  const [LW, LH] = engineSize(recipe.lead.engine);
  // 1+2: lead structure on the one world base
  const leadWorld = worldFor(LW, LH);
  const lead: RecipeRunner = recipe.lead.engine === 'A' ? runners.a : recipe.lead.engine === 'B' ? runners.b : runners.c;
  lead.setWorld(leadWorld);
  lead.cast(recipe.lead.skillId - 1);
  lead.seek(tFrac * (lead.duration || 1));
  const leadOut = lead.out;
  out.set(leadOut.length === out.length ? leadOut : leadOut.subarray(0, out.length));

  // 3: secondary components as SIGNED DELTAS vs the same world
  for (const comp of recipe.components) {
    if (comp.phase && (tFrac < comp.phase[0] || tFrac > comp.phase[1])) continue;
    const [cw, ch] = engineSize(comp.engine);
    const world = worldFor(cw, ch);
    const r: RecipeRunner = comp.engine === 'A' ? runners.a : comp.engine === 'B' ? runners.b : runners.c;
    r.setWorld(world);
    r.cast(comp.skillId - 1);
    const dur = r.duration || 1;
    r.seek(Math.min(tFrac * dur, dur));
    const cOut = r.out;
    const ox = Math.round((LW - cw) / 2), oy = Math.round((LH - ch) / 2);
    for (let y = 0; y < LH; y++) {
      const cy = y - oy;
      if (cy < 0 || cy >= ch) continue;
      for (let x = 0; x < LW; x++) {
        const cx = x - ox;
        if (cx < 0 || cx >= cw) continue;
        const ci = (cy * cw + cx) * 4, di = (y * LW + x) * 4;
        for (let k = 0; k < 3; k++) {
          const delta = cOut[ci + k] - world[ci + k]; // signed ink/light vs world
          if (comp.role === 'ink') { if (delta < 0) out[di + k] = Math.max(0, out[di + k] + delta); }
          else out[di + k] = Math.min(255, out[di + k] + Math.max(0, delta)); // light/arc/impact add light
        }
      }
    }
  }
}
