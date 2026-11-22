// Compiles world regions ahead of need, off the game thread. The compiler is a pure function of (layout, rules), so
// the pack posted back is what the game thread would have compiled itself (window.ts, compileGeometryRegionPack).
// The newest request list replaces the previous one; one region is compiled per turn so a new list is seen quickly.
import { compileGeometryRegionPack, geometryRegionPackBuffers, type GeometryRegionPack } from './window';
import type { VeyraPlacementRules } from './window';
import { newGame, startRun } from '../game/engine';
import { setActiveLayout } from '../game/world';
import { U05_WORLD_LAYOUT_ID } from './scenes';
import { regionsWanted } from './region-demand';

/** `rest`: pause after each region, as a multiple of the time that region took (0 = none). Used while a game is
 * running on a machine with few processor cores, so this thread does not crowd the game thread. */
export type PrebuildRequest = { want: [layoutId: string, rules: VeyraPlacementRules][]; rest: number } | { warmNewGame: true };
export type PrebuildReply = { layoutId: string; rules: VeyraPlacementRules; pack: GeometryRegionPack | null };

let queue: [string, VeyraPlacementRules][] = []; let pumping = false; let listed = false; let rest = 0;
const post = (m: PrebuildReply, transfer: Transferable[]) => (self as unknown as { postMessage(m: PrebuildReply, t: Transferable[]): void }).postMessage(m, transfer);
function pump() {
  const next = queue.shift();
  if (!next) { pumping = false; return; }
  const [layoutId, rules] = next, t0 = performance.now();
  try { const pack = compileGeometryRegionPack(layoutId, rules); post({ layoutId, rules, pack }, geometryRegionPackBuffers(pack)); }
  catch { post({ layoutId, rules, pack: null }, []); }
  setTimeout(pump, Math.min(2000, (performance.now() - t0) * rest));
}
const run = (want: [string, VeyraPlacementRules][]) => { queue = want; if (!pumping) { pumping = true; setTimeout(pump, 0); } };

/** The regions a new game opens with: where its residents stand. Found by opening a throwaway game here; resident
 * homes are fixed places, so most of this list is the same for every new game. Nothing leaves this thread but packs. */
function newGameRegions(): [string, VeyraPlacementRules][] {
  const gs = newGame(); setActiveLayout(U05_WORLD_LAYOUT_ID);
  startRun(gs, 'female', Date.now(), null, 1);
  const r = gs.run; if (!r) return [];
  const rules: VeyraPlacementRules = r.sourceMap?.rules === 4 ? 4 : 3;
  return regionsWanted(r).urgent.map(layoutId => [layoutId, rules]);
}
self.onmessage = ({ data }: { data: PrebuildRequest }) => {
  if ('want' in data) { listed = true; rest = data.rest; run(data.want.slice()); return; }
  // A list from a real run always wins over this guess. A failure only means no head start: regions compile when asked.
  setTimeout(() => { if (listed) return; try { run(newGameRegions()); } catch { /* */ } }, 0);
};
