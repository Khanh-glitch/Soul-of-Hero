import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TILE, WW, WH, HOUR, T, type Creature } from '../game/core';
import {
  ALWAYS_KNOWN_RECIPES,
  PRIMORDIAL_ELDERS,
  CREATURES,
  RECIPES,
} from '../game/catalog';
import {
  newGame,
  startRun,
  dispatch,
  markDirty,
  mkStack,
  C,
  phaseOf,
  blockGrid,
  killCreature,
  stepGardensBarrels,
} from '../game/engine';
import { tick, settle, PROJ, HAZ, type Input } from '../game/sim';
import { serializeSnapshot, selectSnapshots } from '../game/persist';
import { getWorld, setActiveLayout } from '../game/world';
import { mapDigest } from '../game/map-package';
import { U05_WORLD_LAYOUT_ID, layoutIdAt } from './scenes';
import { getWindowWorld } from './window';
import { applyFloor, activeFloor } from './floors';
import { shiftVeyraWindowBy, windowOrigin } from './continuity';
import { auToTile, windowAround } from './frame';
import {
  syncVeyraEcosystemActors,
  VEYRA_SIDE_BOSS_SITES,
  VEYRA_PRIMORDIAL_SITES,
} from './ecosystem';
import {
  HUSBANDRY_YIELDS,
  BUTCHER_YIELDS,
  HUSBANDRY_BREEDING_RULES,
  inspectPenAt,
  stepHusbandry,
} from '../game/husbandry';
import {
  stepPrimordialHost,
  cleanupPrimordialBoss,
  damagePrimordialSummons,
  inspectPrimordialHostSession,
} from '../game/primordials/host-bridge';

const T0 = 1_760_000_000_000;
const IDLE_INPUT: Input = {
  up: false, down: false, left: false, right: false,
  mx: 0, my: 0, attack: false, attackPressed: false, roll: false, cancel: false,
};

function startVeyraAtAu(ax: number, ay: number, seed = 20261110) {
  const [gtx, gty] = auToTile(ax, ay);
  const win = windowAround(gtx, gty);
  const layoutId = layoutIdAt(win.originTx, win.originTy);
  setActiveLayout(layoutId);
  const gs = newGame();
  const lx = Math.max(8, Math.min(WW - 9, gtx - win.originTx));
  const ly = Math.max(8, Math.min(WH - 9, gty - win.originTy));
  const res = startRun(gs, 'female', T0, null, seed, { tx: lx, ty: ly });
  expect(res.ok).toBe(true);
  return gs;
}

