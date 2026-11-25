// The QA Lab [F9] scenes run on VEYRA, the world a player's New run uses, so a playtest of a scene is a
// playtest of the real map. These tests pin that, and pin that every fixture a scene stages stands on
// ground the engine's own placement rule accepts, where the player can walk up to it.
import { afterAll, describe, expect, it } from 'vitest';
import { buildQaSandbox, QA_PRESETS, qaElderKey, qaElderRoster, resetQaSandboxFlags, triggerQaEvent, type QaPresetId } from '../src/game/qa-sandbox';
import { TILE, T, WW, type GameState, type RunState } from '../src/game/core';
import { blockedAt, claimAt, effTile, sourceAt } from '../src/game/engine';
import { ITEMS, PRIMORDIAL_ELDERS, STRUCTS } from '../src/game/catalog';
import { isVeyra05Layout } from '../src/veyra05/scenes';
import { setActiveLayout } from '../src/game/world';
import { tick, type Input } from '../src/game/sim';

const NOW = 1_800_000_000_000;
const NO_BUILD: number[] = [T.DEEP, T.SHALLOW, T.RIVER, T.CLIFF, T.PWALL, T.LAVA, T.FLOOR, T.ICE, T.ROAD, T.BRIDGE];
const idle = (): Input => ({ up: false, down: false, left: false, right: false, mx: 0, my: 0, attack: false, attackPressed: false, roll: false, cancel: false });

const built = new Map<QaPresetId, { gs: GameState; banner?: { text: string; sub: string } }>();
function scene(id: QaPresetId) {
  // One build per preset: the checks below only read it.
  let b = built.get(id);
  if (!b) { b = buildQaSandbox(id, 'female', NOW); built.set(id, b); }
  else setActiveLayout(b.gs.run!.layoutId!);
  return { ...b, r: b.gs.run! };
}
const qaEntities = (r: RunState) => Object.values(r.entities).filter(e => e.id.startsWith('qa'));
const tileOf = (v: number) => Math.floor(v / TILE);

/** Tiles the player can walk to (4-neighbour flood over the engine's block grid, 40 tiles out). */
function walkable(r: RunState): Set<number> {
  const sx = tileOf(r.player.x), sy = tileOf(r.player.y);
  const seen = new Set<number>([sy * WW + sx]); const q = [sx, sy];
  for (let i = 0; i < q.length; i += 2) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = q[i] + dx, ny = q[i + 1] + dy, k = ny * WW + nx;
    if (seen.has(k) || Math.abs(nx - sx) > 40 || Math.abs(ny - sy) > 40 || blockedAt(r, nx, ny)) continue;
    seen.add(k); q.push(nx, ny);
  }
  return seen;
}
const touches = (reach: Set<number>, tx: number, ty: number) =>
  [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reach.has((ty + dy) * WW + tx + dx));

afterAll(() => {
  resetQaSandboxFlags();
  setActiveLayout('shipping');
});

