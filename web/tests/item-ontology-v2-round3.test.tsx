// Item Ontology V2 — ROUND 3 ("close the real gaps") acceptance on PR #61.
//
// Evidence vocabulary, as in round 2 (never mixed):
//   INTENT   = a real dispatch() the UI sends, real station time through stepStations, real persist.validate.
//   FIXTURE  = atoms granted with addItem, the actor placed beside a station, a frozen recipe put back in the table
//              for the single moment an "old save" is authored, a test oil source registered in memory.
//   ANALYTIC = table arithmetic / static reads.
// Nothing here is a natural-play PASS.
import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Entity, type GameState, type RunState, TILE } from '../src/game/core';
import { ITEMS, RECIPES, STRUCTS, CREATURES, type RecipeDef } from '../src/game/catalog';
import { C, OIL_TEXT, addItem, buildReason, countItem, dispatch, markDirty, newGame, oilAvailability, registerTestOilSource, stepStations } from '../src/game/engine';
import { LEGACY_RECIPES, RECIPE_REVISION, recipeAtRevision } from '../src/game/recipe-migration';
import { serializeSnapshot, validate } from '../src/game/persist';
import { getWorld, setActiveLayout } from '../src/game/world';
import { CREATOR_LOOT_V1, creatorLootV1 } from '../src/game/creator-loot';
import { ITEM_CLASS_LABEL, ITEM_CLASS_VI, VEYRA_UNSOURCED_INPUTS, coreClassLine, itemClass, itemClassLabel } from '../src/game/item-class';
import { craftReadiness, structurePreparation } from '../src/game/action-readiness';
import { PROPOSALS, decisionFor } from '../src/game/item-ontology-decisions';
import { ITEM_RETIREMENT, liveItemPer } from '../src/game/final-item-set';
import { ItemInfo } from '../src/ui/panels';

const START = Date.UTC(2026, 10, 14, 9); let n = 0;
type Table = Record<string, RecipeDef>;
const LIVE = { vehicle_frame: RECIPES.vehicle_frame, industrial_axe: RECIPES.industrial_axe };
afterEach(() => {
  setActiveLayout('shipping');
  (RECIPES as Table).vehicle_frame = LIVE.vehicle_frame; (RECIPES as Table).industrial_axe = LIVE.industrial_axe;
});
const act = (g: GameState, type: string, p: object = {}, at = START) => dispatch(g, { id: 'v2r3-' + (++n), type, ...p } as never, at);
const why = (res: unknown) => (res as { reason?: string }).reason ?? '';
const place = (r: RunState, tx: number, ty: number) => { r.player.x = tx * TILE + 8; r.player.y = ty * TILE + 8; markDirty(); };
const raw = (g: GameState) => JSON.parse(JSON.parse(serializeSnapshot(g)).payload);
function start(seed = 303) {
  setActiveLayout('shipping_fresh'); const g = newGame();
  expect(act(g, 'startRun', { character: 'female', seed }).ok).toBe(true); g.run!.creatures = []; markDirty(); return g;
}
function build(g: GameState, struct: string, at: number): Entity {
  const r = g.run!; const cx = Math.floor(r.player.x / TILE), cy = Math.floor(r.player.y / TILE);
  const pack = act(g, 'craft', { recipe: 'deploy_' + struct }, at - 1); expect(pack.ok, 'pack ' + struct + ': ' + why(pack)).toBe(true);
  for (let k = 1; k <= 14; k++) for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== k) continue;
    const tx = cx + dx, ty = cy + dy; place(r, tx - 1, ty);
    if (!buildReason(g, struct, tx, ty)) {
      const res = act(g, 'build', { struct, tx, ty }, at); expect(res.ok, struct + ': ' + why(res)).toBe(true);
      return Object.values(r.entities).filter((e) => e.kind === 'struct' && e.type === struct).pop()!;
    }
  }
  throw new Error('no legal tile for ' + struct);
}
const recyclerOf = (r: RunState) => Object.values(r.entities).find((e) => e.kind === 'recycler')!;
// Node has no DOM. Icons draw to a canvas; a no-op canvas is enough to render markup.
const noopCtx: any = new Proxy({}, { get: (t: any, k) => (k in t ? t[k] : (k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => noopCtx)), set: () => true });
(globalThis as any).document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => noopCtx, toDataURL: () => 'data:image/png;base64,' }) };