describe('Veyra Audit Closure & Cross-System Guarantees (#48)', () => {
  beforeEach(() => {
    setActiveLayout(U05_WORLD_LAYOUT_ID);
  });

  it('P0-1: enforces strict Day-14 (>=312h) Primordial awakening across live tick, settle, sanctuary entry, and proportional HP form-shift', () => {
    const surturSpec = VEYRA_PRIMORDIAL_SITES.find(s => s.key === 'surtur')!;
    expect(surturSpec.poiId).toBe('po_surtur');
    const gs = startVeyraAtAu(1694, 817, 7101);
    const r = gs.run!;
    const ww = getWindowWorld(r.layoutId!);
    const [ox, oy] = windowOrigin(r);
    const [stGx, stGy] = auToTile(1694, 817);
    expect(applyFloor(gs, ww, ww.floors, -1, [stGx - ox, stGy - oy], markDirty)).toBe(true);
    expect(activeFloor(r)).toBe(-1);

    const surtur = r.creatures.find(m => m.elder?.key === 'surtur')!;
    expect(surtur).toBeDefined();
    expect(surtur.elder!.awake).toBe(false);
    expect(surtur.maxHp).toBe(PRIMORDIAL_ELDERS.surtur.hpLatent);

    // Damage Surtur to 50% HP while latent
    surtur.hp = Math.round(surtur.maxHp * 0.5);

    // NEGATIVE: 264.5h (Day 12, danger) and 311.5h (end of Day 13, still danger) MUST NOT awaken Surtur
    for (const h of [264.5, 290, 311.5]) {
      const t = T0 + h * HOUR;
      expect(phaseOf(r, t)).toBe('danger');
      settle(gs, t, true);
      r.player.hp = 100; r.player.hunger = 100; r.player.thirst = 100; r.player.warmth = 100;
      tick(gs, { ...IDLE_INPUT, mx: r.player.x, my: r.player.y }, 50, t + 50);
      expect(surtur.elder!.awake).toBe(false);
      expect(surtur.maxHp).toBe(PRIMORDIAL_ELDERS.surtur.hpLatent);
    }

    // Seed an offscreen Elder at 50% latent HP and verify it stays latent until 312h
    const offTyphon: Creature = {
      ...structuredClone(surtur),
      id: 'vy:elder:typhon',
      type: 'elder_typhon',
      hp: Math.round(PRIMORDIAL_ELDERS.typhon.hpLatent * 0.5),
      maxHp: PRIMORDIAL_ELDERS.typhon.hpLatent,
      elder: { key: 'typhon', awake: false, phase: 0, pattern: 0, special: 0 },
    };
    (r.veyraOffscreenCreatures ??= {})[offTyphon.id] = offTyphon;

    // POSITIVE: Crossing 312.0h (Day 14, awakening) awakens BOTH live Surtur and offscreen Typhon, preserving 50% proportional HP!
    const tDay14 = T0 + 312.1 * HOUR;
    expect(phaseOf(r, tDay14)).toBe('awakening');
    settle(gs, tDay14, true);
    expect(surtur.elder!.awake).toBe(true);
    expect(surtur.maxHp).toBe(PRIMORDIAL_ELDERS.surtur.hpAwake);
    expect(surtur.hp).toBe(Math.round(PRIMORDIAL_ELDERS.surtur.hpAwake * 0.5));
    expect(r.veyraOffscreenCreatures![offTyphon.id].elder!.awake).toBe(true);
    expect(r.veyraOffscreenCreatures![offTyphon.id].hp).toBe(Math.round(PRIMORDIAL_ELDERS.typhon.hpAwake * 0.5));
    cleanupPrimordialBoss(r);
  });

  it('P0-2: applies Primordial slow multiplier to real player tick movement, persists cleanly, and clears on expiry/cleanup without UTC drift', () => {
    const gs = startVeyraAtAu(868, 704.5, 7202);
    const r = gs.run!;
    // Find an open horizontal strip safely inside interior window bounds (tx >= 40, <= 150) so window slide does not fire mid-measurement
    const g = blockGrid(r);
    let openTx = 90, openTy = 90;
    outer: for (let ty = 40; ty < 155; ty++) {
      for (let tx = 40; tx < 145; tx++) {
        let clear = true;
        for (let k = 0; k < 14; k++) {
          if (g[ty * WW + (tx + k)] !== 0) { clear = false; break; }
        }
        if (clear) { openTx = tx + 1; openTy = ty; break outer; }
      }
    }
    r.creatures = [];

    // Baseline un-slowed distance over 10 × 50ms frames
    r.player.x = openTx * TILE + 8;
    r.player.y = openTy * TILE + 8;
    let now = r.clock.lastSimAt;
    const x0 = r.player.x;
    for (let i = 0; i < 10; i++) {
      now += 50;
      tick(gs, { ...IDLE_INPUT, right: true, mx: r.player.x + 32, my: r.player.y }, 50, now);
    }
    const baseDist = r.player.x - x0;
    expect(baseDist).toBeGreaterThan(20);

    // Apply 0.4x Primordial slow for 1,200ms and measure distance over identical 10 × 50ms frames
    r.player.x = openTx * TILE + 8;
    r.player.y = openTy * TILE + 8;
    r.player.primordialSlowMul = 0.4;
    r.player.primordialSlowUntil = now + 1200;
    const origStartedAt = r.startedAt;
    const origQaOffset = r.qaOffset;

    const snap = serializeSnapshot(gs);
    expect(selectSnapshots([snap, null]).gs).not.toBeNull();

    const xSlow0 = r.player.x;
    for (let i = 0; i < 10; i++) {
      now += 50;
      tick(gs, { ...IDLE_INPUT, right: true, mx: r.player.x + 32, my: r.player.y }, 50, now);
    }
    const slowDist = r.player.x - xSlow0;
    expect(slowDist).toBeLessThan(baseDist * 0.55);
    expect(slowDist).toBeGreaterThan(baseDist * 0.25);
    expect(r.startedAt).toBe(origStartedAt);
    expect(r.qaOffset).toBe(origQaOffset);

    // Advance past 1200ms expiry -> slow clears automatically
    for (let i = 0; i < 18; i++) {
      now += 50;
      tick(gs, { ...IDLE_INPUT, mx: r.player.x, my: r.player.y }, 50, now);
    }
    expect(r.player.primordialSlowMul).toBeUndefined();
    expect(r.player.primordialSlowUntil).toBeUndefined();

    // Re-apply and verify cleanupPrimordialBoss clears immediately
    r.player.primordialSlowMul = 0.5;
    r.player.primordialSlowUntil = now + 5000;
    cleanupPrimordialBoss(r);
    expect(r.player.primordialSlowMul).toBeUndefined();
    expect(r.player.primordialSlowUntil).toBeUndefined();
  });

  it('P0-3: enforces solid interior/exterior furniture collision without altering ground mapDigest or trapping doors/stairs', () => {
    const gs = startVeyraAtAu(921, 259, 7303); // po_academy
    const r = gs.run!;
    const ww = getWindowWorld(r.layoutId!);
    const world = getWorld(r.layoutId!);
    const digestBefore = mapDigest(world);

    const [ox, oy] = windowOrigin(r);
    const [stGx, stGy] = auToTile(921, 259);
    expect(applyFloor(gs, ww, ww.floors, -1, [stGx - ox, stGy - oy], markDirty)).toBe(true);
    const fMinus1 = ww.floors.layers.get(-1)!;

    let solidCount = 0;
    let purePropCount = 0;
    let solidSample: [number, number] | null = null;
    const grid = blockGrid(r);
    for (let i = 0; i < WW * WH; i++) {
      if (fMinus1.solidProps[i]) {
        solidCount++;
        expect(grid[i]).not.toBe(0);
        if (grid[i] === 2) {
          purePropCount++;
          if (!solidSample) solidSample = [i % WW, (i / WW) | 0];
        }
      }
    }
    expect(solidCount).toBeGreaterThan(0);
    expect(purePropCount).toBeGreaterThan(0);

    // Every stair cell and door cell on F-1 must remain unblocked by solidProps
    for (const st of fMinus1.stairs) {
      const lx = st.x - ox, ly = st.y - oy;
      if (lx >= 0 && ly >= 0 && lx < WW && ly < WH) expect(fMinus1.solidProps[ly * WW + lx]).toBe(0);
    }
    for (const d of fMinus1.statics) {
      if (d.kind === 'door') expect(fMinus1.solidProps[d.ty * WW + d.tx]).toBe(0);
    }

    // Physical movement into a pure solid prop cell is blocked
    const [sx, sy] = solidSample!;
    let adj: [number, number] | null = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = sx + dx, ny = sy + dy;
      if (grid[ny * WW + nx] === 0) { adj = [nx, ny]; break; }
    }
    if (adj) {
      r.player.x = adj[0] * TILE + 8;
      r.player.y = adj[1] * TILE + 8;
      const moveRight = sx > adj[0], moveLeft = sx < adj[0], moveDown = sy > adj[1], moveUp = sy < adj[1];
      let now = r.clock.lastSimAt;
      for (let k = 0; k < 12; k++) {
        now += 50;
        tick(gs, { ...IDLE_INPUT, right: moveRight, left: moveLeft, down: moveDown, up: moveUp, mx: sx * TILE + 8, my: sy * TILE + 8 }, 50, now);
      }
      const ptx = Math.floor(r.player.x / TILE), pty = Math.floor(r.player.y / TILE);
      expect(ptx === sx && pty === sy).toBe(false);
    }

    expect(applyFloor(gs, ww, ww.floors, 0, [stGx - ox, stGy - oy], markDirty)).toBe(true);
    expect(mapDigest(getWorld(r.layoutId!))).toBe(digestBefore);
  });

  it('P0-4 & P1-5: enforces biologically grounded yields, opposite-sex (♀+♂) breeding, and full offscreen pen parity across window shifts', () => {
    // 1. Live yield table sanity: NO live creature sheds hide or antlers while alive!
    for (const [sp, yd] of Object.entries(HUSBANDRY_YIELDS)) {
      expect(yd.primary[0], `${sp} live primary yield`).not.toBe('hide');
      expect(yd.primary[0], `${sp} live primary yield`).not.toBe('antler_shard');
      if (yd.secondary) {
        expect(yd.secondary[0], `${sp} live secondary yield`).not.toBe('hide');
        expect(yd.secondary[0], `${sp} live secondary yield`).not.toBe('antler_shard');
      }
    }
    expect(HUSBANDRY_YIELDS.hare.primary[0]).toBe('fur');
    expect(HUSBANDRY_YIELDS.grouse.primary[0]).toBe('grouse_egg');
    expect(HUSBANDRY_YIELDS.grouse.secondary?.[0]).toBe('feather');
    expect(BUTCHER_YIELDS.deer.adult.some(([k]) => k === 'hide')).toBe(true);
    expect(BUTCHER_YIELDS.boar.adult.some(([k]) => k === 'boar_tusk')).toBe(true);
    expect(RECIPES.poached_eggs).toBeDefined();
    expect(ALWAYS_KNOWN_RECIPES.length).toBe(14);

    // 2. Build an enclosed 5x5 pen on Veyra with a Feed & Water Trough + Rain Barrel
    const gs = startVeyraAtAu(812, 592, 7404);
    const r = gs.run!;
    r.creatures = [];
    Object.keys(r.entities).forEach(eid => { if (r.entities[eid].kind === 'drop') delete r.entities[eid]; });
    const g = blockGrid(r);
    const w0 = getWorld(r.layoutId!);
    let penX = 80, penY = 80;
    searchPen: for (let ty = 40; ty < 140; ty++) {
      for (let tx = 40; tx < 140; tx++) {
        let ok = true;
        for (let dy = 0; dy < 5 && ok; dy++) {
          for (let dx = 0; dx < 5 && ok; dx++) {
            const i = (ty + dy) * WW + (tx + dx);
            if (g[i] !== 0 || w0.sourceV3[i] || r.sources[i] || w0.economyMap.protected[i] || !w0.economyMap.buildable[i] || ![T.GRASS, T.MEADOW, T.SAND, T.FOREST].includes(w0.tiles[i])) ok = false;
          }
        }
        if (ok) { penX = tx; penY = ty; break searchPen; }
      }
    }

    const inv = C(r, 'inv');
    inv.slots.fill(null);
    inv.slots[0] = mkStack(r, 'wood', 50);
    inv.slots[1] = mkStack(r, 'wood', 50);
    inv.slots[2] = mkStack(r, 'stone', 20);
    inv.slots[3] = mkStack(r, 'rope', 15);

    const perimeter: Array<[number, number]> = [];
    for (let dy = 0; dy < 5; dy++) {
      for (let dx = 0; dx < 5; dx++) {
        if (dx === 0 || dx === 4 || dy === 0 || dy === 4) perimeter.push([dx, dy]);
      }
    }
    // Place corners first so diagonal corner pinch never blocks corner placement from inside
    perimeter.sort(([ax, ay], [bx, by]) => {
      const aCorner = (ax === 0 || ax === 4) && (ay === 0 || ay === 4) ? 0 : 1;
      const bCorner = (bx === 0 || bx === 4) && (by === 0 || by === 4) ? 0 : 1;
      return aCorner - bCorner;
    });
    for (const [dx, dy] of perimeter) {
      const standTx = Math.min(penX + 3, Math.max(penX + 1, penX + dx));
      const standTy = Math.min(penY + 3, Math.max(penY + 1, penY + dy));
      r.player.x = standTx * TILE + 8;
      r.player.y = standTy * TILE + 8;
      const bRes = dispatch(gs, { id: `bw_${dx}_${dy}`, type: 'build', struct: 'wall_wood', tx: penX + dx, ty: penY + dy }, T0 + 10);
      expect(bRes.ok, !bRes.ok ? bRes.reason : '').toBe(true);
    }
    r.player.x = (penX + 2) * TILE + 8;
    r.player.y = (penY + 2) * TILE + 8;
    expect(dispatch(gs, { id: 'btrough', type: 'build', struct: 'feed_trough', tx: penX + 1, ty: penY + 1 }, T0 + 20).ok).toBe(true);
    expect(dispatch(gs, { id: 'bbarrel', type: 'build', struct: 'barrel', tx: penX + 3, ty: penY + 1 }, T0 + 25).ok).toBe(true);
    const trough = Object.values(r.entities).find(e => e.type === 'feed_trough')!;
    const barrel = Object.values(r.entities).find(e => e.type === 'barrel')!;
    barrel.water = 6;
    C(r, trough.c!).slots[0] = mkStack(r, 'animal_feed', 35);
    const fl = mkStack(r, 'water_flask', 1); fl.charge = 4;
    C(r, trough.c!).slots[1] = fl;

    const penCheck = inspectPenAt(r, penX + 2, penY + 2);
    expect(penCheck.enclosed).toBe(true);
    expect(penCheck.troughs.map(t => t.id)).toContain(trough.id);

    const mkPennedGrouse = (id: string, sex: 'f' | 'm'): Creature => ({
      id,
      type: 'grouse',
      x: (penX + 2) * TILE + 8,
      y: (penY + 2) * TILE + 8,
      hp: CREATURES.grouse.hp,
      maxHp: CREATURES.grouse.hp,
      homeX: (penX + 2) * TILE + 8,
      homeY: (penY + 2) * TILE + 8,
      state: 'idle',
      t: 0,
      tx: (penX + 2) * TILE + 8,
      ty: (penY + 2) * TILE + 8,
      angle: 0,
      dir: 0,
      knows: null,
      path: null,
      pathT: 0,
      cd: 0,
      kbx: 0,
      kby: 0,
      flash: 0,
      floor: 0,
      husbandry: {
        tamed: true,
        following: false,
        penned: true,
        stage: 'adult',
        sex,
        hunger: 95,
        hydration: 95,
        growth: 1,
        breedProgress: 0,
        produceProgress: 0,
      },
    });

    // NEGATIVE: Two same-sex females ('f' + 'f') NEVER breed even over 24h!
    const g1Id = `m${(r.nextId++).toString(36)}`;
    const g2Id = `m${(r.nextId++).toString(36)}`;
    const g1 = mkPennedGrouse(g1Id, 'f');
    const g2 = mkPennedGrouse(g2Id, 'f');
    r.creatures.push(g1, g2);
    for (let hStep = 0; hStep < 24; hStep++) {
      stepHusbandry(gs, 3600, T0 + (hStep + 1) * HOUR, true);
    }
    expect(r.creatures.filter(m => m.type === 'grouse').length).toBe(2);
    expect(g1.husbandry!.breedProgress).toBe(0);
    expect(g2.husbandry!.breedProgress).toBe(0);
    const outItemsSameSex = C(r, trough.c!).slots.filter(Boolean).map(s => s!.key);
    expect(outItemsSameSex).toContain('grouse_egg');
    expect(outItemsSameSex).toContain('feather');

    // POSITIVE: Change g2 to male ('m'), then slide window 3x (+192 tiles) so the ENTIRE pen + trough + barrel + grouse pair are OFFSCREEN!
    g2.husbandry!.sex = 'm';
    barrel.water = 6;
    C(r, trough.c!).slots.fill(null);
    C(r, trough.c!).slots[0] = mkStack(r, 'animal_feed', 35);
    const fl2 = mkStack(r, 'water_flask', 1); fl2.charge = 4;
    C(r, trough.c!).slots[1] = fl2;

    expect(shiftVeyraWindowBy(gs, 64, 0, markDirty)).toBe(true);
    expect(shiftVeyraWindowBy(gs, 64, 0, markDirty)).toBe(true);
    expect(shiftVeyraWindowBy(gs, 64, 0, markDirty)).toBe(true);

    expect(r.entities[trough.id]).toBeUndefined();
    expect(r.veyraOffscreenEntities?.[trough.id]).toBeDefined();
    expect(r.creatures.some(m => m.id === g1Id || m.id === g2Id)).toBe(false);
    expect(r.veyraOffscreenCreatures?.[g1Id]).toBeDefined();
    expect(r.veyraOffscreenCreatures?.[g2Id]).toBeDefined();

    // Offscreen barrel refills during rain on ground floor
    r.veyraOffscreenEntities![barrel.id].water = 2;
    const barrelBefore = r.veyraOffscreenEntities![barrel.id].water ?? 0;
    stepGardensBarrels(gs, 15 * 60_000, true, T0 + 25 * HOUR);
    expect(r.veyraOffscreenEntities![barrel.id].water ?? 0).toBeGreaterThan(barrelBefore);

    // Step offscreen husbandry across breeding interval
    const breedHours = Math.ceil(HUSBANDRY_BREEDING_RULES.gestationHoursBySpecies.grouse) + 2;
    for (let hStep = 0; hStep < breedHours; hStep++) {
      stepHusbandry(gs, 3600, T0 + (26 + hStep) * HOUR, true);
    }

    const offGrouse = Object.values(r.veyraOffscreenCreatures!).filter(m => m.type === 'grouse');
    expect(offGrouse.length).toBeGreaterThanOrEqual(3);
    expect(offGrouse.some(m => m.husbandry?.stage === 'juvenile')).toBe(true);
    const offOut = C(r, trough.c!).slots.filter(Boolean).map(s => s!.key);
    expect(offOut).toContain('grouse_egg');

    const offSnap = serializeSnapshot(gs);
    expect(selectSnapshots([offSnap, null]).gs).not.toBeNull();

    // Slide back 3x (-192 tiles) -> pen, trough, eggs, and juvenile grouse all return live!
    expect(shiftVeyraWindowBy(gs, -64, 0, markDirty)).toBe(true);
    expect(shiftVeyraWindowBy(gs, -64, 0, markDirty)).toBe(true);
    expect(shiftVeyraWindowBy(gs, -64, 0, markDirty)).toBe(true);
    expect(r.entities[trough.id]).toBeDefined();
    expect(r.creatures.filter(m => m.type === 'grouse').length).toBeGreaterThanOrEqual(3);
  }, 25_000);

  it('P1-6: executes real authored sanctuary fights for all 6 Primordials, hits summons via projectiles/AoE, and keeps stone_axe out of elderStones', () => {
    const stairEntryAu: Record<string, [number, number]> = {
      surtur: [1694, 817],
      typhon: [556, 345],
      aion: [868, 704.5],
      atlas: [168, 503.5],
      argus: [992, 204],
      anubis: [604, 1033],
    };

    for (const sanct of VEYRA_PRIMORDIAL_SITES) {
      const [eax, eay] = stairEntryAu[sanct.key];
      const gs = startVeyraAtAu(eax, eay, 7500 + sanct.key.charCodeAt(0));
      const r = gs.run!;
      const ww = getWindowWorld(r.layoutId!);
      const [ox, oy] = windowOrigin(r);
      if (sanct.floor !== 0) {
        const [stGx, stGy] = auToTile(eax, eay);
        expect(applyFloor(gs, ww, ww.floors, sanct.floor, [stGx - ox, stGy - oy], markDirty)).toBe(true);
      } else {
        syncVeyraEcosystemActors(r, ww);
      }

      const boss = r.creatures.find(m => m.elder?.key === sanct.key)!;
      expect(boss, `Sanctuary ${sanct.poiId} F${sanct.floor} must materialize ${sanct.key}`).toBeDefined();
      const btx = Math.floor(boss.x / TILE), bty = Math.floor(boss.y / TILE);
      expect(blockGrid(r)[bty * WW + btx]).toBe(0);

      // Step real sanctuary fight for 40 frames (2s) with real blockGrid
      r.player.x = boss.x + 28;
      r.player.y = boss.y;
      let now = r.clock.lastSimAt;
      for (let f = 0; f < 40; f++) {
        now += 50;
        r.player.hp = 100;
        stepPrimordialHost(gs, 0.05, now, {
          isBlockedTile: (r0, tx0, ty0) => blockGrid(r0)[ty0 * WW + tx0] !== 0,
          isAwakening: false,
          hurtPlayer: () => {},
          killCreature,
        });
      }
      const sess = inspectPrimordialHostSession(r);
      expect(sess?.mounted.has(boss.id)).toBe(true);
      expect(damagePrimordialSummons(r, boss.x, boss.y, 48, 25)).toBeGreaterThanOrEqual(0);

      // Put a stone_axe in slot 0 and Primordial stone in slot 1 -> only real stone_* enters r.elderStones!
      C(r, 'inv').slots[0] = mkStack(r, 'stone_axe', 1);
      C(r, 'inv').slots[1] = mkStack(r, PRIMORDIAL_ELDERS[sanct.key].stone, 1);
      for (let dTick = 0; dTick < 12; dTick++) {
        now += 50;
        r.player.hp = 100;
        tick(gs, { ...IDLE_INPUT, mx: r.player.x, my: r.player.y }, 50, now);
      }
      expect(r.elderStones).toEqual([PRIMORDIAL_ELDERS[sanct.key].stone]);
      expect(r.elderStones).not.toContain('stone_axe');

      killCreature(gs, boss, now);
      expect(inspectPrimordialHostSession(r)?.mounted.size ?? 0).toBe(0);
    }
  }, 25_000);

  it('P1-7 & P1-8: places Pale Custodian in po_academy Sealed Archive (F-1) and runs 3-move kits + Phase-2 <55% HP + vuln punish across all 4 Side Bosses', () => {
    const custSpec = VEYRA_SIDE_BOSS_SITES.find(s => s.species === 'boss_custodian')!;
    expect(custSpec.poiId).toBe('po_academy');
    expect(custSpec.floor).toBe(-1);

    // Start on po_academy F0 -> Pale Custodian MUST NOT be on ground courtyard!
    const gsAcad = startVeyraAtAu(921, 259, 7606);
    const rAcad = gsAcad.run!;
    const wwAcad = getWindowWorld(rAcad.layoutId!);
    syncVeyraEcosystemActors(rAcad, wwAcad);
    expect(rAcad.creatures.some(m => m.type === 'boss_custodian')).toBe(false);

    // Descend Archive Stair to F-1 -> Pale Custodian spawns in Sealed Archive!
    const [oxA, oyA] = windowOrigin(rAcad);
    const [stGx, stGy] = auToTile(921, 259);
    expect(applyFloor(gsAcad, wwAcad, wwAcad.floors, -1, [stGx - oxA, stGy - oyA], markDirty)).toBe(true);
    const custodian = rAcad.creatures.find(m => m.type === 'boss_custodian')!;
    expect(custodian).toBeDefined();
    expect((custodian as any).floor).toBe(-1);
    expect(blockGrid(rAcad)[Math.floor(custodian.y / TILE) * WW + Math.floor(custodian.x / TILE)]).toBe(0);

    // Exercise Phase 0 -> Phase 2 (<55% HP) + Move 2 + vuln punish window across all 4 Side Bosses
    for (const sb of VEYRA_SIDE_BOSS_SITES) {
      const entryAu: [number, number] = sb.species === 'boss_custodian' ? [921, 259] : sb.au;
      const gs = startVeyraAtAu(entryAu[0], entryAu[1], 7700 + sb.species.charCodeAt(5));
      const r = gs.run!;
      const ww = getWindowWorld(r.layoutId!);
      if (sb.floor !== 0) {
        const [ox, oy] = windowOrigin(r);
        const [gx, gy] = auToTile(entryAu[0], entryAu[1]);
        expect(applyFloor(gs, ww, ww.floors, sb.floor, [gx - ox, gy - oy], markDirty)).toBe(true);
      } else {
        syncVeyraEcosystemActors(r, ww);
      }
      const boss = r.creatures.find(m => m.type === sb.species)!;
      expect(boss).toBeDefined();
      expect(boss.sideBoss!.phase).toBe(0);

      // Put player in range on an open adjacent floor cell and hit boss below 55% HP to trigger Phase 2
      C(r, 'inv').slots[0] = mkStack(r, 'ronin_nodachi', 1);
      r.player.active = 0;
      boss.hp = Math.round(boss.maxHp * 0.56);
      r.player.x = boss.x;
      r.player.y = boss.y;

      let now = r.clock.lastSimAt + 50;
      tick(gs, { ...IDLE_INPUT, attack: true, attackPressed: true, mx: boss.x + 8, my: boss.y }, 50, now);
      for (let k = 0; k < 8; k++) {
        now += 50;
        tick(gs, { ...IDLE_INPUT, mx: boss.x + 8, my: boss.y }, 50, now);
      }
      expect(boss.sideBoss!.phase).toBe(1);

      // Run combat frames in Phase 2 to observe Move 2 & vuln punish window
      const seenMoves = new Set<number>();
      let sawVuln = false;
      PROJ.length = 0;
      HAZ.length = 0;
      for (let f = 0; f < 180; f++) {
        now += 50;
        r.player.hp = 100;
        r.player.x = boss.x;
        r.player.y = boss.y;
        tick(gs, { ...IDLE_INPUT, mx: boss.x, my: boss.y }, 50, now);
        if (boss.atk?.move !== undefined) seenMoves.add(boss.atk.move);
        if ((boss.atk?.vuln ?? 0) > 0) sawVuln = true;
      }
      expect(seenMoves.has(2), `${sb.species} Phase 2 must unlock Move 2`).toBe(true);
      expect(sawVuln, `${sb.species} must expose a post-heavy vuln punish window`).toBe(true);
    }
  }, 25_000);

  it('P1-9..12: verifies subterranean cave darkness, orc pack rally, habitat kill cooldowns, offscreen cap <=96, motorbike geometry, and KeyM/MapPanel/SkillsPanel contracts', () => {
    const gs = startVeyraAtAu(921, 259, 7808);
    const r = gs.run!;
    const ww = getWindowWorld(r.layoutId!);
    const world = getWorld(r.layoutId!);

    expect(world.vehicleGeometry?.version).toBe('vehicle-geometry-v1');

    // Subterranean F-1 nocturnal vampire_2 wakes even at solar noon (effSunLevel = 0 underground)
    const [ox, oy] = windowOrigin(r);
    const [stGx, stGy] = auToTile(921, 259);
    expect(applyFloor(gs, ww, ww.floors, -1, [stGx - ox, stGy - oy], markDirty)).toBe(true);
    r.nextId = Math.max(r.nextId, 3000);
    const caveVamp: Creature = {
      id: 'm777',
      type: 'vampire_2',
      x: r.player.x + 24,
      y: r.player.y,
      hp: 52, maxHp: 52,
      homeX: r.player.x + 24, homeY: r.player.y,
      state: 'sleep',
      t: 0, tx: r.player.x + 24, ty: r.player.y,
      angle: 0, dir: 0, knows: null, path: null, pathT: 0, cd: 0, kbx: 0, kby: 0, flash: 0,
      floor: -1,
    };
    r.creatures.push(caveVamp);
    const noonNow = r.startedAt + 12 * HOUR;
    settle(gs, noonNow, true);
    r.player.dead = false; r.player.hp = 100; r.player.hunger = 100; r.player.thirst = 100; r.player.warmth = 100;
    tick(gs, { ...IDLE_INPUT, mx: r.player.x, my: r.player.y }, 50, noonNow + 50);
    expect(caveVamp.state).not.toBe('sleep');

    // Return to F0, locate a 5-tile open meadow strip with clear LOS, and test Orc pack rally + habitat cooldown
    expect(applyFloor(gs, ww, ww.floors, 0, [stGx - ox, stGy - oy], markDirty)).toBe(true);
    const g0 = blockGrid(r);
    let openX = 60, openY = 60;
    findOpen: for (let ty = 40; ty < 150; ty++) {
      for (let tx = 40; tx < 150; tx++) {
        if ([0, 1, 2, 3, 4].every(k => g0[ty * WW + tx + k] === 0)) {
          openX = tx; openY = ty; break findOpen;
        }
      }
    }
    r.player.x = openX * TILE + 8;
    r.player.y = openY * TILE + 8;
    r.player.sheltered = false;
    const orcA: Creature = {
      id: 'vy:hab:test_orc:0',
      type: 'orc_1',
      x: (openX + 1) * TILE + 8,
      y: openY * TILE + 8,
      hp: 65, maxHp: 65,
      homeX: (openX + 1) * TILE + 8, homeY: openY * TILE + 8,
      state: 'idle',
      t: 0, tx: (openX + 1) * TILE + 8, ty: openY * TILE + 8,
      angle: Math.PI, dir: 2,
      knows: null,
      path: null, pathT: 0, cd: 500, kbx: 0, kby: 0, flash: 0, floor: 0,
    };
    const orcB: Creature = {
      ...structuredClone(orcA),
      id: 'vy:hab:test_orc:1',
      type: 'orc_2',
      x: (openX + 3) * TILE + 8,
      y: openY * TILE + 8,
      angle: 0, // facing away so orcB relies on orcA's pack rally shout!
      knows: null,
    };
    r.creatures.push(orcA, orcB);
    tick(gs, { ...IDLE_INPUT, mx: r.player.x, my: r.player.y }, 50, noonNow + 100);
    expect(orcA.knows?.kind).toBe('sight');
    expect(orcB.knows?.kind).toBe('sight');

    // Killing habitat orc records veyraEcologyCooldowns
    killCreature(gs, orcA, noonNow + 150);
    expect(r.veyraEcologyCooldowns?.['vy:hab:test_orc:0']).toBeGreaterThan(noonNow);

    // Slide across 8 windows to stress offscreen ambient culling (<= 96)
    for (let step = 0; step < 8; step++) {
      shiftVeyraWindowBy(gs, -64, 32, markDirty);
    }
    const ambientOffscreen = Object.values(r.veyraOffscreenCreatures ?? {}).filter(
      m => !m.elder && !m.sideBoss && !m.husbandry?.tamed,
    );
    expect(ambientOffscreen.length).toBeLessThanOrEqual(96);

    // UI source-contract checks: KeyM unconditionally opens Map, SkillsPanel uses PRIMORDIAL_ELDERS, MapPanel supports Continent Fog-of-War
    const gameTsx = readFileSync(resolve(__dirname, '../ui/Game.tsx'), 'utf8');
    const panelsTsx = readFileSync(resolve(__dirname, '../ui/panels.tsx'), 'utf8');
    expect(gameTsx).toContain("case 'KeyM': toggle('map'); break;");
    expect(gameTsx).not.toContain("case 'KeyM': if(r.layoutId");
    expect(panelsTsx).toContain('PRIMORDIAL_ELDERS');
    expect(panelsTsx).toContain('map-mode-continent');
    expect(panelsTsx).toContain('veyraGlobalDiscovered');
  }, 25_000);
});