describe('QA Lab scenes run on VEYRA', () => {
  for (const preset of QA_PRESETS) {
    describe(preset.id, () => {
      it('is a VEYRA run and the player stands on open ground', () => {
        const { r } = scene(preset.id);
        expect(isVeyra05Layout(r.layoutId || '')).toBe(true);
        expect(r.qaUsed).toBe(true);
        expect(blockedAt(r, tileOf(r.player.x), tileOf(r.player.y))).toBe(false);
      });

      it('stages every structure on ground the placement rule accepts, one object per tile', () => {
        const { r } = scene(preset.id);
        const structs = qaEntities(r).filter(e => e.kind === 'struct');
        const illegal = structs.filter(e => {
          const src = sourceAt(r, e.tx!, e.ty!);
          return NO_BUILD.includes(effTile(r, e.tx!, e.ty!)) || (!!src && src.stock > 0);
        }).map(e => `${e.type}@${e.tx},${e.ty}`);
        expect(illegal).toEqual([]);
        // Walls and objects share the engine's "Tile occupied" rule: at most one of them per tile.
        const solid = new Map<string, string[]>();
        for (const e of structs) {
          const layer = STRUCTS[e.type!].layer;
          if (layer !== 'wall' && layer !== 'obj') continue;
          const k = `${e.tx},${e.ty}`; solid.set(k, [...(solid.get(k) || []), e.type!]);
        }
        expect([...solid.entries()].filter(([, v]) => v.length > 1)).toEqual([]);
        // Nothing staged sits on top of something the world put there.
        const world = new Set(Object.values(r.entities).filter(e => !e.id.startsWith('qa') && e.kind !== 'vehicle' && e.kind !== 'cart').map(e => `${tileOf(e.x)},${tileOf(e.y)}`));
        expect(structs.filter(e => world.has(`${e.tx},${e.ty}`)).map(e => e.type)).toEqual([]);
      });

      it('keeps what the tester must use within walking reach', () => {
        const { r } = scene(preset.id);
        const reach = walkable(r);
        const use = qaEntities(r).filter(e => e.kind !== 'struct' || !!e.station || !!e.c || ['claim', 'escrow', 'bed_straw', 'garden', 'barrel'].includes(e.type || ''));
        const lost = use.filter(e => !touches(reach, tileOf(e.x), tileOf(e.y))).map(e => `${e.kind}:${e.type ?? ''}@${tileOf(e.x)},${tileOf(e.y)}`);
        expect(lost).toEqual([]);
        const stuck = r.creatures.filter(c => c.id.startsWith('qa')).filter(c => !reach.has(tileOf(c.y) * WW + tileOf(c.x))).map(c => c.type);
        expect(stuck).toEqual([]);
      });

      it('stages no airdrop: VEYRA has none', () => {
        const { r } = scene(preset.id);
        expect(Object.values(r.entities).filter(e => e.kind === 'airdrop')).toEqual([]);
      });
    });
  }

  it('the yard scenes own their ground: the Escrow Chest is inside the Cabinet territory', () => {
    for (const id of ['industry', 'full_gear', 'offline_return', 'ragnarok_economy'] as const) {
      const { r } = scene(id);
      const escrow = qaEntities(r).find(e => e.type === 'escrow')!;
      expect(escrow, id).toBeTruthy();
      expect(claimAt(r, escrow.tx!, escrow.ty!), id).toBeTruthy();
    }
  });

  it('the yard keeps its real engine jobs', () => {
    const { r } = scene('industry');
    const queued = qaEntities(r).filter(e => e.station && e.station.queue.length > 0).map(e => e.type).sort();
    expect(queued).toEqual(['furnace', 'refinery', 'research']);
  });

  it('the Elder scene stages a Primordial of VEYRA, and the lab roster is the Primordial six', () => {
    const { r, banner } = scene('elders');
    expect(Object.keys(qaElderRoster(r)).sort()).toEqual(Object.keys(PRIMORDIAL_ELDERS).sort());
    expect(qaElderKey(r, 'rust')).toBe('typhon');
    expect(qaElderKey(r, 'argus')).toBe('argus');
    const boss = r.creatures.find(c => c.elder?.key === 'typhon')!;
    expect(boss).toBeTruthy();
    expect(boss.elder!.awake).toBe(true);
    expect(Math.hypot(boss.x - r.player.x, boss.y - r.player.y)).toBeLessThan(12 * TILE);
    expect(banner?.sub).toContain(PRIMORDIAL_ELDERS.typhon.name);
  });

  it('the Elder fight runs in the live sim, and the lab can stage and defeat another Primordial', () => {
    // A fresh build: this test advances the simulation.
    const { gs } = buildQaSandbox('elders', 'female', NOW);
    const r = gs.run!;
    let now = NOW;
    for (let i = 0; i < 100; i++) { now += 50; tick(gs, idle(), 50, now); }
    expect(r.creatures.some(c => c.elder?.key === 'typhon')).toBe(true);

    const staged = triggerQaEvent(gs, 'awaken_elder', now, 'frost');
    expect(staged.banner?.text).toBe(`${PRIMORDIAL_ELDERS.argus.name.toUpperCase()} AWAKENS`);
    expect(r.creatures.filter(c => c.elder?.key === 'argus')).toHaveLength(1);
    for (let i = 0; i < 40; i++) { now += 50; tick(gs, idle(), 50, now); }

    const beaten = triggerQaEvent(gs, 'defeat_elder', now, 'frost');
    expect(beaten.banner?.text).toBe(`${PRIMORDIAL_ELDERS.argus.name.toUpperCase()} VANQUISHED`);
    const stone = Object.values(r.entities).find(e => e.id.startsWith('qa_stone_'))!;
    expect(r.custody[stone.c!].slots[0]?.key).toBe(PRIMORDIAL_ELDERS.argus.stone);
  });

  it('the Ragnarok scene carries stones of this world', () => {
    const { r } = scene('ragnarok_economy');
    expect(r.elderStones).toHaveLength(3);
    const primordial = Object.values(PRIMORDIAL_ELDERS).map(d => d.stone);
    for (const k of r.elderStones) { expect(ITEMS[k], k).toBeTruthy(); expect(primordial).toContain(k); }
  });
});