const CREATOR = ['core_blast', 'core_meteor', 'core_dragon', 'core_elsa', 'core_earthmother', 'core_mjolnir', 'core_demon'];
const FIELD = ['core_fire', 'core_earth', 'core_storm', 'core_frost'];

describe('P2 — round-3 ruling (Fasteners stay) is SUPERSEDED by item set v3: both retire into Parts', () => {
  it('the round-3 record is kept as history; the live game follows the owner roster: one Parts item, no formula for either', () => {
    const p2 = PROPOSALS.find((x) => x.id === 'P2')!;
    expect(p2.status).toBe('CLOSED_KEEP'); expect(p2.ruling).toMatch(/joining stock/);       // the historical ruling, not edited
    // item rows stay parseable for old saves
    expect(ITEMS.fasteners.name).toBe('Forged Fasteners'); expect(ITEMS.mechanical_parts.name).toBe('Machine Parts');
    // ...but the later owner decision (final three-group item set) retires both: 1 Fastener -> 1 Parts, 1 Machine Parts -> 2 Parts
    expect(ITEM_RETIREMENT.fasteners).toMatchObject({ stage: 'LIVE', to: 'spares' }); expect(liveItemPer('fasteners')).toBe(1);
    expect(ITEM_RETIREMENT.mechanical_parts).toMatchObject({ stage: 'LIVE', to: 'spares' }); expect(liveItemPer('mechanical_parts')).toBe(2);
    expect(RECIPES.fasteners).toBeUndefined(); expect(RECIPES.mechanical_parts).toBeUndefined();
    const g = start(); const r = g.run!; expect(r.knowledge.recipes).not.toContain('fasteners');
    const before = countItem(r, 'inv', 'spares'); expect(addItem(r, 'inv', 'fasteners', 3)).toBe(0);
    expect(countItem(r, 'inv', 'fasteners')).toBe(0); expect(countItem(r, 'inv', 'spares')).toBe(before + 3);   // every mint point issues Parts
  });
});

