/** Bounded LRU of rendered 16x16-tile display canvases. NEVER a full-frame canvas. */
import { TILE, RENDER_CHUNK, MAX_DISPLAY_CANVASES, displayChunkKey } from './contract';
import { renderChunk } from './terrain';
import { nextTick } from './world';

const cache = new Map<string, { cv: HTMLCanvasElement; used: number }>();
let loads = 0, evictions = 0;

export function getDisplayChunk(cx: number, cy: number): HTMLCanvasElement {
  const k = displayChunkKey(cx, cy);
  const hit = cache.get(k);
  if (hit) { hit.used = nextTick(); return hit.cv; }
  const cv = renderChunk(cx, cy);
  loads++;
  cache.set(k, { cv, used: nextTick() });
  while (cache.size > MAX_DISPLAY_CANVASES) {
    let oldest: string | null = null, best = Infinity;
    for (const [kk, v] of cache) if (v.used < best) { best = v.used; oldest = kk; }
    if (!oldest) break;
    cache.delete(oldest); evictions++;
  }
  return cv;
}
export function displayStats() {
  return {
    displayCanvases: cache.size,
    displayBytes: cache.size * RENDER_CHUNK * TILE * RENDER_CHUNK * TILE * 4,
    displayLoads: loads, displayEvictions: evictions,
    maxDisplayCanvases: MAX_DISPLAY_CANVASES,
    displayChunkKeyExample: displayChunkKey(250, 175)
  };
}
export function resetDisplay() { cache.clear(); loads = 0; evictions = 0; }
