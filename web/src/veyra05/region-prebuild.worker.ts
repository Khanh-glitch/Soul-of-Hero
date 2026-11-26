// Compiles world regions ahead of need, off the game thread. The compiler is a pure function of (layout, rules), so
// the pack posted back is what the game thread would have compiled itself (window.ts, compileGeometryRegionPack).
// The newest request list replaces the previous one; one region is compiled per turn so a new list is seen quickly.
import { compileGeometryRegionPack, geometryRegionPackBuffers, type GeometryRegionPack } from './window';
import type { VeyraPlacementRules } from './window';
import { newGameRegions } from './region-warmup';
import { regionBuildOf, regionStore } from './region-store';

/** `rest`: pause after each region, as a multiple of the time that region took (0 = none). Used while a game is
 * running on a machine with few processor cores, so this thread does not crowd the game thread. */
/** `pause`: stop after the region in hand and keep the list; `pause: false` carries on from the same place. */
export type PrebuildRequest = { want: [layoutId: string, rules: VeyraPlacementRules][]; rest: number } | { warmNewGame: true } | { pause: boolean };
/** `build`: sent once when a worker that keeps regions starts, the name its kept regions go by (region-store.ts). */
export type PrebuildReply = { layoutId: string; rules: VeyraPlacementRules; pack: GeometryRegionPack | null } | { build: string };

let queue: [string, VeyraPlacementRules][] = []; let pumping = false; let listed = false; let rest = 0; let paused = false;
const post = (m: PrebuildReply, transfer: Transferable[]) => (self as unknown as { postMessage(m: PrebuildReply, t: Transferable[]): void }).postMessage(m, transfer);
/** Regions this build compiled on an earlier visit are read back instead of compiled again (region-store.ts); what
 * is compiled here is kept for the next visit. A kept pack is this compiler's own output for that region. */
const build = regionBuildOf(String((self as unknown as { location?: { href?: string } }).location?.href ?? ''));
const store = regionStore(build);
async function pump() {
  const next = paused ? undefined : queue.shift();
  if (!next) { pumping = false; return; }
  const [layoutId, rules] = next, t0 = performance.now();
  try {
    let pack = (await store.load([next]))[0];
    if (!pack) { pack = compileGeometryRegionPack(layoutId, rules); store.save(pack); }   // copied before its buffers leave
    post({ layoutId, rules, pack }, geometryRegionPackBuffers(pack));
  }
  catch { post({ layoutId, rules, pack: null }, []); }
  setTimeout(pump, Math.min(2000, (performance.now() - t0) * rest));
}
const run = (want: [string, VeyraPlacementRules][]) => { queue = want; if (!pumping && !paused) { pumping = true; setTimeout(pump, 0); } };

if (build) post({ build }, []);

self.onmessage = ({ data }: { data: PrebuildRequest }) => {
  if ('pause' in data) { paused = data.pause; if (!paused) run(queue); return; }
  if ('want' in data) { listed = true; rest = data.rest; run(data.want.slice()); return; }
  // A list from a real run always wins over this guess. A failure only means no head start: regions compile when asked.
  setTimeout(() => { if (listed) return; try { run(newGameRegions()); } catch { /* */ } }, 0);
};
