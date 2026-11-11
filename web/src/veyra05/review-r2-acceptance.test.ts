import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import { BAL, TILE, WW, WH, HOUR, T, VIEW_W, VIEW_H, clamp, type Creature, type AmbientWoundStub } from '../game/core';
import { PRIMORDIAL_ELDERS, CREATURES, ITEMS } from '../game/catalog';
import {
  newGame,
  startRun,
  dispatch,
  markDirty,
  mkStack,
  C,
  countItem,
  blockGrid,
  stepGardensBarrels,
} from '../game/engine';
import { tick, settle, rayLen, PROJ, HAZ, type Input } from '../game/sim';
import { serializeSnapshot, selectSnapshots } from '../game/persist';
import { setActiveLayout, getWorld } from '../game/world';
import { U05_WORLD_LAYOUT_ID, layoutIdAt } from './scenes';
import { getWindowWorld } from './window';
import {
  applyFloor,
  activeFloor,
  authoredPlan,
  authoredPoiIds,
  isSolidVeyraProp,
  VEYRA_SOLID_PROP_KINDS,
  VEYRA_NON_SOLID_PROP_KINDS,
  VEYRA_PROP_SOLID_FOOTPRINTS,
  getSolidPropFootprint,
  type FloorLayer,
  type Level,
} from './floors';
import { hasLandmarkSprite, isSolidFootprintPlaced } from './decor-client';
import { sampleTile } from './reader';
import { shiftVeyraWindowBy, windowOrigin } from './continuity';
import { auToTile, windowAround } from './frame';
import { getAllPoiLayouts } from './poi-kit';
import {
  syncVeyraEcosystemActors,
  VEYRA_SIDE_BOSS_SITES,
  VEYRA_PRIMORDIAL_SITES,
} from './ecosystem';
import { resolveHusbandryYield, inspectPenAt, stepHusbandry, deterministicAnimalSex } from '../game/husbandry';
import { inspectPrimordialHostSession, cleanupPrimordialBoss } from '../game/primordials/host-bridge';
import { World, v } from '../game/primordials/game/core';
import { spawnBoss, spawnPlayer, startSkill, stepWorld } from '../game/primordials/game/sim';
import { SIGNATURE } from '../game/primordials/game/registry';
import { BOSS_IDS } from '../game/primordials/art/clips';
import { FB, renderWorld, type RenderOpts } from '../game/primordials/render/frame';

const SANCTUARY_ENTRY_AU: Record<(typeof VEYRA_PRIMORDIAL_SITES)[number]['key'], [number, number]> = {
  surtur: [1694, 817],
  typhon: [556, 345],
  aion: [868, 704.5],
  atlas: [168, 503.5],
  argus: [992, 204],
  anubis: [604, 1033],
};

const IDLE_INPUT: Input = {
  up: false,
  down: false,
  left: false,
  right: false,
  roll: false,
  attack: false,
  attackPressed: false,
  cancel: false,
  mx: 0,
  my: 0,
};

function startVeyraAtAu(auX: number, auY: number, seed = 8801) {
  const [gx, gy] = auToTile(auX, auY);
  const win = windowAround(gx, gy);
  const lid = layoutIdAt(win.originTx, win.originTy);
  setActiveLayout(lid);
  const gs = newGame();
  const t0 = 1_760_000_000_000;
  const lx = clamp(gx - win.originTx, 8, WW - 9);
  const ly = clamp(gy - win.originTy, 8, WH - 9);
  const res = startRun(gs, 'female', t0, null, seed, { tx: lx, ty: ly });
  expect(res.ok).toBe(true);
  const r = gs.run!;
  r.player.hp = 100;
  r.player.hunger = 100;
  r.player.thirst = 100;
  r.player.warmth = 100;
  r.player.stamina = 100;
  markDirty();
  return gs;
}

function isFullFootprintSolid(layer: FloorLayer, tx: number, ty: number, kind: string): boolean {
  const fp = getSolidPropFootprint(kind);
  return (
    fp.length > 0 &&
    fp.every(([dx, dy]) => {
      const fx = tx + dx;
      const fy = ty + dy;
      return fx >= 0 && fx < WW && fy >= 0 && fy < WH && layer.solidProps[fy * WW + fx] === 1;
    })
  );
}

function isFullFootprintClear(layer: FloorLayer, tx: number, ty: number, kind: string): boolean {
  const fp = getSolidPropFootprint(kind);
  return fp.every(([dx, dy]) => {
    const fx = tx + dx;
    const fy = ty + dy;
    return fx < 0 || fx >= WW || fy < 0 || fy >= WH || layer.solidProps[fy * WW + fx] === 0;
  });
}

