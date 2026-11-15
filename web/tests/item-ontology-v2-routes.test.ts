// Item Ontology V2 — gameplay routes for the items the audit touches, driven through real engine intents.
// Labels (same vocabulary as mec01-r2-c1):
//   INTENT  = a real dispatch() the UI would send (build, craft, research, recycleItem, move), with real station time.
//   FIXTURE = raw stock granted with addItem and the actor placed beside the station. Natural gathering is NOT claimed.
// This is engine evidence. It is not browser or human-play evidence.
import { afterEach, describe, expect, it } from 'vitest';
import { BAL, type Entity, type GameState, type RunState, TILE } from '../src/game/core';
import { RECIPES } from '../src/game/catalog';
import { C, addItem, buildReason, countItem, dispatch, markDirty, newGame, stepStations } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';

const START = Date.UTC(2026, 10, 14); let n = 0;
afterEach(() => setActiveLayout('shipping'));
const act = (g: GameState, type: string, p: object = {}, at = START) => dispatch(g, { id: 'v2r-' + (++n), type, ...p } as never, at);
const place = (r: RunState, tx: number, ty: number) => { r.player.x = tx * TILE + 8; r.player.y = ty * TILE + 8; markDirty(); };
function start() {
  setActiveLayout('shipping_fresh'); const g = newGame();
  expect(act(g, 'startRun', { character: 'female', seed: 303 }).ok).toBe(true); g.run!.creatures = []; markDirty(); return g;
}
function legalTileNear(g: GameState, cx: number, cy: number, struct: string): [number, number] {
  const r = g.run!;
  for (let k = 1; k <= 12; k++) for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== k) continue;
    const tx = cx + dx, ty = cy + dy; place(r, tx - 1, ty); if (!buildReason(g, struct, tx, ty)) return [tx, ty];
  }
  throw new Error('no legal tile for ' + struct);
}
function build(g: GameState, struct: string, at: number): Entity {
  const r = g.run!; const cx = Math.floor(r.player.x / TILE), cy = Math.floor(r.player.y / TILE);
  // PA1 device custody: a station is placed by spending a packed device, hand-crafted from its material list.
  const pack = act(g, 'craft', { recipe: 'deploy_' + struct }, at - 1); expect(pack.ok, 'pack ' + struct + ': ' + (pack as { reason?: string }).reason).toBe(true);
  const [tx, ty] = legalTileNear(g, cx, cy, struct);
  const res = act(g, 'build', { struct, tx, ty }, at); expect(res.ok, struct + ': ' + (res as { reason?: string }).reason).toBe(true);
  return Object.values(r.entities).filter((e) => e.kind === 'struct' && e.type === struct).pop()!;
}
/** Start a craft, prove nothing appears early, finish it, move the output to the pack. */
function craftOut(g: GameState, st: Entity, recipe: string, at: number) {
  const r = g.run!; const rc = RECIPES[recipe]; place(r, st.tx! - 1, st.ty!);
  const pre = act(g, 'craft', { eid: st.id, recipe }, at); expect(pre.ok, recipe + ': ' + (pre as { reason?: string }).reason).toBe(true);
  const out = st.station!.outC!; const ms = rc.secs * 1000;
  stepStations(g, ms + 500, at + ms + 500);
  const i = r.custody[out].slots.findIndex((s) => s?.key === rc.out); expect(i, recipe + ' output').toBeGreaterThanOrEqual(0);
  expect(act(g, 'move', { from: out, fs: i, to: 'inv' }, at + ms + 600).ok).toBe(true);
  return at + ms + 1000;
}
function recycle(g: GameState, key: string, at: number) {
  const r = g.run!; const rc = Object.values(r.entities).find((e) => e.kind === 'recycler')!; expect(rc).toBeDefined();
  place(r, rc.tx!, rc.ty!);
  const slot = C(r, 'inv').slots.findIndex((s) => s?.key === key && s.qty === 1); expect(slot, key + ' single in pack').toBeGreaterThanOrEqual(0);
  const res = act(g, 'recycleItem', { eid: rc.id, slot, uid: C(r, 'inv').slots[slot]!.uid }, at);
  if (!res.ok) return { ok: false as const, reason: (res as { reason?: string }).reason ?? '', out: rc.station!.outC! };
  stepStations(g, 120_000, at + 120_000);
  return { ok: true as const, reason: '', out: rc.station!.outC! };
}