describe('P10 — Field Core / Lõi dã chiến is a class of its own beside the seven Creator Cores', () => {
  it('ANALYTIC: every core item is in exactly one of the two classes, read from the fields the engine branches on', () => {
    const cores = Object.keys(ITEMS).filter((k) => ITEMS[k].cat === 'core').sort();
    expect(cores).toEqual([...CREATOR, ...FIELD].sort());
    for (const k of CREATOR) { expect(itemClass(k), k).toBe('CREATOR_CORE'); expect(ITEMS[k].creatorCore, k).toBeTruthy(); expect(ITEMS[k].core, k).toBeUndefined(); }
    for (const k of FIELD) { expect(itemClass(k), k).toBe('FIELD_CORE'); expect(ITEMS[k].core, k).toBeTruthy(); expect(ITEMS[k].creatorCore, k).toBeUndefined(); }
    expect(ITEM_CLASS_LABEL.CREATOR_CORE).toBe('CREATOR CORE'); expect(ITEM_CLASS_LABEL.FIELD_CORE).toBe('FIELD CORE');
    expect(ITEM_CLASS_VI.FIELD_CORE).toBe('Lõi dã chiến');
    expect(coreClassLine('core_dragon')).toMatch(/3 skills/); expect(coreClassLine('core_storm')).toBe('1 ability · 4 charges · no reload');
    expect(coreClassLine('iron_ingot')).toBeNull();
  });
  it('ANALYTIC: ids, names, formulas, charge counts and effect keys of the four Field Cores are exactly what they were', () => {
    expect(FIELD.map((k) => [k, ITEMS[k].name, ITEMS[k].core, ITEMS[k].charge])).toEqual([
      ['core_fire', 'Ember Core', 'fire', 3], ['core_earth', 'Quake Core', 'earth', 3], ['core_storm', 'Storm Core', 'storm', 4], ['core_frost', 'Rime Core', 'frost', 3]]);
    expect(RECIPES.core_storm).toMatchObject({ ins: [['glass', 2], ['spares', 10], ['crystal', 1]], station: 'workbench', secs: 40, tier: 3 });
    expect(RECIPES.core_frost).toMatchObject({ ins: [['crystal', 3], ['spares', 8]], station: 'workbench', secs: 40, tier: 3 });
    for (const k of FIELD) expect(RECIPES[k]?.out, k).toBe(k);
  });
  it('UI: the item details tell the two classes apart (chip, Vietnamese class name, one rule line)', () => {
    const g = start(); const r = g.run!;
    for (const k of ['core_fire', 'core_dragon']) expect(addItem(r, 'inv', k, 1)).toBe(0);
    const stack = (k: string) => C(r, 'inv').slots.find((s) => s?.key === k)!;
    const field = renderToStaticMarkup(<ItemInfo s={stack('core_fire')} known={r.knowledge.recipes} />);
    const creator = renderToStaticMarkup(<ItemInfo s={stack('core_dragon')} known={r.knowledge.recipes} />);
    expect(field).toContain('data-class="FIELD_CORE"'); expect(field).toContain('FIELD CORE'); expect(field).toContain('Lõi dã chiến');
    expect(field).toContain('1 ability · 3 charges · no reload'); expect(field).toContain('iteminfo--field');
    expect(field).not.toContain('CREATOR CORE');
    expect(creator).toContain('data-class="CREATOR_CORE"'); expect(creator).toContain('CREATOR CORE'); expect(creator).toContain('3 skills');
    expect(creator).not.toContain('FIELD CORE'); expect(creator).not.toContain('Lõi dã chiến'); expect(creator).not.toContain('iteminfo--field');
    // P7 alias still shown for the Creator Core, description shown for both
    expect(creator).toContain(ITEMS.core_dragon.vi!); expect(creator).toContain('data-testid="iteminfo-desc"'); expect(field).toContain(ITEMS.core_fire.desc);
    expect(itemClassLabel('core_fire', 'x')).toBe('FIELD CORE');
  });
  it('REGRESSION: the three Creator Core crates that are located by a Field Core still resolve, with the Field Core still inside', () => {
    setActiveLayout('shipping'); const w = getWorld();
    const expected: Record<string, [string, string]> = { core_fire: ['factory_vault', 'core_dragon'], core_storm: ['light_top', 'core_meteor'], core_frost: ['wreck', 'core_elsa'] };
    expect(CREATOR_LOOT_V1.filter((c) => FIELD.includes(c.marker)).map((c) => c.marker).sort()).toEqual(Object.keys(expected).sort());
    for (const [marker, [poi, core]] of Object.entries(expected)) {
      const crates = w.statics.filter((s) => s.kind === 'loot' && s.poi === poi && s.loot?.some(([k]) => k === marker));
      expect(crates, `${poi} crate holding ${marker}`).toHaveLength(1);
      expect(creatorLootV1(crates[0]), `${poi}/${marker}`).toBe(core);            // the Creator Core is still found
      expect(crates[0].loot!.find(([k]) => k === marker)![1]).toBe(1);              // and the Field Core is still loot
      expect(itemClass(marker)).toBe('FIELD_CORE'); expect(itemClass(core)).toBe('CREATOR_CORE');
    }
    // the two non-core markers are untouched
    expect(CREATOR_LOOT_V1.map((c) => c.id)).toEqual(['factory_vault/core_fire', 'light_top/core_storm', 'factory_vault/blueprint:gas_mask', 'watch/keycard', 'wreck/core_frost']);
  });
  it('INTENT: a part-spent Field Core and a loaded Creator Core survive save → restart with their own state', () => {
    const g = start(); const r = g.run!;
    for (const k of ['core_frost', 'core_blast']) expect(addItem(r, 'inv', k, 1)).toBe(0);
    const f = C(r, 'inv').slots.find((s) => s?.key === 'core_frost')!; const c = C(r, 'inv').slots.find((s) => s?.key === 'core_blast')!;
    expect(f.charge).toBe(3); expect(f.reserves).toBeUndefined(); expect(c.reserves).toBeDefined(); expect(c.charge).toBeUndefined();
    f.charge = 1; markDirty();
    const back = validate(raw(g))!; expect(back).not.toBeNull();
    const bf = C(back.run!, 'inv').slots.find((s) => s?.uid === f.uid)!; const bc = C(back.run!, 'inv').slots.find((s) => s?.uid === c.uid)!;
    expect([bf.key, bf.charge, bf.reserves]).toEqual(['core_frost', 1, undefined]);
    expect(bc.key).toBe('core_blast'); expect(bc.reserves).toEqual(c.reserves);
  });
});

