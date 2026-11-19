/**
 * G1B batch 2 — card rooms, power doors and storeys. Measured on the compiled runtime window (walls, doors, stairs,
 * furniture, every storey): with a gate's door shut NO tile behind it can be walked to — not round the building, not
 * through a cellar or an upper floor or a roof — and with it open every gated chest is reachable. Chests that are not
 * gated never end up behind a gate. The way out is the door's interior handle (engine `interiorRelease`), which needs
 * no card, power or mask.
 */
import { describe, expect, it } from 'vitest';
import { G1B_GATES, G1B_SOURCE_SITES, G1B_FIXTURES } from '../src/game/g1b';
import { __openSite } from './helpers/g1b-ecology';

describe('G1B gates on the real multi-storey geometry', () => {
  for (const gate of G1B_GATES) it(`${gate.id}: no bypass by stairs, roof or cellar; every chest behind it is reachable once open`, () => {
    const [dx, dy] = gate.door; const site = __openSite(dx, dy)!; expect(site, 'the window compiles').toBeTruthy();
    expect(site.isDoor(0, dx, dy), 'the gate is a real ground-floor door of the runtime').toBe(true);
    const open = site.flood(), shut = site.flood(new Set([`0:${dx},${dy}`]));
    const mine = G1B_SOURCE_SITES.filter(s => s.gate === gate.id); expect(mine.length).toBeGreaterThan(0);
    const next = (s: { gx: number; gy: number; level?: number; ax?: number; ay?: number }, set: Set<string>) => { const lv = s.level ?? 0; if (s.ax !== undefined) return set.has(`${lv}:${s.ax},${s.ay}`); return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => set.has(`${lv}:${s.gx + a},${s.gy + b}`)); };
    for (const s of mine) { expect(next(s, open), `${s.id} reachable with the door open`).toBe(true); expect(next(s, shut), `${s.id} NOT reachable with the door shut (any storey)`).toBe(false); }
    // the sealed volume, over all storeys: everything the door alone gives access to
    const sealed = [...open].filter(k => !shut.has(k)); expect(sealed.length).toBeGreaterThan(4);
    const storeys = new Set(sealed.map(k => k.split(':')[0]));
    // the tile just inside the door is sealed; the tile just outside is not
    const [ix, iy] = gate.interior; expect(shut.has(`0:${dx + ix},${dy + iy}`)).toBe(false); expect(shut.has(`0:${dx - ix},${dy - iy}`)).toBe(true);
    // nothing that is NOT this gate's ends up behind it: other chests, card cases, generators
    const sealedSet = new Set(sealed); const other = [...G1B_SOURCE_SITES.filter(s => s.gate !== gate.id), ...G1B_FIXTURES.map(f => ({ ...f, level: 0 }))].filter(s => site.inb(s.gx, s.gy));
    for (const s of other) { const lv = (s as any).level ?? 0; const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => `${lv}:${s.gx + a},${s.gy + b}`).filter(k => open.has(k)); if (!around.length) continue;
      // a second gate of the same site may legitimately nest (archive): only un-gated objects are asserted free
      if (!(s as any).gate) expect(around.some(k => !sealedSet.has(k)), `${s.id} is not trapped behind ${gate.id}`).toBe(true); }
    // every stair inside the sealed volume lands inside the sealed volume (a stair can never carry the player past the door)
    for (const st of site.stairs) { const a = `${st.from}:${st.x},${st.y}`, b = `${st.to}:${st.tx},${st.ty}`; if (sealedSet.has(a) || sealedSet.has(b)) { expect(shut.has(a), `stair ${a} ↔ ${b}`).toBe(false); expect(shut.has(b), `stair ${a} ↔ ${b}`).toBe(false); } }
    console.log(`[g1b-gate] ${gate.id}: sealed ${sealed.length} tiles on storey(s) ${[...storeys].sort().join(',')}; ${mine.length} chest(s) behind it`);
  }, 240000);
});