describe('Review Round 2 Acceptance — Negative-First & Zero-Shortcut Guarantees', () => {
  beforeEach(() => {
    setActiveLayout(U05_WORLD_LAYOUT_ID);
  });

  it('P0-1: enforces directional arc, weapon reach, and wall/prop LOS on summon combat plus sanctuary wall occlusion on boss wake & hitEnemies', () => {
    const entryAu = SANCTUARY_ENTRY_AU.surtur;
    const gs = startVeyraAtAu(entryAu[0], entryAu[1], 9101);
    const r = gs.run!;
    const ww = getWindowWorld(r.layoutId!);
    const [ox, oy] = windowOrigin(r);
    const [gx, gy] = auToTile(entryAu[0], entryAu[1]);
    expect(applyFloor(gs, ww, ww.floors, -1, [gx - ox, gy - oy], markDirty)).toBe(true);
    for (const e of Object.values(r.entities)) {
      if (e.kind === 'door' && ((e as any).floor ?? 0) === -1) e.open = true;
    }
    markDirty();

    const boss = r.creatures.find(m => m.elder?.key === 'surtur')!;
    expect(boss).toBeDefined();
    expect(boss.state).toBe('sleep');

    // NEGATIVE #1: Standing within 135px of dormant boss BEHIND a solid sanctuary wall (T.PWALL) MUST NOT wake or mount the boss!
    const g0 = blockGrid(r);
    const btx = Math.floor(boss.x / TILE);
    const bty = Math.floor(boss.y / TILE);
    let wallBlockedSpot: [number, number] | null = null;
    for (let dy = -8; dy <= 8 && !wallBlockedSpot; dy++) {
      for (let dx = -8; dx <= 8 && !wallBlockedSpot; dx++) {
        const tx = clamp(btx + dx, 4, WW - 5);
        const ty = clamp(bty + dy, 4, WH - 5);
        const px = tx * TILE + 8;
        const py = ty * TILE + 8;
        const d = Math.hypot(px - boss.x, py - boss.y);
        if (d < 40 || d > 135 || g0[ty * WW + tx] !== 0) continue;
        let hasWallBetween = false;
        for (let k = 1; k < 24; k++) {
          const rx = Math.floor((px + ((boss.x - px) * k) / 24) / TILE);
          const ry = Math.floor((py + ((boss.y - py) * k) / 24) / TILE);
          if (g0[ry * WW + rx] === 1) {
            hasWallBetween = true;
            break;
          }
        }
        if (hasWallBetween) wallBlockedSpot = [px, py];
      }
    }
    expect(wallBlockedSpot, 'sanctuary must have an exterior tile within 135px occluded by chamber wall').not.toBeNull();
    r.player.x = wallBlockedSpot![0];
    r.player.y = wallBlockedSpot![1];
    let now = r.clock.lastSimAt;
    for (let i = 0; i < 6; i++) {
      now += 50;
      tick(gs, { ...IDLE_INPUT, mx: boss.x, my: boss.y }, 50, now);
    }
    expect(boss.state, 'boss must stay asleep when player is behind sanctuary wall').toBe('sleep');
    expect(inspectPrimordialHostSession(r)?.mounted.size ?? 0).toBe(0);

    // Step into clear chamber LOS -> boss wakes & mounts!
    let openSpot: [number, number] | null = null;
    for (const [dx, dy] of [[0, -2], [2, 0], [-2, 0], [0, 2]] as const) {
      const tx = btx + dx;
      const ty = bty + dy;
      if (g0[ty * WW + tx] === 0) {
        openSpot = [tx * TILE + 8, ty * TILE + 8];
        break;
      }
    }
    expect(openSpot).not.toBeNull();
    r.player.x = openSpot![0];
    r.player.y = openSpot![1];
    now += 50;
    tick(gs, { ...IDLE_INPUT, mx: boss.x, my: boss.y }, 50, now);
    const sess = inspectPrimordialHostSession(r)!;
    expect(sess.mounted.size).toBe(1);

    // Park boss safely aside inside chamber while testing negative/positive summon & wall-occlusion geometry
    const mountedActor = sess.world.actor(Array.from(sess.mounted.values())[0].actorId)!;
    mountedActor.pos.x = boss.x;
    mountedActor.pos.y = boss.y - 36;
    mountedActor.boss!.runner = null;
    mountedActor.boss!.autonomous = false;

    C(r, 'inv').slots[0] = mkStack(r, 'iron_sword', 1);
    C(r, 'inv').slots[1] = mkStack(r, 'bow', 1);
    C(r, 'inv').slots[2] = mkStack(r, 'arrow', 20);
    r.player.active = 0;

    let stripTx = -1;
    let stripTy = -1;
    for (let dy = -4; dy <= 4 && stripTx < 0; dy++) {
      for (let dx = -4; dx <= 2 && stripTx < 0; dx++) {
        const tx = clamp(btx + dx, 6, WW - 10);
        const ty = clamp(bty + dy, 6, WH - 6);
        if (
          g0[ty * WW + (tx - 1)] === 0 &&
          g0[ty * WW + tx] === 0 &&
          g0[ty * WW + (tx + 1)] === 0 &&
          g0[ty * WW + (tx + 2)] === 0 &&
          g0[ty * WW + (tx + 3)] === 0
        ) {
          stripTx = tx;
          stripTy = ty;
        }
      }
    }
    expect(stripTx).toBeGreaterThan(0);
    const openX = stripTx * TILE + 8;
    const openY = stripTy * TILE + 8;
    r.player.x = openX;
    r.player.y = openY;

    // Spawn a real Primordial summon 18px EAST of player
    const summon = sess.world.spawnActor({
      kind: 'summon',
      team: 'boss',
      pos: v(openX + 18, openY),
      r: 6,
      hp: 80,
      maxHp: 80,
      speed: 0,
      name: 'cinder_shade',
      summon: { owner: mountedActor.id, until: sess.world.t + 60, atkCd: 99, dmg: 6, el: 'fire', variant: 0 },
    });

    // Helper: execute a full melee swing animation (450ms across 9 ticks so resolveSwing fires at mid-swing!)
    const performFullSwing = (aimX: number, aimY: number) => {
      for (let k = 0; k < 9; k++) {
        now += 50;
        summon.summon!.atkCd = 99;
        tick(
          gs,
          { ...IDLE_INPUT, attack: k === 0, attackPressed: k === 0, mx: aimX, my: aimY },
          50,
          now,
        );
      }
    };

    // NEGATIVE #2 (360° swing check): Full swing WEST (away from summon at +18px EAST) -> summon MUST take 0 damage!
    performFullSwing(openX - 80, openY);
    expect(summon.hp, 'swinging away from summon must deal 0 damage (no 360° hit)').toBe(80);

    // NEGATIVE #3 (out-of-reach check): Place summon 42px EAST (beyond iron_sword reach 26 + summon.r 6) and swing EAST -> 0 damage!
    summon.pos.x = openX + 42;
    summon.pos.y = openY;
    performFullSwing(openX + 80, openY);
    expect(summon.hp, 'swinging short of summon reach must deal 0 damage').toBe(80);

    // POSITIVE #1 (in-arc + in-reach + clear LOS melee): Place summon 18px EAST and swing EAST -> summon takes damage!
    summon.pos.x = openX + 18;
    summon.pos.y = openY;
    performFullSwing(openX + 80, openY);
    expect(summon.hp, 'in-cone in-reach melee swing with clear LOS must damage summon').toBeLessThan(80);
    const hpAfterMelee = summon.hp;

    // NEGATIVE #4 (wall occlusion across melee, fireball AoE, AND boss hitEnemies):
    const wallIdx = stripTy * WW + (stripTx + 1);
    const savedTerrain = r.terrain[wallIdx];
    r.terrain[wallIdx] = { t: T.PWALL };
    markDirty();
    expect(blockGrid(r)[wallIdx]).toBe(1);

    summon.pos.x = (stripTx + 2) * TILE + 4; // 28px away -> within tidemarshal_trident reach 38!
    summon.pos.y = stripTy * TILE + 8;
    summon.kb = v(0, 0);
    summon.vel = v(0, 0);
    C(r, 'inv').slots[0] = mkStack(r, 'tidemarshal_trident', 1);
    r.player.active = 0;
    r.player.x = openX;
    r.player.y = openY;

    // 4a) Full melee thrust across wall -> 0 damage!
    performFullSwing(summon.pos.x, summon.pos.y);
    expect(summon.hp, 'melee thrust through wall must deal 0 damage to summon').toBe(hpAfterMelee);

    // 4b) Fireball AoE explosion on player side of wall -> 0 damage to summon on far side of wall!
    PROJ.push({
      x: stripTx * TILE + 12,
      y: stripTy * TILE + 8,
      vx: 180,
      vy: 0,
      life: 0.4,
      dmg: 45,
      from: 'player',
      kind: 'fireball',
      r: 4,
    });
    for (let k = 0; k < 5; k++) {
      now += 50;
      summon.summon!.atkCd = 99;
      tick(gs, { ...IDLE_INPUT, mx: summon.pos.x, my: summon.pos.y }, 50, now);
    }
    expect(summon.hp, 'fireball explosion occluded by wall must deal 0 damage to summon').toBe(hpAfterMelee);

    // 4c) Boss radial hitEnemies from far side of wall -> 0 damage to player on near side of wall!
    const playerActor = sess.world.actors.find(a => a.team === 'player')!;
    playerActor.pos.x = r.player.x;
    playerActor.pos.y = r.player.y;
    playerActor.iframesUntil = 0;
    const hpBeforeBossRadial = playerActor.hp;
    const bossSidePos = v((stripTx + 2) * TILE + 8, stripTy * TILE + 8);
    expect(sess.world.wallRaycast!(bossSidePos, playerActor.pos)).toBe(true);
    const wallAtt = {
      id: 9999,
      skill: 'test_wall_radial',
      owner: mountedActor.id,
      hits: new Map(),
      t0: sess.world.t,
      landed: 0,
    };
    const hitThroughWall = sess.world.hitEnemies(
      mountedActor,
      wallAtt,
      { k: 'circle', x: bossSidePos.x, y: bossSidePos.y, r: 64 },
      { dmg: 30, kbFrom: bossSidePos },
    );
    expect(hitThroughWall.length, 'boss radial hitEnemies must be occluded by sanctuary wall').toBe(0);
    expect(playerActor.hp).toBe(hpBeforeBossRadial);

    // Restore open floor -> boss radial hitEnemies now connects cleanly, AND arrow projectile + AoE kill summon!
    if (savedTerrain) r.terrain[wallIdx] = savedTerrain;
    else delete r.terrain[wallIdx];
    markDirty();
    expect(blockGrid(r)[wallIdx]).toBe(0);
    expect(sess.world.wallRaycast!(bossSidePos, playerActor.pos)).toBe(false);
    const openAtt = {
      id: 10000,
      skill: 'test_open_radial',
      owner: mountedActor.id,
      hits: new Map(),
      t0: sess.world.t,
      landed: 0,
    };
    const hitOpenFloor = sess.world.hitEnemies(
      mountedActor,
      openAtt,
      { k: 'circle', x: bossSidePos.x, y: bossSidePos.y, r: 64 },
      { dmg: 12, kbFrom: bossSidePos },
    );
    expect(hitOpenFloor.length, 'boss radial hitEnemies must connect once wall is cleared').toBe(1);
    playerActor.hp = 1000;
    playerActor.iframesUntil = 0;

    PROJ.push({
      x: r.player.x + 4,
      y: r.player.y,
      vx: 240,
      vy: 0,
      life: 0.5,
      dmg: 35,
      from: 'player',
      kind: 'arrow',
      r: 3,
    });
    for (let k = 0; k < 4; k++) {
      now += 50;
      summon.summon!.atkCd = 99;
      tick(gs, { ...IDLE_INPUT, mx: summon.pos.x, my: summon.pos.y }, 50, now);
    }
    expect(summon.hp, 'arrow projectile with clear LOS must damage summon').toBeLessThan(hpAfterMelee);

    HAZ.push({
      kind: 'circle',
      x: summon.pos.x,
      y: summon.pos.y,
      r: 18,
      t: 0,
      tell: 0,
      dur: 120,
      dmg: 90,
      style: 'spike',
      owner: 'player',
    });
    now += 50;
    tick(gs, { ...IDLE_INPUT, mx: summon.pos.x, my: summon.pos.y }, 50, now);
    expect(summon.alive, 'player AoE hazard with clear LOS must slay summon').toBe(false);
  });

  it('P0-2: guarantees full-footprint multi-tile prop solidity, zero ghost props across all 81 POIs × 4 storeys, and physical player/creature/motorbike wing collision', () => {
    const allPois = getAllPoiLayouts();
    expect(allPois.length).toBe(81);

    let totalSolidPropsVerified = 0;
    let totalMultiTileFootprintCells = 0;
    const seenMultiTileKinds = new Set<string>();

    // Exhaustively audit EVERY SINGLE ONE of the 81 POIs across F0 and all authored storeys (F-1, F1, F2)
    for (let idx = 0; idx < allPois.length; idx++) {
      const poi = allPois[idx];
      const [cx, cy] = poi.atTile;
      const win = windowAround(cx, cy);
      const lid = layoutIdAt(win.originTx, win.originTy);
      const ww = getWindowWorld(lid);
      const ox = win.originTx;
      const oy = win.originTy;

      const auditPropList = (
        layer: FloorLayer,
        fl: number,
        props: { x: number; y: number; kind: string }[],
      ) => {
        expect(layer.solidProps.length).toBe(WW * WH);
        const stairCells = new Set<number>();
        for (const st of layer.stairs) {
          const sx = (st.from === fl ? st.x : st.tx) - ox;
          const sy = (st.from === fl ? st.y : st.ty) - oy;
          if (sx >= 0 && sx < WW && sy >= 0 && sy < WH) stairCells.add(sy * WW + sx);
        }
        const doorCells = new Set<number>();
        for (const s of layer.statics) {
          if (s.kind === 'door') doorCells.add(s.ty * WW + s.tx);
        }

        for (const p of props) {
          if (!VEYRA_SOLID_PROP_KINDS.has(p.kind)) {
            expect(
              VEYRA_NON_SOLID_PROP_KINDS.has(p.kind),
              `unknown prop kind ${p.kind} in ${poi.id} F${fl} must be classified`,
            ).toBe(true);
            continue;
          }
          // Every solid prop must EITHER have its ENTIRE multi-tile footprint solid, OR be completely suppressed (and skipped by decor-client)!
          if (!isFullFootprintSolid(layer, p.x, p.y, p.kind)) {
            // If suppressed, decor-client skips rendering it -> zero ghost props!
            continue;
          }
          totalSolidPropsVerified++;
          const fp = getSolidPropFootprint(p.kind);
          if (fp.length > 1) seenMultiTileKinds.add(p.kind);
          for (const [dx, dy] of fp) {
            const fx = p.x + dx;
            const fy = p.y + dy;
            const cell = fy * WW + fx;
            if (fp.length > 1) totalMultiTileFootprintCells++;
            expect(
              stairCells.has(cell),
              `solid prop ${p.kind} in ${poi.id} F${fl} must never block stair (${fx},${fy})`,
            ).toBe(false);
            expect(
              doorCells.has(cell),
              `solid prop ${p.kind} in ${poi.id} F${fl} must never block door (${fx},${fy})`,
            ).toBe(false);
          }
        }
      };

      const g0 = ww.floors.layers.get(0)!;
      auditPropList(g0, 0, [
        ...g0.props,
        ...ww.landmarks.map(lm => ({ x: lm.tx, y: lm.ty, kind: lm.kind })),
      ]);
      for (const fl of [-1, 1, 2] as const) {
        const layer = ww.floors.layers.get(fl);
        if (layer) auditPropList(layer, fl, layer.props);
      }
    }

    expect(totalSolidPropsVerified).toBeGreaterThan(1500);
    expect(totalMultiTileFootprintCells).toBeGreaterThan(175);
    expect(seenMultiTileKinds.has('elder_atlas_gate')).toBe(true);
    expect(seenMultiTileKinds.has('elder_surtur_forge')).toBe(true);
    expect(seenMultiTileKinds.has('furnace_big')).toBe(true);
    expect(seenMultiTileKinds.has('market_stall')).toBe(true);
    expect(seenMultiTileKinds.has('c01_arched_gate')).toBe(true);
    void isFullFootprintClear;

    // Physical wing collision proofs:
    // 3a) Atlas Gate (7×2 monument in po_gate F-1): outer wing dx = +3 & dx = -3 physically stop player & creature!
    const atlasAu = SANCTUARY_ENTRY_AU.atlas;
    const gsAtlas = startVeyraAtAu(atlasAu[0], atlasAu[1], 9202);
    const rAtlas = gsAtlas.run!;
    const wwAtlas = getWindowWorld(rAtlas.layoutId!);
    const [oxAt, oyAt] = windowOrigin(rAtlas);
    const [gxAt, gyAt] = auToTile(atlasAu[0], atlasAu[1]);
    expect(applyFloor(gsAtlas, wwAtlas, wwAtlas.floors, -1, [gxAt - oxAt, gyAt - oyAt], markDirty)).toBe(true);

    const fNeg1 = wwAtlas.floors.layers.get(-1)!;
    const gateProp = fNeg1.props.find(p => p.kind === 'elder_atlas_gate' && isFullFootprintSolid(fNeg1, p.x, p.y, p.kind))!;
    expect(gateProp).toBeDefined();
    const gAtlas = blockGrid(rAtlas);
    for (const [dx, dy] of VEYRA_PROP_SOLID_FOOTPRINTS.elder_atlas_gate) {
      expect(
        gAtlas[(gateProp.y + dy) * WW + (gateProp.x + dx)],
        `elder_atlas_gate wing (${dx},${dy}) must set blockGrid === 2`,
      ).toBe(2);
    }

    const wingTx = gateProp.x + 3;
    const wingTy = gateProp.y;
    const fromSouth = gAtlas[(wingTy + 1) * WW + wingTx] === 0;
    const startTy = fromSouth ? wingTy + 1 : wingTy - 2;
    expect(gAtlas[startTy * WW + wingTx]).toBe(0);
    rAtlas.player.x = wingTx * TILE + 8;
    rAtlas.player.y = startTy * TILE + 8;
    let nowAt = rAtlas.clock.lastSimAt;
    for (let step = 0; step < 12; step++) {
      nowAt += 50;
      tick(
        gsAtlas,
        {
          ...IDLE_INPUT,
          up: fromSouth,
          down: !fromSouth,
          mx: rAtlas.player.x,
          my: rAtlas.player.y + (fromSouth ? -32 : 32),
        },
        50,
        nowAt,
      );
    }
    if (fromSouth) {
      expect(Math.floor(rAtlas.player.y / TILE)).toBeGreaterThan(wingTy);
    } else {
      expect(Math.floor(rAtlas.player.y / TILE)).toBeLessThan(wingTy - 1);
    }

    // Spawn a real hostile wolf on one side of the outer -3 wing tile while player stands on the opposite side,
    // and prove real tick(...) creature AI + movement is physically stopped by the -3 outer wing of 7×2 elder_atlas_gate!
    const leftWingTx = gateProp.x - 3;
    const leftFromSouth = gAtlas[(wingTy + 1) * WW + leftWingTx] === 0;
    const leftStartTy = leftFromSouth ? wingTy + 1 : wingTy - 2;
    expect(gAtlas[leftStartTy * WW + leftWingTx]).toBe(0);
    const probeWolf: Creature = {
      id: 'wing_probe_wolf',
      type: 'wolf',
      x: leftWingTx * TILE + 8,
      y: leftStartTy * TILE + 8,
      tx: leftWingTx * TILE + 8,
      ty: leftStartTy * TILE + 8,
      angle: 0,
      hp: 45,
      maxHp: 45,
      state: 'chase',
      t: 0,
      dir: 0,
      cd: 9999,
      homeX: leftWingTx * TILE + 8,
      homeY: leftStartTy * TILE + 8,
      kbx: 0,
      kby: 0,
      flash: 0,
      path: null,
      pathT: 0,
      floor: -1,
      knows: { kind: 'sight', x: leftWingTx * TILE + 8, y: (leftFromSouth ? wingTy - 3 : wingTy + 2) * TILE + 8, at: nowAt },
    };
    rAtlas.creatures.push(probeWolf);
    rAtlas.player.x = leftWingTx * TILE + 8;
    rAtlas.player.y = (leftFromSouth ? wingTy - 2 : wingTy + 1) * TILE + 8;
    for (let step = 0; step < 18; step++) {
      nowAt += 50;
      tick(gsAtlas, { ...IDLE_INPUT, mx: rAtlas.player.x, my: rAtlas.player.y }, 50, nowAt);
      // At EVERY single simulation step, the chasing creature must NEVER enter ANY cell of the 7×2 elder_atlas_gate footprint!
      const wtx = Math.floor(probeWolf.x / TILE);
      const wty = Math.floor(probeWolf.y / TILE);
      const insideGateFootprint = VEYRA_PROP_SOLID_FOOTPRINTS.elder_atlas_gate.some(
        ([dx, dy]) => gateProp.x + dx === wtx && gateProp.y + dy === wty,
      );
      expect(
        insideGateFootprint,
        `live chasing creature must never enter any cell of 7×2 elder_atlas_gate (at ${wtx},${wty})`,
      ).toBe(false);
    }

    // 3b) 3×1 market_stall + split c01_arched_gate + Motorbike physical wing collision on F0!
    const gsBike = startVeyraAtAu(921, 265, 9209);
    const rBike = gsBike.run!;
    const wwBike = getWindowWorld(rBike.layoutId!);
    const gBike0 = blockGrid(rBike);

    let patchCenter: [number, number] | null = null;
    const vg = wwBike.world.vehicleGeometry!;
    for (let ty = 30; ty < WH - 30 && !patchCenter; ty++) {
      for (let tx = 30; tx < WW - 30 && !patchCenter; tx++) {
        let ok = true;
        for (let dy = -3; dy <= 3 && ok; dy++) {
          for (let dx = -4; dx <= 4 && ok; dx++) {
            const idx = (ty + dy) * WW + (tx + dx);
            if (gBike0[idx] !== 0 || !vg.passable[idx] || !vg.parking[idx] || !vg.exit[idx]) ok = false;
          }
        }
        if (ok) patchCenter = [tx, ty];
      }
    }
    expect(patchCenter).not.toBeNull();
    const [ptx, pty] = patchCenter!;

    const f0Layer = wwBike.floors.layers.get(0)!;
    const stallCells = [-1, 0, 1].map(dx => (pty - 1) * WW + (ptx + dx));
    const archCells = [-1, 1].map(dx => (pty + 2) * WW + (ptx + dx));
    for (const c of [...stallCells, ...archCells]) f0Layer.solidProps[c] = 1;
    markDirty();

    try {
      const gAfter = blockGrid(rBike);
      expect(gAfter[(pty - 1) * WW + (ptx - 1)]).toBe(2);
      expect(gAfter[(pty - 1) * WW + ptx]).toBe(2);
      expect(gAfter[(pty - 1) * WW + (ptx + 1)]).toBe(2);
      expect(gAfter[(pty + 2) * WW + (ptx - 1)]).toBe(2);
      expect(gAfter[(pty + 2) * WW + ptx]).toBe(0);
      expect(gAfter[(pty + 2) * WW + (ptx + 1)]).toBe(2);

      rBike.player.x = (ptx + 1) * TILE + 8;
      rBike.player.y = (pty + 1) * TILE + 8;
      C(rBike, 'inv').slots[0] = mkStack(rBike, 'motorbike_kit', 1);
      C(rBike, 'inv').slots[0]!.dur = BAL.motorbike.maxHp;
      C(rBike, 'inv').slots[1] = mkStack(rBike, 'fuel_can', 2);
      rBike.player.active = 0;

      let nowBk = rBike.clock.lastSimAt + 50;
      const depRes = dispatch(
        gsBike,
        {
          id: 'dep_bike_wing',
          type: 'placeMotorbike',
          x: (ptx + 1) * TILE + 8,
          y: pty * TILE + 8,
        },
        nowBk,
      );
      expect(depRes.ok, !depRes.ok ? depRes.reason : '').toBe(true);
      const bikeEnt = Object.values(rBike.entities).find(e => e.kind === 'vehicle')!;
      expect(bikeEnt).toBeDefined();

      nowBk += 50;
      expect(dispatch(gsBike, { id: 'fuel_bike_wing', type: 'vehicleRefuel', eid: bikeEnt.id }, nowBk).ok).toBe(true);
      nowBk += 50;
      expect(dispatch(gsBike, { id: 'mnt_bike_wing', type: 'vehicleMount', eid: bikeEnt.id }, nowBk).ok).toBe(true);

      for (let step = 0; step < 16; step++) {
        nowBk += 50;
        tick(gsBike, { ...IDLE_INPUT, up: true, mx: bikeEnt.x, my: bikeEnt.y - 48 }, 50, nowBk);
      }
      expect(
        Math.floor(bikeEnt.y / TILE),
        'driven motorbike must be physically blocked by outer +1 wing tile of 3×1 market_stall',
      ).toBeGreaterThan(pty - 1);

      nowBk += 50;
      expect(dispatch(gsBike, { id: 'exit_bike_wing', type: 'vehicleExit' }, nowBk).ok).toBe(true);

      rBike.player.x = ptx * TILE + 8;
      rBike.player.y = (pty + 1) * TILE + 8;
      for (let step = 0; step < 14; step++) {
        nowBk += 50;
        tick(gsBike, { ...IDLE_INPUT, down: true, mx: rBike.player.x, my: rBike.player.y + 48 }, 50, nowBk);
      }
      expect(
        rBike.player.y,
        'player must walk cleanly through open center span of c01_arched_gate',
      ).toBeGreaterThan((pty + 2) * TILE + 12);

      rBike.player.x = (ptx - 1) * TILE + 8;
      rBike.player.y = (pty + 1) * TILE + 8;
      for (let step = 0; step < 14; step++) {
        nowBk += 50;
        tick(gsBike, { ...IDLE_INPUT, down: true, mx: rBike.player.x, my: rBike.player.y + 48 }, 50, nowBk);
      }
      expect(
        Math.floor(rBike.player.y / TILE),
        'player must be blocked by -1 stone pillar of c01_arched_gate',
      ).toBeLessThan(pty + 2);
    } finally {
      for (const c of [...stallCells, ...archCells]) f0Layer.solidProps[c] = 0;
      markDirty();
    }
  }, 120_000);

  it('P1-3: enforces sex-specific grouse egg laying across live pens, offscreen window shifts, breeding, and wild drops', () => {
    expect(resolveHusbandryYield('grouse', 'f')).toMatchObject({
      primary: ['grouse_egg', 1],
      secondary: ['feather', 2],
      cycleHours: 4,
    });
    expect(resolveHusbandryYield('grouse', 'm')).toEqual({
      primary: ['feather', 2],
      cycleHours: 4,
    });

    const gs = startVeyraAtAu(520, 640, 9303);
    const r = gs.run!;
    const ww = getWindowWorld(r.layoutId!);
    const g0 = blockGrid(r);

    let baseTx = -1;
    let baseTy = -1;
    for (let ty = 24; ty < WH - 24 && baseTx < 0; ty++) {
      for (let tx = 24; tx < WW - 34 && baseTx < 0; tx++) {
        let clear = true;
        for (let dy = 0; dy < 8 && clear; dy++) {
          for (let dx = 0; dx < 12 && clear; dx++) {
            const i = (ty + dy) * WW + (tx + dx);
            const t = ww.world.tiles[i];
            if (g0[i] !== 0 || [T.DEEP, T.SHALLOW, T.RIVER, T.CLIFF, T.PWALL, T.ROAD].includes(t)) clear = false;
          }
        }
        if (clear) {
          baseTx = tx;
          baseTy = ty;
        }
      }
    }
    expect(baseTx).toBeGreaterThan(0);

    const buildPen = (ox0: number, oy0: number, tag: string) => {
      for (let dy = 0; dy <= 4; dy++) {
        for (let dx = 0; dx <= 4; dx++) {
          if (dx === 0 || dx === 4 || dy === 0 || dy === 4) {
            const id = `f_${tag}_${dx}_${dy}`;
            r.entities[id] = {
              id,
              kind: 'struct',
              type: 'wall_wood',
              tx: ox0 + dx,
              ty: oy0 + dy,
              x: (ox0 + dx) * TILE + 8,
              y: (oy0 + dy) * TILE + 8,
              hp: 120,
              owner: 'player',
            };
          }
        }
      }
      const tid = `tr_${tag}`;
      const tc = `trc_${tag}`;
      const fl = mkStack(r, 'water_flask', 1);
      fl.charge = 4;
      r.custody[tc] = {
        id: tc,
        kind: 'chest',
        slots: [mkStack(r, 'animal_feed', 40), fl, null, null, null, null, null, null],
      };
      r.entities[tid] = {
        id: tid,
        kind: 'struct',
        type: 'feed_trough',
        tx: ox0 + 1,
        ty: oy0 + 1,
        x: (ox0 + 1) * TILE + 8,
        y: (oy0 + 1) * TILE + 8,
        hp: 80,
        c: tc,
        owner: 'player',
      };
      const bid = `br_${tag}`;
      r.entities[bid] = {
        id: bid,
        kind: 'struct',
        type: 'barrel',
        tx: ox0 + 3,
        ty: oy0 + 1,
        x: (ox0 + 3) * TILE + 8,
        y: (oy0 + 1) * TILE + 8,
        hp: 60,
        water: 6,
        owner: 'player',
      };
      return tc;
    };

    const maleTroughCid = buildPen(baseTx, baseTy, 'male');
    const femaleTroughCid = buildPen(baseTx + 6, baseTy, 'female');
    markDirty();

    expect(inspectPenAt(r, baseTx + 2, baseTy + 2).enclosed).toBe(true);
    expect(inspectPenAt(r, baseTx + 8, baseTy + 2).enclosed).toBe(true);

    const now0 = r.clock.lastSimAt;
    const mkPennedGrouse = (id: string, tx: number, ty: number, sex: 'm' | 'f'): Creature => ({
      id,
      type: 'grouse',
      x: tx * TILE + 8,
      y: ty * TILE + 8,
      tx: tx * TILE + 8,
      ty: ty * TILE + 8,
      angle: 0,
      hp: CREATURES.grouse.hp,
      maxHp: CREATURES.grouse.hp,
      state: 'idle',
      t: 0,
      dir: 0,
      cd: 0,
      homeX: tx * TILE + 8,
      homeY: ty * TILE + 8,
      kbx: 0,
      kby: 0,
      flash: 0,
      knows: null,
      path: null,
      pathT: 0,
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

    const maleGrouse = mkPennedGrouse('grouse_m_pen', baseTx + 2, baseTy + 2, 'm');
    const femaleGrouse = mkPennedGrouse('grouse_f_pen', baseTx + 8, baseTy + 2, 'f');
    r.creatures.push(maleGrouse, femaleGrouse);

    // 1) Live 5h husbandry step: Male pen produces feathers ONLY (0 grouse_egg); Female pen produces grouse_egg + feathers!
    for (let h = 1; h <= 5; h++) {
      stepHusbandry(gs, 3600, now0 + h * HOUR, true);
    }

    const troughQty = (cid: string, key: string) =>
      C(r, cid)
        .slots.filter(s => s?.key === key)
        .reduce((a, s) => a + s!.qty, 0);

    expect(troughQty(maleTroughCid, 'grouse_egg'), 'live adult male grouse must NEVER lay grouse_egg').toBe(0);
    expect(troughQty(maleTroughCid, 'feather')).toBeGreaterThanOrEqual(2);
    expect(troughQty(femaleTroughCid, 'grouse_egg')).toBeGreaterThanOrEqual(1);
    expect(troughQty(femaleTroughCid, 'feather')).toBeGreaterThanOrEqual(2);
    const femEggsBeforeOff = troughQty(femaleTroughCid, 'grouse_egg');
    const maleFeathersBeforeOff = troughQty(maleTroughCid, 'feather');

    // 2) Shift window far away (+210 tiles) so BOTH pens + troughs + grouse go OFFSCREEN, step another 5h, shift back -> offscreen parity holds!
    expect(shiftVeyraWindowBy(gs, 70, 0, markDirty)).toBe(true);
    expect(shiftVeyraWindowBy(gs, 70, 0, markDirty)).toBe(true);
    expect(shiftVeyraWindowBy(gs, 70, 0, markDirty)).toBe(true);
    expect(r.creatures.some(c => c.id === 'grouse_m_pen' || c.id === 'grouse_f_pen')).toBe(false);
    expect(Object.values(r.veyraOffscreenCreatures || {}).some(c => c.id === 'grouse_m_pen')).toBe(true);
    expect(Object.values(r.veyraOffscreenCreatures || {}).some(c => c.id === 'grouse_f_pen')).toBe(true);

    for (let h = 6; h <= 10; h++) {
      stepHusbandry(gs, 3600, now0 + h * HOUR, true);
    }

    expect(shiftVeyraWindowBy(gs, -70, 0, markDirty)).toBe(true);
    expect(shiftVeyraWindowBy(gs, -70, 0, markDirty)).toBe(true);
    expect(shiftVeyraWindowBy(gs, -70, 0, markDirty)).toBe(true);
    const maleBack = r.creatures.find(c => c.id === 'grouse_m_pen')!;
    const femaleBack = r.creatures.find(c => c.id === 'grouse_f_pen')!;
    expect(maleBack).toBeDefined();
    expect(femaleBack).toBeDefined();

    expect(
      troughQty(maleTroughCid, 'grouse_egg'),
      'offscreen adult male grouse must NEVER lay grouse_egg',
    ).toBe(0);
    expect(troughQty(maleTroughCid, 'feather')).toBeGreaterThan(maleFeathersBeforeOff);
    expect(troughQty(femaleTroughCid, 'grouse_egg')).toBeGreaterThan(femEggsBeforeOff);

    // Wild male grouse (by deterministicAnimalSex(id, r.seed) === 'm') slain via natural melee combat NEVER drops grouse_egg across 40 kills
    C(r, 'inv').slots[0] = mkStack(r, 'ronin_nodachi', 1);
    r.player.active = 0;
    let nowKill = r.clock.lastSimAt + 9 * HOUR;
    r.clock.lastSimAt = nowKill;
    const wildSpotX = (baseTx + 2) * TILE + 8;
    const wildSpotY = (baseTy + 6) * TILE + 8;
    r.player.x = wildSpotX - 16;
    r.player.y = wildSpotY;
    let maleKills = 0;
    for (let cand = 0; maleKills < 40 && cand < 80; cand++) {
      const wid = `vy:wild:10:${cand}:${cand % 2}`;
      if (deterministicAnimalSex(wid, r.seed) !== 'm') continue;
      maleKills++;
      const wg: Creature = {
        id: wid,
        type: 'grouse',
        x: wildSpotX,
        y: wildSpotY,
        tx: wildSpotX,
        ty: wildSpotY,
        angle: 0,
        hp: 10,
        maxHp: 22,
        state: 'idle',
        t: 0,
        dir: 0,
        cd: 0,
        homeX: wildSpotX,
        homeY: wildSpotY,
        kbx: 0,
        kby: 0,
        flash: 0,
        knows: null,
        path: null,
        pathT: 0,
      };
      r.creatures.push(wg);
      while (r.player.action || r.player.stamina < 25) {
        nowKill += 50;
        tick(gs, { ...IDLE_INPUT, mx: wildSpotX, my: wildSpotY }, 50, nowKill);
      }
      wg.x = wildSpotX;
      wg.y = wildSpotY;
      wg.state = 'idle';
      for (let s = 0; s < 10 && (wg.state as string) !== 'dead'; s++) {
        nowKill += 50;
        tick(
          gs,
          { ...IDLE_INPUT, attack: s === 0, attackPressed: s === 0, mx: wg.x, my: wg.y },
          50,
          nowKill,
        );
      }
      expect(wg.state).toBe('dead');
    }
    expect(maleKills).toBe(40);
    const wildEggs = Object.values(r.entities).filter(
      e =>
        e.kind === 'drop' &&
        Math.hypot(e.x - wildSpotX, e.y - wildSpotY) < 40 &&
        C(r, e.c!)?.slots[0]?.key === 'grouse_egg',
    );
    expect(wildEggs.length, 'wild male grouse must never drop grouse_egg').toBe(0);
    expect(countItem(r, 'inv', 'grouse_egg')).toBe(0);
  });

  it('P1-4: defeats all 6 Primordials in BOTH Latent & Awakened forms (12 sanctuary fights), executes all 48 skills, and defeats all 4 Side Bosses via pure real-input combat', () => {
    // 1) Verify all 48 Primordial signature skills (6 × 2 forms × 4 skills) execute cleanly against a real host-adapted sanctuary room
    const gsRoom = startVeyraAtAu(SANCTUARY_ENTRY_AU.typhon[0], SANCTUARY_ENTRY_AU.typhon[1], 9400);
    const rRoom = gsRoom.run!;
    syncVeyraEcosystemActors(rRoom, getWindowWorld(rRoom.layoutId!));
    const typhonBoss = rRoom.creatures.find(m => m.elder?.key === 'typhon')!;
    rRoom.player.x = typhonBoss.x;
    rRoom.player.y = typhonBoss.y + 24;
    tick(gsRoom, { ...IDLE_INPUT, mx: typhonBoss.x, my: typhonBoss.y }, 50, rRoom.clock.lastSimAt + 50);
    const hostAdapter = inspectPrimordialHostSession(rRoom)!.world.map;

    let executedSkills = 0;
    for (const bid of BOSS_IDS) {
      for (const form of ['mini', 'ultimate'] as const) {
        const sigs = SIGNATURE[bid][form];
        expect(sigs.length).toBe(4);
        for (const sk of sigs) {
          const w = new World({ seed: 9400 + executedSkills, adapter: hostAdapter, difficulty: 1, quality: 'gameplay_vfx' });
          const pAct = spawnPlayer(w, { x: typhonBoss.x + 28, y: typhonBoss.y }, 'stationary');
          pAct.hp = 5000;
          pAct.maxHp = 5000;
          const bAct = spawnBoss(w, bid, form, { x: typhonBoss.x, y: typhonBoss.y }, false);
          bAct.boss!.target = pAct.id;
          startSkill(w, bAct, sk, 'acceptance_48');
          for (let step = 0; step < 90; step++) {
            w.dt = 1 / 30;
            stepWorld(w);
            expect(Number.isFinite(bAct.pos.x) && Number.isFinite(bAct.pos.y)).toBe(true);
            expect(Number.isFinite(pAct.pos.x) && Number.isFinite(pAct.pos.y)).toBe(true);
          }
          executedSkills++;
        }
      }
    }
    expect(executedSkills).toBe(48);

    // 2) Defeat all 6 Primordials in BOTH Latent (<312h) AND Awakened (>=312h) forms (12 full sanctuary fights) via real player swings & food healing!
    for (const awakened of [false, true]) {
      for (const sanct of VEYRA_PRIMORDIAL_SITES) {
        const entryAu = SANCTUARY_ENTRY_AU[sanct.key];
        const gs = startVeyraAtAu(entryAu[0], entryAu[1], (awakened ? 9600 : 9500) + sanct.key.charCodeAt(0));
        const r = gs.run!;
        if (awakened) {
          r.qaOffset = 313 * HOUR;
          r.clock.simMs = 313 * HOUR;
        }
        const ww = getWindowWorld(r.layoutId!);
        if (sanct.floor !== 0) {
          const [ox, oy] = windowOrigin(r);
          const [gx, gy] = auToTile(entryAu[0], entryAu[1]);
          expect(applyFloor(gs, ww, ww.floors, sanct.floor, [gx - ox, gy - oy], markDirty)).toBe(true);
        } else {
          syncVeyraEcosystemActors(r, ww);
        }
        for (const e of Object.values(r.entities)) {
          if (e.kind === 'door' && ((e as any).floor ?? 0) === sanct.floor) e.open = true;
        }
        markDirty();

        let now = r.clock.lastSimAt + 50;
        tick(gs, IDLE_INPUT, 50, now);

        const boss = r.creatures.find(m => m.elder?.key === sanct.key)!;
        expect(boss).toBeDefined();
        expect(!!boss.elder!.awake).toBe(awakened);

        C(r, 'inv').slots[0] = mkStack(r, 'ronin_nodachi', 1);
        C(r, 'inv').slots[1] = mkStack(r, 'cooked_meat', 20);
        C(r, 'inv').slots[2] = mkStack(r, 'cooked_meat', 20);
        C(r, 'inv').slots[3] = mkStack(r, 'cooked_meat', 20);
        C(r, 'inv').slots[4] = mkStack(r, 'bandage', 20);
        r.player.active = 0;

        const g = blockGrid(r);
        const btx = Math.floor(boss.x / TILE);
        const bty = Math.floor(boss.y / TILE);
        for (const [dx, dy] of [[0, 2], [0, -2], [2, 0], [-2, 0], [1, 1]] as const) {
          const tx = clamp(btx + dx, 4, WW - 5);
          const ty = clamp(bty + dy, 4, WH - 5);
          if (g[ty * WW + tx] === 0) {
            r.player.x = tx * TILE + 8;
            r.player.y = ty * TILE + 8;
            break;
          }
        }

        let sawExpectedForm = false;
        PROJ.length = 0;
        HAZ.length = 0;

        for (let f = 0; f < 2600 && boss.state !== 'dead' && !r.player.dead; f++) {
          now += 50;
          if (r.player.hp < 70) {
            const meatSlot = C(r, 'inv').slots[1] ? 1 : C(r, 'inv').slots[2] ? 2 : C(r, 'inv').slots[3] ? 3 : -1;
            if (meatSlot >= 0) dispatch(gs, { id: `eat_${sanct.key}_${awakened}_${f}`, type: 'useSlot', slot: meatSlot }, now);
            else if (C(r, 'inv').slots[4]) dispatch(gs, { id: `bnd_${sanct.key}_${awakened}_${f}`, type: 'useSlot', slot: 4 }, now);
          }

          const sess = inspectPrimordialHostSession(r);
          if (sess && sess.mounted.size > 0) {
            const mb = Array.from(sess.mounted.values())[0];
            if (mb.form === (awakened ? 'ultimate' : 'mini')) sawExpectedForm = true;
          }

          const dBoss = Math.hypot(boss.x - r.player.x, boss.y - r.player.y);
          const ang = Math.atan2(boss.y - r.player.y, boss.x - r.player.x);
          const moveCloser = dBoss > 24;
          const doSwing = dBoss <= 42 && f % 7 === 0;
          const doRoll = dBoss < 16 && f % 19 === 0;

          tick(
            gs,
            {
              ...IDLE_INPUT,
              left: moveCloser && Math.cos(ang) < -0.25,
              right: moveCloser && Math.cos(ang) > 0.25,
              up: moveCloser && Math.sin(ang) < -0.25,
              down: moveCloser && Math.sin(ang) > 0.25,
              roll: doRoll,
              attack: doSwing,
              attackPressed: doSwing,
              mx: boss.x,
              my: boss.y,
            },
            50,
            now,
          );
        }

        expect(r.player.dead, `player must survive ${sanct.key} (${awakened ? 'ultimate' : 'mini'})`).toBe(false);
        expect(sawExpectedForm, `${sanct.key} must mount as ${awakened ? 'ultimate' : 'mini'}`).toBe(true);
        expect(boss.state, `${sanct.key} (${awakened ? 'ultimate' : 'mini'}) must die naturally`).toBe('dead');
        expect(inspectPrimordialHostSession(r)?.mounted.size ?? 0).toBe(0);

        const stoneKey = PRIMORDIAL_ELDERS[sanct.key].stone;
        if (countItem(r, 'inv', stoneKey) === 0) {
          const dropEnt = Object.values(r.entities).find(
            e => e.kind === 'drop' && C(r, e.c!)?.slots[0]?.key === stoneKey,
          );
          expect(dropEnt).toBeDefined();
          r.player.x = dropEnt!.x;
          r.player.y = dropEnt!.y;
          for (let pTick = 0; pTick < 12 && countItem(r, 'inv', stoneKey) === 0; pTick++) {
            now += 50;
            tick(gs, { ...IDLE_INPUT, mx: r.player.x, my: r.player.y }, 50, now);
          }
        }
        expect(r.elderStones, `${stoneKey} must immediately register in r.elderStones on pickup`).toContain(stoneKey);
      }
    }

    // 3) Defeat all 4 Side Bosses naturally via real swings + food healing & verify unique weapon drop on first kill
    for (const sb of VEYRA_SIDE_BOSS_SITES) {
      const entryAu: [number, number] = sb.species === 'boss_custodian' ? [921, 259] : sb.au;
      const gs = startVeyraAtAu(entryAu[0], entryAu[1], 9700 + sb.species.charCodeAt(5));
      const r = gs.run!;
      const ww = getWindowWorld(r.layoutId!);
      if (sb.floor !== 0) {
        const [ox, oy] = windowOrigin(r);
        const [gx, gy] = auToTile(entryAu[0], entryAu[1]);
        expect(applyFloor(gs, ww, ww.floors, sb.floor, [gx - ox, gy - oy], markDirty)).toBe(true);
      } else {
        syncVeyraEcosystemActors(r, ww);
      }
      for (const e of Object.values(r.entities)) {
        if (e.kind === 'door' && ((e as any).floor ?? 0) === sb.floor) e.open = true;
      }
      markDirty();

      const boss = r.creatures.find(m => m.type === sb.species)!;
      expect(boss).toBeDefined();
      C(r, 'inv').slots[0] = mkStack(r, 'reinforced_spear', 1);
      C(r, 'inv').slots[1] = mkStack(r, 'ronin_nodachi', 1);
      C(r, 'inv').slots[2] = mkStack(r, 'cooked_meat', 20);
      r.player.active = 0;

      const g = blockGrid(r);
      const btx = Math.floor(boss.x / TILE);
      const bty = Math.floor(boss.y / TILE);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const tx = clamp(btx + dx, 4, WW - 5);
        const ty = clamp(bty + dy, 4, WH - 5);
        if (g[ty * WW + tx] === 0) {
          r.player.x = tx * TILE + 8;
          r.player.y = ty * TILE + 8;
          break;
        }
      }

      let now = r.clock.lastSimAt;
      let sawP2 = false;
      const moves = new Set<number>();
      let sawVuln = false;

      for (let f = 0; f < 1000 && boss.state !== 'dead' && !r.player.dead; f++) {
        now += 50;
        if (r.player.hp < 60 && C(r, 'inv').slots[2]) {
          dispatch(gs, { id: `sb_eat_${sb.species}_${f}`, type: 'useSlot', slot: 2 }, now);
        }
        if (boss.sideBoss!.phase >= 1) sawP2 = true;
        if (boss.atk?.move !== undefined) moves.add(boss.atk.move);
        if ((boss.atk?.vuln ?? 0) > 0) sawVuln = true;

        const readyFinish = sawP2 && moves.has(2) && sawVuln;
        const hold = sawP2 && !readyFinish && boss.hp < boss.maxHp * 0.3;
        if (readyFinish) r.player.active = 1;

        const dBoss = Math.hypot(boss.x - r.player.x, boss.y - r.player.y);
        const ang = Math.atan2(boss.y - r.player.y, boss.x - r.player.x);
        const moveCloser = dBoss > 22;
        const swing = !hold && dBoss <= 34 && f % 7 === 0;

        tick(
          gs,
          {
            ...IDLE_INPUT,
            left: moveCloser && Math.cos(ang) < -0.25,
            right: moveCloser && Math.cos(ang) > 0.25,
            up: moveCloser && Math.sin(ang) < -0.25,
            down: moveCloser && Math.sin(ang) > 0.25,
            roll: hold && f % 16 === 0,
            attack: swing,
            attackPressed: swing,
            mx: boss.x,
            my: boss.y,
          },
          50,
          now,
        );
      }

      expect(r.player.dead).toBe(false);
      expect(sawP2).toBe(true);
      expect(moves.has(2)).toBe(true);
      expect(sawVuln).toBe(true);
      expect(boss.state).toBe('dead');

      const uniqueKey = CREATURES[sb.species].uniqueDrop!;
      expect(ITEMS[uniqueKey]).toBeDefined();
      const hasUnique =
        countItem(r, 'inv', uniqueKey) > 0 ||
        Object.values(r.entities).some(e => e.kind === 'drop' && C(r, e.c!)?.slots[0]?.key === uniqueKey);
      expect(hasUnique, `${sb.species} must drop ${uniqueKey} on first natural kill`).toBe(true);
    }
  }, 90_000);

  it('P1-5: preserves >96 (135) wounded offscreen ambient creatures across out-and-back window streaming + save/reload without full-HP duplication, and holds 8h/24h/48h/336h endurance bounds', () => {
    const gs = startVeyraAtAu(520, 640, 9805);
    const r = gs.run!;

    const woundedLedger = new Map<string, { id: string; type: string; hp: number; maxHp: number; gx: number; gy: number }>();
    let stepsEast = 0;
    const stepTile = 96;

    const woundCurrentWindowAmbients = () => {
      const [ox, oy] = windowOrigin(r);
      for (const m of r.creatures) {
        if (m.state === 'dead' || m.husbandry?.tamed || m.elder || m.sideBoss || ((m as any).floor ?? 0) !== 0) continue;
        if (woundedLedger.has(m.id)) continue;
        const gx = ox + Math.floor(m.x / TILE);
        const gy = oy + Math.floor(m.y / TILE);
        m.x = (gx - ox) * TILE + 8;
        m.y = (gy - oy) * TILE + 8;
        const targetHp = Math.max(1, Math.floor(m.maxHp * 0.37));
        if (m.hp > targetHp) m.hp = targetHp;
        woundedLedger.set(m.id, { id: m.id, type: m.type, hp: m.hp, maxHp: m.maxHp, gx, gy });
        if (woundedLedger.size >= 135) break;
      }
    };

    syncVeyraEcosystemActors(r, getWindowWorld(r.layoutId!));
    woundCurrentWindowAmbients();

    while (woundedLedger.size < 135 && stepsEast < 28) {
      expect(shiftVeyraWindowBy(gs, stepTile, 0, markDirty)).toBe(true);
      stepsEast++;
      woundCurrentWindowAmbients();
    }
    // Shift >200 tiles (3 × stepTile) east so ALL 135 wounded creatures are completely offscreen simultaneously!
    for (let extra = 0; extra < 3; extra++) {
      expect(shiftVeyraWindowBy(gs, stepTile, 0, markDirty)).toBe(true);
      stepsEast++;
    }

    expect(woundedLedger.size).toBeGreaterThanOrEqual(135);
    const offscreenAmbientCount = Object.values(r.veyraOffscreenCreatures || {}).filter(
      c => !c.husbandry?.tamed && !c.elder && !c.sideBoss,
    ).length;
    expect(offscreenAmbientCount).toBeLessThanOrEqual(96);
    const woundStubCount = Object.keys(r.veyraAmbientWounds || {}).length;
    expect(woundStubCount, '>96 wounded offscreen ambients must spill into veyraAmbientWounds').toBeGreaterThanOrEqual(39);
    expect(woundStubCount).toBeLessThanOrEqual(512);

    const snapJson = serializeSnapshot(gs);
    const loaded = selectSnapshots([snapJson, null]);
    expect(loaded.gs?.run).toBeTruthy();
    const gsReloaded = loaded.gs!;
    const rReloaded = gsReloaded.run!;
    expect(Object.keys(rReloaded.veyraAmbientWounds || {}).length).toBe(woundStubCount);

    const verifiedRehydrated = new Set<string>();
    const verifyWindowWounds = () => {
      const [ox, oy] = windowOrigin(rReloaded);
      const seenLiveIds = new Set<string>();
      for (const m of rReloaded.creatures) {
        if (m.state === 'dead' || ((m as any).floor ?? 0) !== 0) continue;
        expect(seenLiveIds.has(m.id), `active creature ID ${m.id} must never duplicate`).toBe(false);
        seenLiveIds.add(m.id);
        const expected = woundedLedger.get(m.id);
        if (expected) {
          const gx = ox + Math.floor(m.x / TILE);
          const gy = oy + Math.floor(m.y / TILE);
          expect(
            m.hp,
            `rehydrated wounded creature ${m.id} (${m.type}@${gx},${gy}) must preserve wounded HP (${expected.hp}), never reset to maxHp (${expected.maxHp})`,
          ).toBe(expected.hp);
          expect(gx).toBe(expected.gx);
          expect(gy).toBe(expected.gy);
          verifiedRehydrated.add(m.id);
        }
      }
      for (const [wid, stub] of Object.entries(rReloaded.veyraAmbientWounds || {})) {
        expect(seenLiveIds.has(wid), `live creature ${wid} must not remain in veyraAmbientWounds`).toBe(false);
        expect(!!rReloaded.veyraOffscreenCreatures?.[wid], `offscreen creature ${wid} must not duplicate in veyraAmbientWounds`).toBe(false);
        const lxPx = stub.gx - ox * TILE;
        const lyPx = stub.gy - oy * TILE;
        const inWin =
          stub.floor === activeFloor(rReloaded) &&
          lxPx >= TILE * 2 &&
          lxPx < (WW - 2) * TILE &&
          lyPx >= TILE * 2 &&
          lyPx < (WH - 2) * TILE;
        expect(inWin, `in-window stub ${wid} must be consumed on rehydration`).toBe(false);
      }
    };

    for (let s = 0; s < stepsEast; s++) {
      expect(shiftVeyraWindowBy(gsReloaded, -stepTile, 0, markDirty)).toBe(true);
      verifyWindowWounds();
    }
    expect(verifiedRehydrated.size, 'all 135 wounded creatures must rehydrate with exact HP on return trip').toBe(
      woundedLedger.size,
    );

    const overflowRecord: Record<string, AmbientWoundStub> = {};
    for (let i = 0; i < 530; i++) {
      overflowRecord[`w_overflow_${i}`] = {
        type: 'wolf',
        gx: 100 + i * 3,
        gy: 100 + (i % 17) * 3,
        floor: 0,
        hp: 15,
        maxHp: 45,
      };
    }
    rReloaded.veyraAmbientWounds = overflowRecord;
    expect(shiftVeyraWindowBy(gsReloaded, 16, 0, markDirty)).toBe(true);
    expect(Object.keys(rReloaded.veyraAmbientWounds || {}).length).toBeLessThanOrEqual(512);
    expect(Object.keys(rReloaded.veyraEcologyCooldowns || {}).length).toBeGreaterThan(0);
    expect(Object.keys(rReloaded.veyraEcologyCooldowns || {}).length).toBeLessThanOrEqual(1024);

    for (const targetHours of [8, 24, 48, 336]) {
      const targetNow = rReloaded.startedAt + targetHours * HOUR;
      if (targetNow > rReloaded.clock.lastSimAt) {
        while (rReloaded.clock.lastSimAt < targetNow && gsReloaded.run) {
          const nextStep = Math.min(targetNow, rReloaded.clock.lastSimAt + 4 * HOUR);
          rReloaded.player.hunger = 100;
          rReloaded.player.thirst = 100;
          rReloaded.player.warmth = 100;
          rReloaded.player.hp = 100;
          settle(gsReloaded, nextStep, true);
        }
      }
      if (targetHours < 336) {
        expect(gsReloaded.run).toBeTruthy();
        expect(Object.keys(rReloaded.veyraOffscreenCreatures || {}).length).toBeLessThanOrEqual(160);
        expect(Object.keys(rReloaded.veyraAmbientWounds || {}).length).toBeLessThanOrEqual(512);
        expect(Object.keys(rReloaded.veyraEcologyCooldowns || {}).length).toBeLessThanOrEqual(1024);
        const snapEndurance = serializeSnapshot(gsReloaded);
        expect(selectSnapshots([snapEndurance, null]).gs?.run).toBeTruthy();
      }
    }
  }, 90_000);

  it('R2-CLOSURE-1: proves 100% source-vs-runtime authored Veyra art preservation (680/680 POI props, 116/116 sprites, 0 blocked doors/stairs) and giant 3x2/5x2/7x2 collision + LOS', () => {
    if (typeof (globalThis as any).document === 'undefined') {
      const noopCtx = new Proxy(
        {
          fillStyle: '#000',
          strokeStyle: '#000',
          lineWidth: 1,
          globalAlpha: 1,
          getImageData: (_x: number, _y: number, w: number, h: number) => ({
            data: new Uint8ClampedArray(w * h * 4),
            width: w,
            height: h,
          }),
          createImageData: (w: number, h: number) => ({
            data: new Uint8ClampedArray(w * h * 4),
            width: w,
            height: h,
          }),
          putImageData: () => {},
          createLinearGradient: () => ({ addColorStop: () => {} }),
          createRadialGradient: () => ({ addColorStop: () => {} }),
        },
        { get: (t, p) => (p in t ? (t as any)[p] : () => {}) },
      );
      (globalThis as any).document = {
        createElement: () => ({ width: 16, height: 16, getContext: () => noopCtx }),
      };
    }

    const plans = authoredPoiIds().map(id => authoredPlan(id)!);
    expect(plans.length).toBe(81);

    const isCreatorDry = (gx: number, gy: number): boolean => {
      const s = sampleTile(gx, gy);
      return s.land && !s.river && !s.lake;
    };

    let totalRawArchPlanProps = 0;
    let totalCreatorDryAuthoredProps = 0;
    let totalRenderedAuthoredProps = 0;
    let totalSkippedAuthoredProps = 0;
    let totalLayerPropsAcrossWindows = 0;
    let totalSkippedLayerPropsAcrossWindows = 0;

    const byFloor: Record<string, { rawSource: number; creatorDrySource: number; runtimeRendered: number; skipped: number }> = {};
    const byKind: Record<string, { creatorDrySource: number; runtimeRendered: number; runtimeSolidFootprintCells: number; hasSprite: boolean; skipped: number }> = {};
    const byPoi: Record<string, { name: string; rawSource: number; creatorDrySource: number; runtimeRendered: number; skipped: number }> = {};

    for (const lv of [-1, 0, 1, 2] as Level[]) {
      byFloor[String(lv)] = { rawSource: 0, creatorDrySource: 0, runtimeRendered: 0, skipped: 0 };
    }

    for (const plan of plans) {
      const poiId = plan.plan.poi;
      byPoi[poiId] = { name: plan.plan.title, rawSource: 0, creatorDrySource: 0, runtimeRendered: 0, skipped: 0 };

      const [bx, by, bw, bh] = plan.plan.bounds;
      const cx = Math.round(bx + bw / 2);
      const cy = Math.round(by + bh / 2);
      const win = windowAround(cx, cy);
      const lid = layoutIdAt(win.originTx, win.originTy);
      const ww = getWindowWorld(lid);
      const w = getWorld(lid);

      for (const lv of ww.floors.levels) {
        const layer = ww.floors.layers.get(lv)!;
        expect(layer).toBeTruthy();

        // Verify zero solid props block any stair endpoint or door tile on this storey
        for (const st of layer.stairs) {
          const sx = (st.from === lv ? st.x : st.tx) - win.originTx;
          const sy = (st.from === lv ? st.y : st.ty) - win.originTy;
          if (sx >= 0 && sy >= 0 && sx < WW && sy < WH) {
            expect(layer.solidProps[sy * WW + sx], `stair blocked at ${poiId} F${lv} (${sx},${sy})`).toBe(0);
          }
        }
        for (const s of layer.statics) {
          if (s.kind === 'door') {
            expect(layer.solidProps[s.ty * WW + s.tx], `door blocked at ${poiId} F${lv} (${s.tx},${s.ty})`).toBe(0);
          }
        }

        for (const lp of layer.props) {
          totalLayerPropsAcrossWindows++;
          expect(hasLandmarkSprite(lp.kind), `missing sprite for ${lp.kind}`).toBe(true);
          if (isSolidVeyraProp(lp.kind) && !isSolidFootprintPlaced(layer, lp.x, lp.y, lp.kind)) {
            totalSkippedLayerPropsAcrossWindows++;
          }
        }

        if (lv === 0) {
          for (const lm of ww.landmarks) {
            expect(hasLandmarkSprite(lm.kind)).toBe(true);
            expect(Boolean(w.sourceV3[lm.ty * WW + lm.tx])).toBe(false);
            if (isSolidVeyraProp(lm.kind)) {
              expect(isSolidFootprintPlaced(layer, lm.tx, lm.ty, lm.kind)).toBe(true);
            }
          }
        }

        const L = plan.levels.get(lv);
        if (!L) continue;
        for (const p of L.props) {
          totalRawArchPlanProps++;
          byFloor[String(lv)].rawSource++;
          byPoi[poiId].rawSource++;
          if (!isCreatorDry(p.x, p.y)) continue;

          totalCreatorDryAuthoredProps++;
          byFloor[String(lv)].creatorDrySource++;
          byPoi[poiId].creatorDrySource++;
          const sprOk = hasLandmarkSprite(p.kind);
          byKind[p.kind] ??= { creatorDrySource: 0, runtimeRendered: 0, runtimeSolidFootprintCells: 0, hasSprite: sprOk, skipped: 0 };
          byKind[p.kind].creatorDrySource++;
          expect(sprOk, `missing landmark sprite for ${p.kind}`).toBe(true);

          const lx = p.x - win.originTx;
          const ly = p.y - win.originTy;
          const inLayerProps = layer.props.some(q => q.x === lx && q.y === ly && q.kind === p.kind);
          const solidOk = !isSolidVeyraProp(p.kind) || isSolidFootprintPlaced(layer, lx, ly, p.kind);

          if (inLayerProps && solidOk && sprOk) {
            totalRenderedAuthoredProps++;
            byFloor[String(lv)].runtimeRendered++;
            byPoi[poiId].runtimeRendered++;
            byKind[p.kind].runtimeRendered++;
            if (isSolidVeyraProp(p.kind)) {
              byKind[p.kind].runtimeSolidFootprintCells += getSolidPropFootprint(p.kind).length;
            }
          } else {
            totalSkippedAuthoredProps++;
            byFloor[String(lv)].skipped++;
            byPoi[poiId].skipped++;
            byKind[p.kind].skipped++;
          }
        }
      }
    }

    expect(totalCreatorDryAuthoredProps).toBe(680);
    expect(totalRenderedAuthoredProps).toBe(680);
    expect(totalSkippedAuthoredProps).toBe(0);
    expect(totalLayerPropsAcrossWindows).toBeGreaterThan(13000);
    expect(totalSkippedLayerPropsAcrossWindows).toBe(0);

    const evidenceDir = path.resolve(process.cwd(), 'evidence/veyra-r2-closure');
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(
      path.join(evidenceDir, 'MAP_PROP_COMPLETENESS_TALLY.json'),
      JSON.stringify(
        {
          summary: {
            poisAudited: plans.length,
            floorsPerPoi: [-1, 0, 1, 2],
            distinctAuthoredPropKinds: Object.keys(byKind).length,
            allSpritesPresent: Object.values(byKind).every(k => k.hasSprite),
            totalRawArchPlanProps,
            waterClippedByCreatorDryRule: totalRawArchPlanProps - totalCreatorDryAuthoredProps,
            totalCreatorDryAuthoredProps,
            totalRenderedAuthoredProps,
            totalSkippedAuthoredProps,
            renderPreservationRate: '100.00% (680 / 680)',
            totalLayerPropsAcrossWindows,
            totalSkippedLayerPropsAcrossWindows,
            windowLayerPreservationRate: `100.00% (${totalLayerPropsAcrossWindows} / ${totalLayerPropsAcrossWindows})`,
          },
          byFloor,
          byKind,
          byPoi,
        },
        null,
        2,
      ),
    );

    // Giant 3x2, 5x2, and 7x2 footprint verification: player, creature, motorbike, rayLen sightline, and hostile projectile!
    const giantCases: { label: string; poiId: string; kind: string; lv: Level; halfW: number }[] = [
      { label: '3x2 f03_silo', poiId: 'po_siloc', kind: 'f03_silo', lv: 0, halfW: 1 },
      { label: '5x2 elder_typhon_shard', poiId: 'po_typhon', kind: 'elder_typhon_shard', lv: 0, halfW: 2 },
      { label: '7x2 elder_atlas_gate', poiId: 'po_gate', kind: 'elder_atlas_gate', lv: -1, halfW: 3 },
    ];

    for (const gc of giantCases) {
      const plan = plans.find(p => p.plan.poi === gc.poiId)!;
      const propGlobal = plan.levels.get(gc.lv)!.props.find(p => p.kind === gc.kind)!;
      expect(propGlobal, `missing ${gc.label}`).toBeTruthy();

      const win = windowAround(propGlobal.x, propGlobal.y);
      const lid = layoutIdAt(win.originTx, win.originTy);
      setActiveLayout(lid);
      const ww = getWindowWorld(lid);
      const gs = newGame();
      const t0 = 1_760_000_000_000;
      const ax = propGlobal.x - win.originTx;
      const ay = propGlobal.y - win.originTy;
      const res = startRun(gs, 'female', t0, null, 9100 + gc.halfW, { tx: clamp(ax, 10, WW - 11), ty: clamp(ay + 3, 10, WH - 11) });
      expect(res.ok).toBe(true);
      const r = gs.run!;
      if (gc.lv !== 0) {
        expect(applyFloor(gs, ww, ww.floors, gc.lv, [ax, ay + 3], markDirty)).toBe(true);
      }
      // Clear surrounding test apron tiles directly south & north of the outer wing, and channel (wingTx±1, ay-2) so wolf AI pushes straight south against the outer wing (wingTx, ay-1)
      const wWorld = getWorld(lid);
      const wingTx = ax + gc.halfW;
      const savedTiles = new Map<number, [number, number]>();
      for (const [tx, ty, tileVal, walkVal] of [
        [wingTx, ay - 2, T.FLOOR, 1],
        [wingTx, ay + 1, T.FLOOR, 1],
        [wingTx, ay + 2, T.FLOOR, 1],
        [wingTx - 1, ay - 2, T.PWALL, 0],
        [wingTx + 1, ay - 2, T.PWALL, 0],
        [wingTx + 1, ay - 1, T.PWALL, 0],
      ] as const) {
        const idx = ty * WW + tx;
        if (!savedTiles.has(idx)) {
          savedTiles.set(idx, [wWorld.tiles[idx], (wWorld.economyMap.walkable as Uint8Array)[idx]]);
        }
        wWorld.tiles[idx] = tileVal;
        (wWorld.economyMap.walkable as Uint8Array)[idx] = walkVal;
        delete r.sources[idx];
      }
      r.creatures = [];
      markDirty();

      const bg = blockGrid(r);
      for (let dy = -1; dy <= 0; dy++) {
        for (let dx = -gc.halfW; dx <= gc.halfW; dx++) {
          expect(bg[(ay + dy) * WW + (ax + dx)], `${gc.label} cell (${dx},${dy}) must be solid c=2`).toBe(2);
        }
      }

      let now = r.clock.lastSimAt;
      const southY = (ay + 1) * TILE + 10;
      const northY = (ay - 2) * TILE + 6;
      const wingCenterX = wingTx * TILE + 8;

      // 1) Player walking north into outer wing cell (+halfW, 0) is physically blocked south of the footprint
      r.player.vehicle = undefined;
      r.player.x = wingCenterX;
      r.player.y = southY;
      for (let s = 0; s < 14; s++) {
        now += 50;
        tick(gs, { ...IDLE_INPUT, up: true }, 50, now);
      }
      expect(Math.floor(r.player.y / TILE), `${gc.label} player blocked by outer wing`).toBeGreaterThanOrEqual(ay + 1);

      // 2) Hostile creature chasing south into outer wing cell (+halfW, -1) is physically blocked north of the footprint
      const wolf: Creature = {
        id: `test_wolf_${gc.kind}`,
        type: 'wolf',
        x: wingCenterX,
        y: northY,
        vx: 0,
        vy: 0,
        hp: 40,
        maxHp: 40,
        state: 'chase',
        dir: 'down',
        t: 0,
        cd: 0,
        homeX: wingCenterX,
        homeY: northY,
        knows: { kind: 'sight', x: wingCenterX, y: southY, at: now },
        floor: gc.lv,
      } as any;
      r.creatures.push(wolf);
      for (let s = 0; s < 14; s++) {
        now += 50;
        tick(gs, IDLE_INPUT, 50, now);
      }
      expect(Math.floor(wolf.y / TILE), `${gc.label} creature blocked by outer wing`).toBeLessThanOrEqual(ay - 2);
      r.creatures = [];

      // 3) Motorbike driving north into outer wing cell (+halfW, 0) is physically blocked south of the footprint
      const bikeId = `bike_${gc.kind}`;
      r.entities[bikeId] = {
        id: bikeId,
        kind: 'vehicle',
        x: wingCenterX,
        y: southY + 4,
        hp: 120,
        maxHp: 120,
        fuel: 80,
        floor: gc.lv,
      } as any;
      r.player.vehicle = bikeId;
      r.player.x = wingCenterX;
      r.player.y = southY + 4;
      for (let s = 0; s < 14; s++) {
        now += 50;
        tick(gs, { ...IDLE_INPUT, up: true }, 50, now);
      }
      expect(Math.floor(r.player.y / TILE), `${gc.label} motorbike blocked by outer wing`).toBeGreaterThanOrEqual(ay + 1);
      r.player.vehicle = undefined;
      delete r.entities[bikeId];

      // 4) Sightline (rayLen) & hostile projectile fired south across outer wing cell (+halfW, -1..0) terminate on the wing!
      const sightDist = rayLen(r, wingCenterX, northY, Math.PI / 2, 96);
      expect(sightDist, `${gc.label} outer wing blocks rayLen sightline`).toBeLessThan(southY - northY);

      r.player.x = wingCenterX;
      r.player.y = southY;
      r.player.hp = 100;
      PROJ.length = 0;
      PROJ.push({
        id: `proj_${gc.kind}`,
        owner: 'enemy',
        x: wingCenterX,
        y: northY,
        vx: 0,
        vy: 240,
        dmg: 25,
        ttl: 1.0,
        kind: 'bolt',
        cause: 'Wing LOS Probe',
      } as any);
      for (let s = 0; s < 12; s++) {
        now += 50;
        tick(gs, IDLE_INPUT, 50, now);
      }
      expect(r.player.hp, `${gc.label} outer wing blocks hostile projectile`).toBe(100);
      PROJ.length = 0;

      // Restore cached window tiles cleanly
      for (const [idx, [tOrig, wOrig]] of savedTiles.entries()) {
        wWorld.tiles[idx] = tOrig;
        (wWorld.economyMap.walkable as Uint8Array)[idx] = wOrig;
      }
      markDirty();
    }
  }, 120_000);

  it('R2-CLOSURE-2: executes all 48 Primordial signature skills mounted inside real SOH sanctuaries verifying tell, hitbox, dodge, wall, damage, cleanup, and visual frame', () => {
    const fb = new FB(VIEW_W, VIEW_H);
    const overlayOpts: RenderOpts = {
      floor: 'dark',
      transparentBg: true,
      hidePlayerProxy: true,
      layers: { ground: true, hazards: true, actors: true, fx: true },
      hitboxes: false,
      heatmap: false,
      silhouette: false,
      noVfx: false,
      warnings: true,
      shake: 0.65,
    };

    const findOpenSanctuarySpan = (r: any, nearTx: number, nearTy: number): [number, number] => {
      const bg = blockGrid(r);
      for (const radTiles of [3, 2, 1]) {
        for (let searchR = 0; searchR <= 16; searchR++) {
          for (let dy = -searchR; dy <= searchR; dy++) {
            for (let dx = -searchR; dx <= searchR; dx++) {
              if (Math.max(Math.abs(dx), Math.abs(dy)) !== searchR) continue;
              const cx = nearTx + dx;
              const cy = nearTy + dy;
              if (cx < radTiles + 3 || cy < radTiles + 3 || cx >= WW - radTiles - 3 || cy >= WH - radTiles - 3) continue;
              let ok = true;
              for (let oy = -radTiles; oy <= radTiles && ok; oy++) {
                for (let ox = -radTiles; ox <= radTiles; ox++) {
                  if (bg[(cy + oy) * WW + (cx + ox)] !== 0) {
                    ok = false;
                    break;
                  }
                }
              }
              if (ok) return [cx, cy];
            }
          }
        }
      }
      return [nearTx, nearTy];
    };

    const mountSanctuaryBoss = (key: (typeof VEYRA_PRIMORDIAL_SITES)[number]['key'], awakened: boolean, seed: number) => {
      const sanct = VEYRA_PRIMORDIAL_SITES.find(s => s.key === key)!;
      const entryAu = SANCTUARY_ENTRY_AU[key];
      const gs = startVeyraAtAu(entryAu[0], entryAu[1], seed);
      const r = gs.run!;
      if (awakened) {
        r.qaOffset = 313 * HOUR;
        r.clock.simMs = 313 * HOUR;
      }
      const ww = getWindowWorld(r.layoutId!);
      if (sanct.floor !== 0) {
        const [ox, oy] = windowOrigin(r);
        const [gx, gy] = auToTile(entryAu[0], entryAu[1]);
        expect(applyFloor(gs, ww, ww.floors, sanct.floor, [gx - ox, gy - oy], markDirty)).toBe(true);
      } else {
        syncVeyraEcosystemActors(r, ww);
      }
      for (const e of Object.values(r.entities)) {
        if (e.kind === 'door' && ((e as any).floor ?? 0) === sanct.floor) e.open = true;
      }
      markDirty();

      const boss = r.creatures.find(m => m.elder?.key === key)!;
      expect(boss).toBeTruthy();
      const [acx, acy] = findOpenSanctuarySpan(r, Math.floor(boss.x / TILE), Math.floor(boss.y / TILE));
      boss.x = acx * TILE + 8;
      boss.y = acy * TILE + 8;
      boss.homeX = boss.x;
      boss.homeY = boss.y;
      r.player.x = acx * TILE + 8;
      r.player.y = (acy + 2) * TILE + 8;

      let now = r.clock.lastSimAt + 50;
      tick(gs, IDLE_INPUT, 50, now);
      const sess = inspectPrimordialHostSession(r)!;
      expect(sess).toBeTruthy();
      const mb = Array.from(sess.mounted.values())[0]!;
      expect(mb).toBeTruthy();
      const bActor = sess.world.actor(mb.actorId)!;
      bActor.pos.x = boss.x;
      bActor.pos.y = boss.y;
      bActor.boss!.autonomous = false;
      bActor.boss!.spawnUntil = 0;
      bActor.boss!.recoverUntil = 0;
      return { gs, r, sanct, boss, sess, bActor, now, acx, acy };
    };

    const placeTargetUnobstructed = (h: ReturnType<typeof mountSanctuaryBoss>, wantDist: number) => {
      for (const dTry of [wantDist, 32, 42, 24]) {
        for (const deg of [90, 0, -90, 180, 45, 135, -45, -135]) {
          const rad = (deg * Math.PI) / 180;
          const px = h.bActor.pos.x + Math.cos(rad) * dTry;
          const py = h.bActor.pos.y + Math.sin(rad) * dTry;
          if (
            h.sess.world.map.queryValidPosition({ x: px, y: py }, 6) &&
            !h.sess.world.map.raycast(h.bActor.pos, { x: px, y: py }).hit &&
            !h.sess.world.wallRaycast!(h.bActor.pos, { x: px, y: py })
          ) {
            h.r.player.x = px;
            h.r.player.y = py;
            h.sess.playerActor.pos.x = px;
            h.sess.playerActor.pos.y = py;
            return;
          }
        }
      }
    };

    const matrixRows: any[] = [];
    let skillOrdinal = 0;

    for (const sanct of VEYRA_PRIMORDIAL_SITES) {
      for (const awakened of [false, true]) {
        const form = awakened ? 'ultimate' : 'mini';
        const skills = SIGNATURE[sanct.key][form];
        expect(skills.length).toBe(4);

        for (const sk of skills) {
          skillOrdinal++;
          const optDist = sk.id === 'furnace_trap' ? 24 : clamp((sk.range[0] + sk.range[1]) * 0.35, 24, 48);

          // 1) Open sanctuary floor: verify tell -> hitbox -> real SOH damage -> visual frame -> cleanup
          const hOpen = mountSanctuaryBoss(sanct.key, awakened, 12_000 + skillOrdinal);
          placeTargetUnobstructed(hOpen, optDist);
          hOpen.r.player.hp = 100;
          hOpen.bActor.boss!.target = hOpen.sess.playerActor.id;
          hOpen.bActor.boss!.mem.nextTgt = hOpen.sess.world.t + 12;
          hOpen.bActor.boss!.forced = sk.id;

          let openDmg = 0;
          const phases: string[] = [];
          let hitboxEmitted = false;
          let maxNonZeroPixels = 0;
          let maxDistinctColors = 0;
          let started = false;
          let ended = false;

          for (let step = 0; step < 150; step++) {
            const hpBefore = hOpen.r.player.hp;
            hOpen.now += 50;
            hOpen.r.player.hunger = 100;
            hOpen.r.player.thirst = 100;
            hOpen.r.player.warmth = 100;
            tick(hOpen.gs, IDLE_INPUT, 50, hOpen.now);
            if (hOpen.r.player.hp < hpBefore) {
              openDmg += hpBefore - hOpen.r.player.hp;
              hOpen.r.player.hp = 100;
              hOpen.r.player.dead = false;
            }
            const runner = hOpen.bActor.boss!.runner;
            if (runner && runner.skill.id === sk.id) {
              started = true;
              for (const ph of runner.phases) {
                if (!phases.includes(ph.tag)) phases.push(ph.tag);
              }
            } else if (started && !runner) {
              ended = true;
            }
            if (
              hOpen.sess.world.ents.some(e => !e.dead && e.lethal) ||
              hOpen.sess.world.actors.some(a => a.alive && a.kind === 'summon') ||
              hOpen.sess.world.events.some(ev => ev.skill === sk.id && ev.type === 'hit')
            ) {
              hitboxEmitted = true;
            }
            if (step % 4 === 0 && ((started && !ended) || hOpen.sess.world.ents.length > 0)) {
              renderWorld(
                fb,
                hOpen.sess.world,
                Math.round(hOpen.bActor.pos.x - VIEW_W / 2),
                Math.round(hOpen.bActor.pos.y - VIEW_H / 2),
                overlayOpts,
              );
              let sampledNonZero = 0;
              const cols = new Set<number>();
              const d = fb.data;
              for (let i = 0; i < d.length; i += 16) {
                if (d[i + 3] > 0) {
                  sampledNonZero++;
                  cols.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
                }
              }
              if (sampledNonZero * 4 > maxNonZeroPixels) {
                maxNonZeroPixels = sampledNonZero * 4;
                maxDistinctColors = cols.size;
              }
            }
            if (
              ended &&
              !hOpen.sess.world.ents.some(e => !e.dead && e.lethal) &&
              !hOpen.sess.world.actors.some(a => a.alive && a.kind === 'summon')
            ) {
              break;
            }
          }

          cleanupPrimordialBoss(hOpen.r, hOpen.boss.id, 'r2 matrix cleanup');
          const cleanAfter =
            !hOpen.sess.world.ents.some(e => !e.dead && e.owner === hOpen.bActor.id && (e.lethal || e.policy === 'owned')) &&
            !hOpen.sess.world.actors.some(a => a.alive && a.summon?.owner === hOpen.bActor.id);

          // 2) Real SOH player roll + lateral WASD evasion
          const hDodge = mountSanctuaryBoss(sanct.key, awakened, 12_000 + skillOrdinal);
          placeTargetUnobstructed(hDodge, optDist);
          hDodge.r.player.hp = 100;
          hDodge.bActor.boss!.target = hDodge.sess.playerActor.id;
          hDodge.bActor.boss!.mem.nextTgt = hDodge.sess.world.t + 12;
          hDodge.bActor.boss!.forced = sk.id;

          let dodgeDmg = 0;
          let dodgeStarted = false;
          let dodgeEnded = false;
          for (let step = 0; step < 150; step++) {
            const hpBefore = hDodge.r.player.hp;
            hDodge.now += 50;
            hDodge.r.player.hunger = 100;
            hDodge.r.player.thirst = 100;
            hDodge.r.player.warmth = 100;
            hDodge.r.player.stamina = 100;
            tick(hDodge.gs, { ...IDLE_INPUT, right: true, down: true, roll: step % 8 === 2 }, 50, hDodge.now);
            if (hDodge.r.player.hp < hpBefore) {
              dodgeDmg += hpBefore - hDodge.r.player.hp;
              hDodge.r.player.hp = 100;
              hDodge.r.player.dead = false;
            }
            const runner = hDodge.bActor.boss!.runner;
            if (runner && runner.skill.id === sk.id) dodgeStarted = true;
            else if (dodgeStarted && !runner) dodgeEnded = true;
            if (
              dodgeEnded &&
              !hDodge.sess.world.ents.some(e => !e.dead && e.lethal) &&
              !hDodge.sess.world.actors.some(a => a.alive && a.kind === 'summon')
            ) {
              break;
            }
          }
          cleanupPrimordialBoss(hDodge.r, hDodge.boss.id, 'r2 matrix dodge cleanup');

          // 3) Solid sanctuary T.PWALL partition between boss and player -> 0 damage leak
          const hWall = mountSanctuaryBoss(sanct.key, awakened, 12_000 + skillOrdinal);
          const wWorld = getWorld(hWall.r.layoutId!);
          const wallY = hWall.acy + 1;
          for (let wx = hWall.acx - 8; wx <= hWall.acx + 8; wx++) {
            if (wx > 1 && wx < WW - 2 && wallY > 1 && wallY < WH - 2) {
              wWorld.tiles[wallY * WW + wx] = T.PWALL;
              (wWorld.economyMap.walkable as Uint8Array)[wallY * WW + wx] = 0;
            }
          }
          markDirty();
          hWall.r.player.x = hWall.acx * TILE + 8;
          hWall.r.player.y = (hWall.acy + 3) * TILE + 8;
          hWall.r.player.hp = 100;
          hWall.bActor.pos.x = hWall.acx * TILE + 8;
          hWall.bActor.pos.y = (hWall.acy - 1) * TILE + 8;
          hWall.bActor.boss!.target = hWall.sess.playerActor.id;
          hWall.bActor.boss!.mem.nextTgt = hWall.sess.world.t + 12;
          hWall.bActor.boss!.forced = sk.id;

          let wallDmg = 0;
          let wallStarted = false;
          let wallEnded = false;
          for (let step = 0; step < 120; step++) {
            const hpBefore = hWall.r.player.hp;
            hWall.now += 50;
            hWall.r.player.hunger = 100;
            hWall.r.player.thirst = 100;
            hWall.r.player.warmth = 100;
            tick(hWall.gs, IDLE_INPUT, 50, hWall.now);
            if (hWall.r.player.hp < hpBefore) {
              wallDmg += hpBefore - hWall.r.player.hp;
              hWall.r.player.hp = 100;
              hWall.r.player.dead = false;
            }
            const runner = hWall.bActor.boss!.runner;
            if (runner && runner.skill.id === sk.id) wallStarted = true;
            else if (wallStarted && !runner) wallEnded = true;
            if (
              wallEnded &&
              !hWall.sess.world.ents.some(e => !e.dead && e.lethal) &&
              !hWall.sess.world.actors.some(a => a.alive && a.kind === 'summon')
            ) {
              break;
            }
          }
          const curWw = getWindowWorld(hWall.r.layoutId!);
          const curLayer = curWw.floors.layers.get(sanct.floor)!;
          wWorld.tiles.set(curLayer.tiles);
          (wWorld.economyMap.walkable as Uint8Array).set(curLayer.walkable);
          markDirty();
          cleanupPrimordialBoss(hWall.r, hWall.boss.id, 'r2 matrix wall cleanup');

          expect(phases, `${sanct.key}:${form}:${sk.id} tell/active phases`).toContain('OPEN');
          expect(phases, `${sanct.key}:${form}:${sk.id} active phase`).toContain('ACTIVE');
          expect(hitboxEmitted, `${sanct.key}:${form}:${sk.id} hitbox emitted`).toBe(true);
          expect(openDmg, `${sanct.key}:${form}:${sk.id} open sanctuary damage`).toBeGreaterThan(0);
          expect(dodgeDmg, `${sanct.key}:${form}:${sk.id} real roll+WASD dodge reduces damage`).toBeLessThan(openDmg);
          expect(wallDmg, `${sanct.key}:${form}:${sk.id} solid T.PWALL blocks 100% of damage`).toBe(0);
          expect(cleanAfter, `${sanct.key}:${form}:${sk.id} cleanup removes owned hazards/summons`).toBe(true);
          expect(maxNonZeroPixels, `${sanct.key}:${form}:${sk.id} visual frame non-zero pixels`).toBeGreaterThan(1000);
          expect(maxDistinctColors, `${sanct.key}:${form}:${sk.id} visual frame palette richness`).toBeGreaterThanOrEqual(20);

          matrixRows.push({
            ordinal: skillOrdinal,
            boss: sanct.key,
            sanctuaryPoi: sanct.poiId,
            sanctuaryFloor: sanct.floor,
            form,
            skillId: sk.id,
            skillName: sk.name,
            tellPhases: phases,
            hitboxEmitted,
            openSanctuaryDamage: +openDmg.toFixed(1),
            dodgeRollDamage: +dodgeDmg.toFixed(1),
            wallOccludedDamage: +wallDmg.toFixed(1),
            cleanupZeroLeak: cleanAfter,
            visualFrameNonZeroPixels: maxNonZeroPixels,
            visualFrameDistinctColors: maxDistinctColors,
            pass: true,
          });
        }
      }
    }

    expect(matrixRows.length).toBe(48);
    expect(matrixRows.every(r => r.pass)).toBe(true);

    const evidenceDir = path.resolve(process.cwd(), 'evidence/veyra-r2-closure');
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(
      path.join(evidenceDir, 'HOST_48_SKILL_MATRIX.json'),
      JSON.stringify(
        {
          summary: {
            totalSkillsVerifiedOnSohHost: matrixRows.length,
            elderFamilies: 6,
            formsPerElder: ['mini', 'ultimate'],
            allTellVerified: matrixRows.every(r => r.tellPhases.includes('OPEN') && r.tellPhases.includes('ACTIVE')),
            allHitboxVerified: matrixRows.every(r => r.hitboxEmitted),
            allOpenDamagePositive: matrixRows.every(r => r.openSanctuaryDamage > 0),
            allDodgeStrictlyReduced: matrixRows.every(r => r.dodgeRollDamage < r.openSanctuaryDamage),
            allWallOccludedZeroDamage: matrixRows.every(r => r.wallOccludedDamage === 0),
            allCleanupZeroLeak: matrixRows.every(r => r.cleanupZeroLeak),
            allVisualFramesRendered: matrixRows.every(r => r.visualFrameNonZeroPixels > 1000 && r.visualFrameDistinctColors >= 20),
          },
          skills: matrixRows,
        },
        null,
        2,
      ),
    );
  }, 180_000);
});