describe('P9 — oil text tells the truth: Shipping has no crude seep; Veyra seeps are the item-set-v3 source', () => {
  it('a fresh run has no oil site; every surface says so and nothing claims a site can be found', () => {
    const g = start(); const r = g.run!;
    expect(oilAvailability(r)).toBe('NO_SITE_IN_WORLD');
    expect(buildReason(g, 'oil_pump', Math.floor(r.player.x / TILE) + 1, Math.floor(r.player.y / TILE))).toBe(OIL_TEXT.noSiteWorld);
    expect(structurePreparation(r, 'oil_pump').next).toBe(OIL_TEXT.noSiteWorldShort);
    const pump = craftReadiness(r, 'pump_crude', START); expect([pump.short, pump.next, pump.canSubmit]).toEqual(['No oil site', OIL_TEXT.noSiteWorldShort, false]);
    const ref = craftReadiness(r, 'refinery_fuel', START); expect(ref.canSubmit).toBe(false);
    // no surface still sends the player to a retired item
    for (const text of [OIL_TEXT.noSiteWorld, OIL_TEXT.noSiteWorldShort, ITEMS.crude_petroleum.desc, STRUCTS.oil_pump.desc, ref.next ?? '']) expect(text).not.toMatch(/Salvaged Oil|Lubricant/);
    expect(STRUCTS.oil_pump.desc).toMatch(/crude seep/); expect(STRUCTS.oil_pump.desc).not.toMatch(/No oil site exists/);   // true on Veyra, where seeps exist
    expect(RECIPES.refinery_crude).toBeUndefined();                              // folded into refinery_fuel at rev 5
    expect(r.knowledge.recipes).toEqual(expect.arrayContaining(['pump_crude']));
  });
  it('no player-facing source file still promises an "authorized" oil site or source', () => {
    const roots = ['../src/ui', '../src/game'].map((d) => resolve(__dirname, d));
    const hits: string[] = [];
    for (const dir of roots) for (const f of readdirSync(dir)) {
      if (!/\.(ts|tsx)$/.test(f) || f.startsWith('item-ontology') || f.startsWith('economic-')) continue;
      readFileSync(resolve(dir, f), 'utf8').split('\n').forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
        if (/['"`>][^'"`<]*authorized oil (site|source)/i.test(code) || /Find an authorized/i.test(code)) hits.push(`${f}:${i + 1}`);
      });
    }
    expect(hits).toEqual([]);
  });
  it('FIXTURE: with a registered test site the wording follows the real state (elsewhere / here / dry); ids and systems unchanged', () => {
    const g = start(); const r = g.run!; const tx = Math.floor(r.player.x / TILE) + 2, ty = Math.floor(r.player.y / TILE);
    registerTestOilSource(r, tx, ty, 2);
    expect(oilAvailability(r)).toBe('SITE_ELSEWHERE'); expect(oilAvailability(r, tx, ty)).toBe('SITE_HERE'); expect(oilAvailability(r, tx + 5, ty)).toBe('SITE_ELSEWHERE');
    expect(buildReason(g, 'oil_pump', tx + 5, ty)).toBe(OIL_TEXT.notOnSite);
    r.oilSources![`oil:${tx}:${ty}`].stock = 0;
    expect(oilAvailability(r, tx, ty)).toBe('SITE_DRY'); expect(buildReason(g, 'oil_pump', tx, ty)).toBe(OIL_TEXT.dry);
    expect(RECIPES.pump_crude).toMatchObject({ out: 'crude_petroleum', qty: 1, ins: [], station: 'oil_pump' });
  });
  it('item set v3: Crude Petroleum → Fuel Canister is the one refinery route; Salvaged Oil is retired into crude', () => {
    expect(RECIPES.refinery_fuel.station).toBe('refinery'); expect(RECIPES.refinery_fuel.out).toBe('fuel_can');
    expect(RECIPES.refinery_fuel.ins).toEqual([['crude_petroleum', 3], ['glass', 1]]);
    expect(ITEM_RETIREMENT.salvaged_oil).toMatchObject({ stage: 'LIVE', to: 'crude_petroleum' });
    expect(PROPOSALS.find((x) => x.id === 'P9')!.status).toBe('IMPLEMENTED_PARTIAL');   // the round-3 record (text only) is history
  });
});

