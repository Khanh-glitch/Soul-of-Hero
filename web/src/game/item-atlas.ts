/**
 * The approved 157-item pixel icon atlas (Arena2 pack, imported unmodified at 7f126d63).
 * `public/assets/atlas/soh_items_157_atlas.json` is the authority for item id -> 32×32 cell. The atlas is decoded once,
 * before the UI mounts, and every cell is cut out untouched (no scaling, no filtering) so `<img>` users stay synchronous.
 * Catalog ids that are not part of the 157-item master have no approved art; they are listed in
 * `ITEMS_WITHOUT_APPROVED_ICON` and keep the drawn icon, visibly tagged `data-icon="drawn"` in the UI.
 */
// Same bytes as public/assets/atlas/soh_items_157_atlas.json (tests/item-atlas-157.test.ts keeps them identical); a bundler may not import from public/.
import atlas from './item-atlas-157.json';
import { ITEMS } from './catalog';

export const ITEM_ATLAS = atlas as { image: string; width: number; height: number; tileSize: number; itemCount: number; frames: Record<string, { x: number; y: number; w: number; h: number }> };
export const hasApprovedIcon = (key: string): boolean => Object.prototype.hasOwnProperty.call(ITEM_ATLAS.frames, key);
export const ITEMS_WITHOUT_APPROVED_ICON: readonly string[] = Object.keys(ITEMS).filter(k => !hasApprovedIcon(k)).sort();

const urls: Record<string, string> = {};
let state: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
export const itemAtlasState = () => state;
/** Data URL of the untouched 32×32 cell, or '' while the atlas is not decoded / for an id outside the 157. */
export const atlasIconUrl = (key: string): string => urls[key] || '';

export function loadItemAtlas(timeoutMs = 6000): Promise<boolean> {
  if (state === 'ready') return Promise.resolve(true);
  if (typeof Image === 'undefined' || typeof document === 'undefined') { state = 'failed'; return Promise.resolve(false); }
  state = 'loading';
  return new Promise<boolean>(resolve => {
    const done = (ok: boolean) => { if (state !== 'loading') return; state = ok ? 'ready' : 'failed'; if (!ok) console.warn('[soh] 157-item atlas unavailable: drawn icons are shown'); resolve(ok); };
    const img = new Image();
    img.onload = () => {
      try {
        if (img.naturalWidth !== ITEM_ATLAS.width || img.naturalHeight !== ITEM_ATLAS.height) return done(false);
        for (const [key, f] of Object.entries(ITEM_ATLAS.frames)) {
          const c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
          const g = c.getContext('2d')!; g.imageSmoothingEnabled = false; g.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
          urls[key] = c.toDataURL('image/png');
        }
        done(true);
      } catch { done(false); }
    };
    img.onerror = () => done(false);
    setTimeout(() => done(false), timeoutMs);
    img.src = `${import.meta.env.BASE_URL}${ITEM_ATLAS.image.replace(/^\//, '')}`;
  });
}
