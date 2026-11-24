import { open } from './launch.mjs';
export async function start(region) {
  const o = await open(); const { p } = o;
  await p.getByText('New run').first().click(); await p.waitForTimeout(600);
  await p.getByText('VEYRA · Unified World').first().click().catch(() => {});
  if (region) await p.locator('select').first().selectOption(region).catch(e => console.log('region', String(e).slice(0, 80)));
  await p.getByText('Begin the 14 days').click();
  await p.waitForFunction(() => window.__soh?.run, null, { timeout: 60000 }); await p.waitForTimeout(2500);
  await p.evaluate(async () => {
    const W = await import('/src/game/world.ts'), E = await import('/src/game/engine.ts'), VW = await import('/src/veyra05/window.ts'), CO = await import('/src/veyra05/continuity.ts'), CAT = await import('/src/game/catalog.ts');
    const WW = 200, TILE = 16; const g = () => window.__soh.run;
    window.G = {
      W, E, VW, CO, CAT,
      info() { const r = g(); const w = W.getWorld(); const c = {}; for (const k of w.sourceV3) if (k && k.startsWith('road_')) c[k] = (c[k] || 0) + 1; return { layout: r.layoutId, rules: r.sourceMap.rules, seed: r.seed, origin: CO.windowOrigin(r), tile: [Math.floor(r.player.x / TILE), Math.floor(r.player.y / TILE)], counts: c, inv: r.custody.inv.slots.map(s => s && s.key), active: r.player.active }; },
      find(key, poi, open = true) { const r = g(), w = W.getWorld(), ww = VW.getWindowWorld(r.layoutId); const px = r.player.x / TILE, py = r.player.y / TILE; const out = [];
        for (let i = 0; i < w.sourceV3.length; i++) { if (w.sourceV3[i] !== key) continue; const inPoi = ww.poiAt[i] >= 0 && ww.floors.ground.protectedCells[i]; if (poi !== undefined && !!inPoi !== poi) continue; const st = r.sources[i]; if (st && (st.stock < CAT.SOURCES[key].stock || st.hp < CAT.SOURCES[key].hp)) continue; const tx = i % WW, ty = Math.floor(i / WW); if (tx < 30 || ty < 30 || tx > 170 || ty > 170) continue; let clear = true; for (let dy = 0; dy <= 2 && clear; dy++) for (let dx = -2; dx <= 2; dx++) { if (!dx && !dy) continue; const q = w.sourceV3[(ty + dy) * WW + tx + dx]; if (q && (CAT.SOURCES[q].tall || (dy === 0 && Math.abs(dx) === 1))) { clear = false; break; } } const grid = E.blockGrid(r); if (grid[ty * WW + tx - 1] !== 0 && grid[ty * WW + tx + 1] !== 0) clear = false; if (open && !clear) continue; out.push({ tx, ty, d: Math.abs(tx - px) + Math.abs(ty - py), poi: inPoi ? ww.poiAt[i] : -1 }); }
        return out.sort((a, b) => a.d - b.d); },
      stand(tx, ty, pref) { const r = g(), grid = E.blockGrid(r); for (const [dx, dy] of (pref || [[-1, 0], [1, 0], [0, 1], [0, -1]])) { const i = (ty + dy) * WW + tx + dx; if (grid[i] === 0) { r.player.x = (tx + dx) * TILE + 8; r.player.y = (ty + dy) * TILE + 8; r.player.vx = 0; r.player.vy = 0; return [dx, dy]; } } return null; },
      src(tx, ty) { const r = g(); const s = E.sourceAt(r, tx, ty, Date.now()); return s ? { key: s.key, stock: s.stock, hp: s.hp } : null; },
      screen(tx, ty) { const v = window.__sohView(); return { x: v.off.x + (tx * TILE + 8 - v.cam.x) * v.scale, y: v.off.y + (ty * TILE + 8 - v.cam.y) * v.scale, v }; },
      drops() { const r = g(); return Object.values(r.entities).filter(e => e.kind === 'drop').length; },
    };
  });
  return o;
}