describe('P8 — nothing invented; the recipe line is honest on Veyra', () => {
  it('ANALYTIC: no source, drop or probability moved for the four repair-order items', () => {
    expect(CREATURES.wolf.drops).toEqual([['meat', 1, 1], ['fur', 2, 1], ['wolf_fang', 1, 0.4]]);
    // ARENA 1 (final item set) added ONE row here afterwards: the crawler is the LI source of Electronic Parts. The three
    // round-3 rows are unchanged, in order.
    expect(CREATURES.crawler.drops.filter(([k]) => k !== 'electronic_parts')).toEqual([['spares', 3, 1], ['crawler_optic', 1, 0.35]]);   // item set v3: the Scrap row merged into Parts (2 + 2 -> 3, SOH_PROVISIONAL)
    expect(CREATURES.crawler.drops.filter(([k]) => k === 'electronic_parts')).toEqual([['electronic_parts', 1, 0.5]]);
    expect(CREATURES.beetle.drops).toEqual([['chitin', 2, 1], ['sulfur', 1, 0.6], ['beetle_horn', 1, 0.3]]);
    const droppers = (item: string) => Object.entries(CREATURES).filter(([, d]) => d.drops.some(([k]) => k === item)).map(([k]) => k).sort();
    expect(droppers('chitin')).toEqual(['beetle']); expect(droppers('beetle_horn')).toEqual(['beetle']);
    expect(droppers('crawler_optic')).toEqual(['crawler']); expect(droppers('wolf_fang')).toEqual(['wolf']);
    expect(VEYRA_UNSOURCED_INPUTS).toEqual(['chitin', 'crawler_optic']);
  });
  it('readiness wording: on Veyra the missing input is named as unsourced; on Shipping it is an ordinary shortage', () => {
    const g = start(); const r = g.run!; r.knowledge.recipes.push('chitin_armor'); markDirty();     // FIXTURE: recipe taught
    expect(addItem(r, 'inv', 'leather', 2)).toBe(0);
    const ship = craftReadiness(r, 'chitin_armor', START); expect(ship.short).toBe('Needs materials'); expect(ship.next).not.toMatch(/Veyra/);
    const layout = r.layoutId; r.layoutId = 'veyra05-westmouth';                                         // FIXTURE: same run read as a Veyra run
    const vey = craftReadiness(r, 'chitin_armor', START);
    expect([vey.short, vey.next, vey.canSubmit]).toEqual(['No source here', 'Ash Chitin has no source on Veyra yet', false]);
    expect(craftReadiness(r, 'essence_spirit', START).next).toBe('Crawler Optic (specimen) has no source on Veyra yet');
    r.layoutId = layout;
  });
});

