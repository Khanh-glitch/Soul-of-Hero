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
import { CRunner, C_W, C_H, CATALOG } from './cRunner';
import { applyContribution, type Contribution } from './sourceContract';

export type SourceEngine = 'A' | 'B' | 'C';
export type ComponentRole = 'structure' | 'light' | 'ink' | 'arc' | 'impact';

export interface FusionComponent {
  engine: SourceEngine;
  skillId: number;          // which ORIGINAL source spell provides the component
  role: ComponentRole;
  extract?: 'arc' | 'light'; // which authored channel/primitive is extracted (lead: full structure)
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
       components: [{ engine: 'C', skillId: 1, role: 'light', extract: 'light' }] },
  5: { id: 5, lead: { engine: 'A', skillId: 5, role: 'structure' },
       components: [{ engine: 'C', skillId: 5, role: 'light', extract: 'light' }] },
  9: { id: 9, lead: { engine: 'A', skillId: 9, role: 'structure' },
       components: [{ engine: 'C', skillId: 9, role: 'arc', extract: 'arc' }, { engine: 'B', skillId: 9, role: 'impact', extract: 'light' }] },
  11: { id: 11, lead: { engine: 'A', skillId: 11, role: 'structure' },
        components: [{ engine: 'C', skillId: 9, role: 'arc', extract: 'arc', phase: [0.25, 0.95] }] }, // C#09 bolt generator on A's connectors
  16: { id: 16, lead: { engine: 'A', skillId: 16, role: 'structure' },
        components: [{ engine: 'C', skillId: 16, role: 'light', extract: 'light' }] },
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
interface ArcCapable extends RecipeRunner { extractArcs(index: number, t: number): import('./cRunner').ArcPacket[]; extractLight(index: number, t: number): Float32Array }
interface AnchorCapable extends RecipeRunner { anchorsFor(skillId: number, t: number): { x: number; y: number }[]; renderWithContributions(index: number, t: number, extra?: (fb: any) => void): void }
export interface RecipeRunners { a: RecipeRunner; b: RecipeRunner; c: RecipeRunner }

/**
 * Compose one fusion frame. `worldFor(size)` must return the real SOH world
 * region for a given component size. Output is written into `out` (lead size).
 */
/** Executable recipe validation — reject invalid recipes BEFORE rendering. */
export function validateRecipe(r: FusionRecipe): void {
  if (!r || !r.lead) throw new Error(`recipe #${r?.id}: missing lead`);
  if (!['A', 'B', 'C'].includes(r.lead.engine)) throw new Error(`recipe #${r.id}: invalid lead engine`);
  if (r.lead.skillId < 1 || r.lead.skillId > 20) throw new Error(`recipe #${r.id}: invalid lead skillId ${r.lead.skillId}`);
  for (const c of r.components) {
    if (!['A', 'B', 'C'].includes(c.engine)) throw new Error(`recipe #${r.id}: invalid engine ${c.engine}`);
    if (c.skillId < 1 || c.skillId > 20) throw new Error(`recipe #${r.id}: invalid component skillId ${c.skillId}`);
    if (c.extract !== 'arc' && c.extract !== 'light') throw new Error(`recipe #${r.id}: invalid extract '${c.extract}'`);
    if (!['structure', 'light', 'ink', 'arc', 'impact'].includes(c.role)) throw new Error(`recipe #${r.id}: invalid role '${c.role}'`);
    if (c.extract === 'arc' && c.engine !== 'C') throw new Error(`recipe #${r.id}: arc extraction only supported from engine C`);
    if (c.extract === 'arc' && c.role !== 'arc') throw new Error(`recipe #${r.id}: extract=arc must have role=arc`);
    if (c.phase && !(c.phase[0] >= 0 && c.phase[1] <= 1 && c.phase[0] < c.phase[1])) throw new Error(`recipe #${r.id}: invalid phase window`);
  }
}

export type WorldProvider = (w: number, h: number) => Uint8ClampedArray;

export function composeFusion(
  recipe: FusionRecipe,
  runners: RecipeRunners,
  worldFor: WorldProvider,   // MUST return the CURRENT world snapshot at exact size; fail closed otherwise
  tFrac: number,
  out: Uint8ClampedArray,
): void {
  validateRecipe(recipe);
  // 1: lead structure (A) rendered on the CURRENT world snapshot (no fallback)
  const aRunner = runners.a as unknown as AnchorCapable;
  aRunner.cast(recipe.lead.skillId - 1);
  const leadDur = runners.a.duration; // real source duration; 0 at cold start -> leadT 0, no hidden assumption
  const leadT = Math.min(Math.max(tFrac, 0), 1) * leadDur;
  aRunner.setWorld(worldFor(A_W, A_H));
  // 2: extract authored contributions from secondary sources (role+extract
  //    control WHAT is taken: arc packets vs pure light channel — never full RGB)
  let arcs: Contribution['arcs'], light: Float32Array | undefined, lightW = 0, lightH = 0;
  for (const comp of recipe.components) {
    if (comp.phase && (tFrac < comp.phase[0] || tFrac > comp.phase[1])) continue;
    const cIdx = comp.skillId - 1;
    const cDur = CATALOG[cIdx]?.dur ?? 1;
    const ct = Math.min(tFrac, 1) * cDur;
    if (comp.extract === 'arc' && comp.engine === 'C') {
      arcs = (runners.c as unknown as ArcCapable).extractArcs(cIdx, ct);
    } else if (comp.extract === 'light') {
      if (comp.engine === 'C') { light = (runners.c as unknown as ArcCapable).extractLight(cIdx, ct); lightW = C_W; lightH = C_H; }
      else if (comp.engine === 'B') { const b = (runners.b as unknown as { extractLight(i: number, t: number): { data: Float32Array; w: number; h: number } }).extractLight(cIdx, ct); light = b.data; lightW = b.w; lightH = b.h; }
    }
  }
  // 3: moving anchors come from the LEAD spell itself (A#11 ring connectors)
  const anchors = aRunner.anchorsFor(recipe.lead.skillId, leadT);
  if (arcs && arcs.length && anchors.length < 2) throw new Error(`recipe #${recipe.id}: arc mapping needs >= 2 distinct anchors, got ${anchors.length}`);
  aRunner.renderWithContributions(recipe.lead.skillId - 1, leadT, (fb) => {
    applyContribution(fb, { arcs, light, lightW, lightH }, anchors);
  });
  out.set(runners.a.out as Uint8ClampedArray);
}