describe('Item Ontology V2 routes (INTENT on FIXTURE stock) — item set v3 ids', () => {
  it('R1 Machine Parts / Scrap / Damaged Drive cannot be held or crafted any more; research is paid ONLY in Parts (`spares`)', () => {
    const g = start(); const r = g.run!;
    addItem(r, 'inv', 'wood', 60); addItem(r, 'inv', 'stone', 10); addItem(r, 'inv', 'iron_ingot', 4);
    const spares0 = countItem(r, 'inv', 'spares');
    const bench = build(g, 'workbench', START + 10); place(r, bench.tx! - 1, bench.ty!);
    expect(RECIPES.mechanical_parts).toBeUndefined();
    const dead = act(g, 'craft', { eid: bench.id, recipe: 'mechanical_parts' }, START + 100);
    expect(dead.ok, 'a retired recipe starts no work').toBe(false);
    expect(countItem(r, 'inv', 'spares')).toBe(spares0);            // the refusal debits nothing
    // every mint point issues the successor: Scrap 1:1, Machine Parts and a Damaged Drive 1:2
    addItem(r, 'inv', 'scrap', 3); addItem(r, 'inv', 'mechanical_parts', 1); addItem(r, 'inv', 'damaged_drive', 1);
    for (const k of ['scrap', 'mechanical_parts', 'damaged_drive']) expect(countItem(r, 'inv', k), k).toBe(0);
    expect(countItem(r, 'inv', 'spares')).toBe(spares0 + 3 + 2 + 2);
    // spend down to less than a research roll and prove the refusal names Parts
    const inv = C(r, 'inv'); let keep = BAL.research.randomSparesCost - 1;
    for (let k = 0; k < inv.slots.length; k++) { const s = inv.slots[k]; if (s?.key !== 'spares') continue; if (keep > 0) { s.qty = Math.min(s.qty, keep); keep -= s.qty; } else inv.slots[k] = null; }
    markDirty();                                                     // FIXTURE: stock trimmed
    addItem(r, 'inv', 'spares', 6);                                  // exactly a Research Table's Parts (see below)
    const table = build(g, 'research', START + 2000); place(r, table.tx! - 1, table.ty!);
    const left = countItem(r, 'inv', 'spares');
    expect(left).toBeLessThan(BAL.research.randomSparesCost);
    const refused = act(g, 'research', { eid: table.id, mode: 'random' }, START + 2010);
    expect(refused.ok).toBe(false);
    expect((refused as { reason?: string }).reason ?? '').toBe(`Needs ${BAL.research.randomSparesCost} Parts.`);
    expect(countItem(r, 'inv', 'spares')).toBe(left);
  });

  it('R2 ore → Iron Ingot at a fuelled Furnace → Mechanical Gear at the Workbench, paid in ingots and Parts', () => {
    const g = start(); const r = g.run!;
    addItem(r, 'inv', 'wood', 60); addItem(r, 'inv', 'stone', 40); addItem(r, 'inv', 'iron_ore', 2);
    const f = build(g, 'furnace', START + 10); place(r, f.tx! - 1, f.ty!);
    const dry = act(g, 'craft', { eid: f.id, recipe: 'iron_ingot' }, START + 20);
    const wi = C(r, 'inv').slots.findIndex((s) => s?.key === 'wood');
    expect(act(g, 'move', { from: 'inv', fs: wi, to: f.station!.fuelC, qty: 2 }, START + 30).ok).toBe(true);
    if (!dry.ok) expect(act(g, 'craft', { eid: f.id, recipe: 'iron_ingot' }, START + 40).ok).toBe(true);
    expect(act(g, 'craft', { eid: f.id, recipe: 'iron_ingot' }, START + 50).ok).toBe(true);
    stepStations(g, 40_000, START + 40_050);
    expect(countItem(r, f.station!.outC, 'iron_ingot')).toBe(2);
    for (let k = 0; k < 2; k++) {
      const i = r.custody[f.station!.outC].slots.findIndex((s) => s?.key === 'iron_ingot');
      if (i >= 0) expect(act(g, 'move', { from: f.station!.outC, fs: i, to: 'inv' }, START + 41_000 + k).ok).toBe(true);
    }
    expect(countItem(r, 'inv', 'iron_ingot')).toBe(2);
    expect(RECIPES.mechanical_gear.ins).toEqual([['iron_ingot', 2], ['spares', 3]]);
    const bench = build(g, 'workbench', START + 42_000); place(r, bench.tx! - 1, bench.ty!);
    // FIXTURE: bench level and Parts for the gear (Parts are salvage, never crafted)
    const parts0 = countItem(r, 'inv', 'spares'); addItem(r, 'inv', 'spares', 3);
    addItem(r, 'inv', 'iron_ingot', 2); addItem(r, 'inv', 'spares', 4);        // FIXTURE: the bench upgrade's own bill (iron 2 + Parts 4)
    expect(act(g, 'upgradeStation', { eid: bench.id }, START + 42_500).ok).toBe(true);
    craftOut(g, bench, 'mechanical_gear', START + 43_000);
    expect(countItem(r, 'inv', 'mechanical_gear')).toBe(1);
    expect(countItem(r, 'inv', 'iron_ingot')).toBe(0); expect(countItem(r, 'inv', 'spares')).toBe(parts0);
    // the retired Fasteners recipe is gone for good: knowing its id does not bring it back
    expect(RECIPES.fasteners).toBeUndefined();
    r.knowledge.recipes.push('fasteners'); markDirty();
    expect(act(g, 'craft', { eid: bench.id, recipe: 'fasteners' }, START + 90_000).ok).toBe(false);
  });

  it('R3 Pipe, Gear, Blade and Iron Plate recycle to their live versioned returns (never more than they cost); a non-component is refused, not eaten', () => {
    const g = start(); const r = g.run!;
    let t = START + 100;
    const expectOut = (key: string, want: Record<string, number>) => {
      addItem(r, 'inv', key, 1);
      const rec = recycle(g, key, t); expect(rec.ok, key + ': ' + rec.reason).toBe(true);
      for (const [k, q] of Object.entries(want)) expect(countItem(r, rec.out, k), key + ' → ' + k).toBe(q);
      const out = r.custody[rec.out]; for (let i = 0; i < out.slots.length; i++) out.slots[i] = null; markDirty();
      t += 200_000;
    };
    expectOut('metal_pipe', { refined_iron_ingot: 1, spares: 0 });
    expectOut('mechanical_gear', { spares: 2, iron_ingot: 1 });          // gear-v2: cost 3 Parts + 2 ingots
    expectOut('metal_blade', { iron_ingot: 2, spares: 0 });              // blade-v2: cost 1 Parts + 4 ingots
    expectOut('iron_plate', { iron_ingot: 1, refined_iron_ingot: 0, spares: 0 });
    addItem(r, 'inv', 'cloth', 1);
    const no = recycle(g, 'cloth', t);
    expect(no.ok).toBe(false);
    expect(no.reason).toMatch(/not an eligible Recycler input/);
    expect(countItem(r, 'inv', 'cloth')).toBeGreaterThanOrEqual(1);       // refused, not eaten
  });
});