describe('migration and restart — rev-1, rev-2 and rev-3 saves with queued Frame / Axe work and a Recycler job', () => {
  const frameAt = (rev: number) => recipeAtRevision('vehicle_frame', rev, RECIPES)!;
  const axeAt = (rev: number) => recipeAtRevision('industrial_axe', rev, RECIPES)!;
  it('ANALYTIC: the definition a job is paid under, per revision', () => {
    for (const rev of [1, 2]) {
      expect(frameAt(rev)).toEqual(LEGACY_RECIPES['vehicle_frame@2']); expect(axeAt(rev)).toEqual(LEGACY_RECIPES['industrial_axe@2']);
    }
    // rev 3 and rev 4 share one frozen bill (the piped frame / the blade axe, still priced in Machine Parts); rev 5 is live
    expect(frameAt(3)).toBe(frameAt(4)); expect(frameAt(3).ins).toEqual(LEGACY_RECIPES['vehicle_frame_piped@2'].ins); expect(axeAt(3)).toBe(axeAt(4));
    expect(frameAt(5)).toBe(LIVE.vehicle_frame); expect(axeAt(5)).toBe(LIVE.industrial_axe); expect(frameAt(3)).not.toBe(LIVE.vehicle_frame); expect(frameAt(6)).toBe(LIVE.vehicle_frame); expect(RECIPE_REVISION).toBe(6);
  });
  for (const rev of [1, 2, 3] as const) {
    // SUPERSEDED BY ITEM SET V3. This test AUTHORS an old save by running the live engine with Machine Parts and a Damaged
    // Drive in the pack. Neither can be held any more (every mint point issues Parts), so the fixture cannot be produced this
    // way. The invariant itself (reserved UIDs kept, paid once under the old bill, restart mid-job) is proven on a CAPTURED
    // old save holding the retired ids: tests/pa1-rev1-queued-jobs.test.ts, and tests/final-item-set.test.ts (old-save migration).
    it.skip(`a rev-${rev} save: Frame + Axe + Recycler jobs keep UIDs and stock, survive two restarts mid-job, pay out once under rev-${rev} economics (INTENT on FIXTURE stock)`, () => {
      const g = start(400 + rev); const r = g.run!;
      // ── author the save under the table that was live at `rev` ──
      (RECIPES as Table).vehicle_frame = frameAt(rev); (RECIPES as Table).industrial_axe = axeAt(rev);
      for (const [k, q] of [['wood', 40], ['stone', 10], ['iron_ingot', 12], ['mechanical_parts', 12], ['spares', 8], ['metal_pipe', 1], ['metal_blade', 1]] as const) expect(addItem(r, 'inv', k, q)).toBe(0);
      expect(addItem(r, 'inv', 'iron_axe', 1)).toBe(0); expect(addItem(r, 'inv', 'damaged_drive', 1)).toBe(0);
      r.knowledge.recipes.push('industrial_axe'); markDirty();
      const bench = build(g, 'workbench', START + 10); place(r, bench.tx! - 1, bench.ty!);
      expect(act(g, 'upgradeStation', { eid: bench.id }, START + 20).ok).toBe(true);
      const axeUid = C(r, 'inv').slots.find((s) => s?.key === 'iron_axe')!.uid;
      for (const recipe of ['vehicle_frame', 'industrial_axe']) { const res = act(g, 'craft', { eid: bench.id, recipe }, START + 30); expect(res.ok, recipe + ': ' + why(res)).toBe(true); }
      const rcE = recyclerOf(r); place(r, rcE.tx!, rcE.ty!);
      const dSlot = C(r, 'inv').slots.findIndex((s) => s?.key === 'damaged_drive'); const driveUid = C(r, 'inv').slots[dSlot]!.uid;
      const rec = act(g, 'recycleItem', { eid: rcE.id, slot: dSlot, uid: driveUid }, START + 31); expect(rec.ok, why(rec)).toBe(true);
      const recKey = rcE.station!.queue[0].recipe; const recTotal = rcE.station!.queue[0].total;
      const saved = raw(g);
      const q = saved.run.entities[bench.id].station.queue as { recipe: string; rv?: number; reserved: { uid: string; key: string; qty: number }[] }[];
      // what a build of that revision wrote: rev 1 predates stamping (no `rv`), rev 2 / 3 stamp their number
      for (const j of q) { if (rev === 1) delete j.rv; else j.rv = rev; }
      saved.run.tech.recipeRev = rev;
      const reservedBefore = q.map((j) => j.reserved.map((s) => `${s.uid}:${s.key}:${s.qty}`).sort());
      const keys = (j: typeof q[number]) => Object.fromEntries(j.reserved.map((s) => [s.key, s.qty]));
      // the reserved bill IS the revision's bill
      expect(keys(q[0])).toEqual(rev === 3 ? { metal_pipe: 1, iron_ingot: 2, mechanical_parts: 2, spares: 2 } : { iron_ingot: 3, mechanical_parts: 2, spares: 2 });
      expect(keys(q[1])).toEqual(rev === 3 ? { iron_axe: 1, metal_blade: 1, mechanical_parts: 1, spares: 2 } : { iron_axe: 1, mechanical_parts: 2, spares: 2 });
      const watch = ['iron_ingot', 'mechanical_parts', 'spares', 'metal_pipe', 'metal_blade', 'wood'];
      const stockBefore = Object.fromEntries(watch.map((k) => [k, countItem(r, 'inv', k)]));
      // ── the current build ──
      (RECIPES as Table).vehicle_frame = LIVE.vehicle_frame; (RECIPES as Table).industrial_axe = LIVE.industrial_axe;
      const file = JSON.stringify(saved); const open = (text = file) => validate(JSON.parse(text))!;   // validate() adopts its argument
      const back = open(); expect(back, `a rev-${rev} save must open at rev ${RECIPE_REVISION}`).not.toBeNull();
      const br = back.run!; const bb = br.entities[bench.id]; const brc = recyclerOf(br);
      expect(bb.station!.queue.map((j) => [j.recipe, j.rv])).toEqual([['vehicle_frame', rev === 1 ? undefined : rev], ['industrial_axe', rev === 1 ? undefined : rev]]);
      expect(bb.station!.queue.map((j) => j.reserved!.map((s) => `${s.uid}:${s.key}:${s.qty}`).sort())).toEqual(reservedBefore);
      expect(bb.station!.queue[1].reserved!.some((s) => s.uid === axeUid)).toBe(true);
      expect(brc.station!.queue.map((j) => [j.recipe, j.total, j.reserved![0].uid])).toEqual([[recKey, recTotal, driveUid]]);
      for (const [k, v] of Object.entries(stockBefore)) expect(countItem(br, 'inv', k), k).toBe(v);
      // ── run part of the work, save mid-job, restart again ──
      stepStations(back, 12_000, START + 12_031);
      expect(countItem(br, bb.station!.outC, 'vehicle_frame')).toBe(0);                 // nothing paid early (22 s / 25 s jobs)
      const mid = JSON.stringify(raw(back)); const again = open(mid); expect(again, 'mid-job save must reopen').not.toBeNull();
      const ar = again.run!; const ab = ar.entities[bench.id]; const arc = recyclerOf(ar);
      expect(ab.station!.queue.map((j) => j.recipe)).toEqual(['vehicle_frame', 'industrial_axe']);
      expect(ab.station!.queue[0].left).toBe(bb.station!.queue[0].left);
      expect(ab.station!.queue.map((j) => j.reserved!.map((s) => `${s.uid}:${s.key}:${s.qty}`).sort())).toEqual(reservedBefore);
      // ── finish everything ──
      for (let k = 1; k <= 4; k++) stepStations(again, 20_000, START + 12_031 + k * 20_000);
      expect(ab.station!.queue).toHaveLength(0); expect(arc.station!.queue).toHaveLength(0);
      expect(countItem(ar, ab.station!.outC, 'vehicle_frame')).toBe(1); expect(countItem(ar, ab.station!.outC, 'industrial_axe')).toBe(1);
      expect(countItem(ar, arc.station!.outC, 'spares')).toBe(2);                       // Damaged Drive → 2 Parts, once
      // unreserved stock was never touched by the cutover: old jobs did not suddenly need a pipe or a blade
      for (const [k, v] of Object.entries(stockBefore)) expect(countItem(ar, 'inv', k), k).toBe(v);
      // idle time afterwards pays nothing more
      stepStations(again, 120_000, START + 400_000);
      expect(countItem(ar, ab.station!.outC, 'vehicle_frame')).toBe(1); expect(countItem(ar, ab.station!.outC, 'industrial_axe')).toBe(1); expect(countItem(ar, arc.station!.outC, 'spares')).toBe(2);
      // the finished state saves and reopens, and a NEW frame is always charged the rev-3 bill
      const done = open(JSON.stringify(raw(again))); expect(done).not.toBeNull();
      const dr = done.run!; const db = dr.entities[bench.id]; place(dr, db.tx! - 1, db.ty!);
      const pipe0 = countItem(dr, 'inv', 'metal_pipe');
      const fresh = act(done, 'craft', { eid: db.id, recipe: 'vehicle_frame' }, START + 500_000);
      if (pipe0 > 0) { expect(fresh.ok, why(fresh)).toBe(true); expect(countItem(dr, 'inv', 'metal_pipe')).toBe(pipe0 - 1); expect(db.station!.queue[0].rv).toBe(RECIPE_REVISION); }
      else { expect(fresh.ok).toBe(false); expect(why(fresh)).toMatch(/Metal Pipe/); }
      expect(validate(raw(done))).not.toBeNull();
    });
  }
});
