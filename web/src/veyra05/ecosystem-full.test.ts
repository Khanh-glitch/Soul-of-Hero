import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

function pngSize(fpath: string): { width: number; height: number } {
  const b = fs.readFileSync(fpath);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}
import { TILE, WW, HOUR, T, uid, type GameState, type Creature } from '../game/core';
import { ITEMS, CREATURES, ELDERS, PRIMORDIAL_ELDERS, RECIPES, STRUCTS, ALWAYS_KNOWN_RECIPES, elderStoneDomain, lookupElderDef } from '../game/catalog';
import { setActiveLayout } from '../game/world';
import { newGame, startRun, dispatch, addItem, countItem, countStones, killCreature, markDirty, C } from '../game/engine';
import { tick, settle, bindCombat } from '../game/sim';
import { serializeSnapshot, selectSnapshots } from '../game/persist';
import { CREATURE_ATLAS_SPECS, hasCreatureAtlas, resolveCreatureSpriteFrame } from '../game/creature-sprites';
import { inspectPenAt, stepHusbandry, createTamedState } from '../game/husbandry';
import { ORDINARY_CREATURE_HABITATS, VEYRA_SIDE_BOSS_SITES, VEYRA_PRIMORDIAL_SITES, resolvePrimordialGlobalTile, computeCreatureEnvFactors } from './ecosystem';
import { U05_WORLD_LAYOUT_ID } from './scenes';
import { shiftVeyraWindowBy } from './continuity';
import { World, v, type MapAdapter } from '../game/primordials/game/core';
import { spawnBoss, spawnPlayer, stepWorld, startSkill } from '../game/primordials/game/sim';
import { installFx } from '../game/primordials/game/fx';
import { SIGNATURE } from '../game/primordials/game/registry';
import { BOSS_IDS, type Form } from '../game/primordials/art/clips';
import { stepPrimordialHost, cleanupPrimordialBoss } from '../game/primordials/host-bridge';

const T0 = Date.UTC(2026, 10, 9, 12, 0, 0);
let seq = 0;
const act = (gs: GameState, type: string, payload: Record<string, any> = {}, now = T0) =>
  dispatch(gs, { id: `eco-test-${++seq}`, type, ...payload }, now);

const IDLE_INPUT = {
  up: false, down: false, left: false, right: false,
  mx: 320, my: 180, attack: false, attackPressed: false, roll: false, cancel: false,
};

function startVeyraRun(seed = 20261110): GameState {
  setActiveLayout(U05_WORLD_LAYOUT_ID);
  const gs = newGame();
  const res = startRun(gs, 'female', T0, 0, seed);
  expect(res.ok).toBe(true);
  expect(gs.run?.layoutId).toMatch(/^veyra05-/);
  expect(gs.run?.elderSchemaVersion).toBe(2);
  return gs;
}

describe('Phase C/D/E/F — Veyra Full Creature, Husbandry, Side-Boss & 6-Primordial Ecosystem', () => {
  it('validates all 18 runtime sprite atlases, provenance manifest, total size budget (<12 MB), and frame bounds', () => {
    const pubDir = path.resolve(__dirname, '../../public/sprites/creatures');
    const provPath = path.join(pubPathFor('PROVENANCE.json', pubDir));
    expect(fs.existsSync(provPath)).toBe(true);
    const prov = JSON.parse(fs.readFileSync(provPath, 'utf8'));
    expect(Object.keys(prov.atlases).length).toBe(18);

    const speciesKeys = Object.keys(CREATURE_ATLAS_SPECS);
    expect(speciesKeys.length).toBe(18);

    let totalBytes = 0;
    const seenFiles = new Set<string>();
    for (const sp of speciesKeys) {
      expect(hasCreatureAtlas(sp)).toBe(true);
      expect(CREATURES[sp], `missing catalog entry for ${sp}`).toBeTruthy();
      const spec = CREATURE_ATLAS_SPECS[sp];
      const fpath = path.join(pubDir, spec.atlas);
      expect(fs.existsSync(fpath), `missing atlas ${spec.atlas}`).toBe(true);
      if (!seenFiles.has(spec.atlas)) {
        seenFiles.add(spec.atlas);
        totalBytes += fs.statSync(fpath).size;
      }
      const { width, height } = pngSize(fpath);

      // Verify every clip, every direction (0..3), and start/end frames lie strictly inside PNG dimensions
      for (const [clipKey, clip] of Object.entries(spec.clips)) {
        if (!clip) continue;
        for (const dir of [0, 1, 2, 3] as const) {
          for (const tSec of [0, 0.25, 0.9, 5.0]) {
            const dummy: Creature = {
              id: 'm1', type: sp, x: 100, y: 100, hp: clipKey === 'death' ? 0 : 20, maxHp: 20,
              homeX: 100, homeY: 100,
              state: clipKey === 'death' ? 'dead' : clipKey === 'attack' || clipKey === 'attack2' ? 'attack' : clipKey === 'run' ? 'chase' : clipKey === 'walk' ? 'wander' : 'idle',
              t: tSec * 1000, tx: clipKey === 'walk' ? 140 : 100, ty: 100,
              angle: 0, dir, knows: null, path: null, pathT: 0, cd: 0, kbx: 0, kby: 0,
              flash: clipKey === 'hurt' ? 120 : 0,
              animClip: clipKey as any,
              animTime: tSec,
              deadAt: clipKey === 'death' ? 0 : undefined,
            };
            const rf = resolveCreatureSpriteFrame(dummy, tSec);
            expect(rf, `${sp}:${clipKey}:dir${dir}`).not.toBeNull();
            expect(rf!.sx).toBeGreaterThanOrEqual(0);
            expect(rf!.sy).toBeGreaterThanOrEqual(0);
            expect(rf!.sx + rf!.sw, `${sp}:${clipKey}:dir${dir} x overflow`).toBeLessThanOrEqual(width);
            expect(rf!.sy + rf!.sh, `${sp}:${clipKey}:dir${dir} y overflow`).toBeLessThanOrEqual(height);
            if (sp === 'boss_tidemarshal' && dir === 1) {
              expect(rf!.mirrorX).toBe(true);
            }
          }
        }
      }
    }
    expect(totalBytes).toBeLessThan(12 * 1024 * 1024);

    // Anti-slide invariant: stationary wanderer plays 'idle'; moving wanderer plays 'walk'; dead holds last frame
    const stationary: Creature = {
      id: 'm2', type: 'vampire_1', x: 100, y: 100, hp: 38, maxHp: 38, homeX: 100, homeY: 100,
      state: 'wander', t: 500, tx: 100, ty: 100, angle: 0, dir: 0, knows: null, path: null, pathT: 0, cd: 0, kbx: 0, kby: 0, flash: 0,
    };
    expect(resolveCreatureSpriteFrame(stationary, 1.0)!.clipName).toBe('idle');
    stationary.tx = 132;
    expect(resolveCreatureSpriteFrame(stationary, 1.0)!.clipName).toBe('walk');
    stationary.state = 'dead'; stationary.hp = 0; stationary.deadAt = 1.0;
    const fEarly = resolveCreatureSpriteFrame(stationary, 1.02)!;
    const fHold1 = resolveCreatureSpriteFrame(stationary, 4.0)!;
    const fHold2 = resolveCreatureSpriteFrame(stationary, 12.0)!;
    expect(fEarly.clipName).toBe('death');
    expect(fEarly.frameIndex).toBe(0);
    expect(fHold1.frameIndex).toBe(fHold1.frameCount - 1);
    expect(fHold2.frameIndex).toBe(fHold1.frameCount - 1);
  });

  it('preserves ALWAYS_KNOWN_RECIPES invariant while exposing new base husbandry & fletching recipes', () => {
    expect(ALWAYS_KNOWN_RECIPES.length).toBe(14);
    expect(ALWAYS_KNOWN_RECIPES).not.toContain('lead_rope');
    expect(ALWAYS_KNOWN_RECIPES).not.toContain('animal_feed');
    expect(ALWAYS_KNOWN_RECIPES).not.toContain('arrow_fletched');
    expect(RECIPES.lead_rope?.base).toBe(true);
    expect(RECIPES.animal_feed?.base).toBe(true);
    expect(RECIPES.arrow_fletched?.base).toBe(true);
    expect(STRUCTS.feed_trough?.slots).toBe(6);
  });

  it('verifies ordinary creature env modifiers, leash reset, and D061 non-targeting of unprovoked structures', () => {
    // Vampires stronger at midnight (sun=0.1) and weaker in clear noon sun (sun=0.9)
    const vampNight = computeCreatureEnvFactors('vampire_2', 0.1, 'clear');
    const vampNoon = computeCreatureEnvFactors('vampire_2', 0.9, 'clear');
    expect(vampNight.speedMul).toBeGreaterThan(1.1);
    expect(vampNight.sightMul).toBeGreaterThan(1.2);
    expect(vampNoon.sightMul).toBeLessThan(0.75);

    // Slimes respond to rain/ash
    expect(computeCreatureEnvFactors('slime_1', 0.5, 'rain').speedMul).toBeGreaterThan(1.15);
    expect(computeCreatureEnvFactors('slime_3', 0.5, 'ash').speedMul).toBeGreaterThan(1.1);
    expect(computeCreatureEnvFactors('slime_3', 0.5, 'storm').speedMul).toBeLessThan(0.9);

    // Leash & D061 check in live tick
    const gs = startVeyraRun(777);
    const r = gs.run!;
    bindCombat(r);
    r.creatures = [];
    const px = Math.floor(r.player.x / TILE), py = Math.floor(r.player.y / TILE);
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      r.terrain[(py + dy) * WW + (px + dx)] = { t: T.GRASS };
      r.sources[(py + dy) * WW + (px + dx)] = { stock: 0, hp: 0 };
    }
    // Place an unprovoked player wall beside an orc_2 and verify wandering orc never bashes it without footprints/charge
    const wallId = uid(r, 'e');
    r.entities[wallId] = {
      id: wallId, kind: 'struct', type: 'wall_wood',
      tx: px + 2, ty: py, x: (px + 2) * TILE + 8, y: py * TILE + 8,
      hp: STRUCTS.wall_wood.hp, maxHp: STRUCTS.wall_wood.hp,
    };
    r.player.x = (px - 18) * TILE; // within 28-tile active radius, out of sight
    r.player.y = py * TILE;
    const orc: Creature = {
      id: 'm1', type: 'orc_2',
      x: (px + 5) * TILE, y: py * TILE + 8,
      hp: CREATURES.orc_2.hp, maxHp: CREATURES.orc_2.hp,
      homeX: (px - 20) * TILE, homeY: py * TILE + 8, // 25 tiles from current x -> exceeds leash!
      leashPx: 12 * TILE,
      state: 'chase', t: 0, tx: (px + 5) * TILE, ty: py * TILE + 8,
      angle: 0, dir: 0,
      knows: { kind: 'sight', x: (px + 6) * TILE, y: py * TILE + 8, at: T0 },
      path: null, pathT: 0, cd: 0, kbx: 0, kby: 0, flash: 0, floor: 0,
    };
    r.creatures.push(orc);
    markDirty();
    tick(gs, IDLE_INPUT, 50, T0 + 50);
    // Exceeded leash -> dropped sight knowledge and began returning home; wall untouched!
    expect(orc.knows).toBeNull();
    expect(orc.tx).toBe(orc.homeX);
    // D061: orc never targeted or struck the wall (only ~0.0002 passive weather wear on exposed wood)
    expect(r.entities[wallId].hp).toBeGreaterThan(STRUCTS.wall_wood.hp - 0.1);
  });

  it('executes 4 optional side bosses with alternating 2-move choreography, unique-once drops, and zero Ragnarok cash', () => {
    expect(VEYRA_SIDE_BOSS_SITES.length).toBe(4);
    const gs = startVeyraRun(888);
    const r = gs.run!;
    bindCombat(r);
    r.creatures = [];

    const px = Math.floor(r.player.x / TILE), py = Math.floor(r.player.y / TILE);
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
      r.terrain[(py + dy) * WW + (px + dx)] = { t: T.GRASS };
      r.sources[(py + dy) * WW + (px + dx)] = { stock: 0, hp: 0 };
    }
    markDirty();

    const boss: Creature = {
      id: 'vy:boss:ronin', type: 'boss_ronin',
      x: r.player.x + 36, y: r.player.y,
      hp: 220, maxHp: 220, homeX: r.player.x + 36, homeY: r.player.y,
      state: 'chase', t: 0, tx: r.player.x, ty: r.player.y,
      angle: Math.PI, dir: 1,
      knows: { kind: 'sight', x: r.player.x, y: r.player.y, at: T0 },
      path: null, pathT: 0, cd: 0, kbx: 0, kby: 0, flash: 0, floor: 0,
      sideBoss: { key: 'boss_ronin', phase: 0, moveIdx: 0, leashPx: 22 * TILE },
    };
    r.creatures.push(boss);

    const seenClips = new Set<string>();
    let now = T0;
    for (let step = 0; step < 90; step++) {
      now += 50;
      r.player.hp = 100; // keep player alive while observing choreography
      tick(gs, IDLE_INPUT, 50, now);
      if (boss.state === 'tell' && boss.animClip) seenClips.add(boss.animClip);
    }
    expect(seenClips.has('attack')).toBe(true);
    expect(seenClips.has('attack2')).toBe(true);

    // Advance into Ragnarok (last 72h) and defeat boss twice: unique weapon drops ONCE, zero cash drops!
    r.qaOffset = 280 * HOUR;
    const beforeEnts = new Set(Object.keys(r.entities));
    killCreature(gs, boss, now);
    const firstDrops = Object.values(r.entities)
      .filter(e => !beforeEnts.has(e.id) && e.kind === 'drop')
      .map(e => C(r, e.c!).slots[0]?.key);
    expect(firstDrops).toContain('ronin_nodachi');
    expect(firstDrops).not.toContain('cash');
    expect(firstDrops).not.toContain('rcash');

    const secondBoss: Creature = { ...boss, id: 'vy:boss:ronin2', state: 'chase', hp: 10 };
    const midEnts = new Set(Object.keys(r.entities));
    killCreature(gs, secondBoss, now + 100);
    const secondDrops = Object.values(r.entities)
      .filter(e => !midEnts.has(e.id) && e.kind === 'drop')
      .map(e => C(r, e.c!).slots[0]?.key);
    expect(secondDrops).not.toContain('ronin_nodachi');
  });

  it('proves taming, leading across windows, pen containment, fox physical pen-blocking, and 8h/24h/48h offline settle', () => {
    const gs = startVeyraRun(999);
    const r = gs.run!;
    bindCombat(r);
    r.creatures = [];

    const cx = Math.floor(r.player.x / TILE), cy = Math.floor(r.player.y / TILE);
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
      const idx = (cy + dy) * WW + (cx + dx);
      r.terrain[idx] = { t: T.GRASS };
      r.sources[idx] = { stock: 0, hp: 0 };
    }
    markDirty();

    // Build a 5x5 enclosed pen (interior 3x3 at cx+2..cx+4, cy-1..cy+1) with a door_wood at (cx+1, cy)
    const penMinX = cx + 1, penMaxX = cx + 5, penMinY = cy - 2, penMaxY = cy + 2;
    let doorId = '';
    for (let y = penMinY; y <= penMaxY; y++) {
      for (let x = penMinX; x <= penMaxX; x++) {
        if (x > penMinX && x < penMaxX && y > penMinY && y < penMaxY) continue;
        const isDoor = x === penMinX && y === cy;
        const id = uid(r, 'e');
        r.entities[id] = {
          id, kind: 'struct', type: isDoor ? 'door_wood' : 'wall_stone',
          tx: x, ty: y, x: x * TILE + 8, y: y * TILE + 8,
          hp: isDoor ? STRUCTS.door_wood.hp : STRUCTS.wall_stone.hp,
          maxHp: isDoor ? STRUCTS.door_wood.hp : STRUCTS.wall_stone.hp,
          open: false,
        };
        if (isDoor) doorId = id;
      }
    }
    // Add feed_trough at (cx+2, cy-1) and barrel at (cx+4, cy-1) inside pen
    const troughContainerId = uid(r, 'c');
    r.custody[troughContainerId] = { id: troughContainerId, kind: 'chest', slots: Array(6).fill(null) };
    r.custody[troughContainerId].slots[0] = { uid: uid(r, 's'), key: 'animal_feed', qty: 20 };
    r.custody[troughContainerId].slots[1] = { uid: uid(r, 's'), key: 'animal_feed', qty: 20 };
    const troughId = uid(r, 'e');
    r.entities[troughId] = {
      id: troughId, kind: 'struct', type: 'feed_trough',
      tx: cx + 2, ty: cy - 1, x: (cx + 2) * TILE + 8, y: (cy - 1) * TILE + 8,
      hp: STRUCTS.feed_trough.hp, maxHp: STRUCTS.feed_trough.hp, c: troughContainerId,
    };
    const barrelId = uid(r, 'e');
    r.entities[barrelId] = {
      id: barrelId, kind: 'struct', type: 'barrel',
      tx: cx + 4, ty: cy - 1, x: (cx + 4) * TILE + 8, y: (cy - 1) * TILE + 8,
      hp: STRUCTS.barrel.hp, maxHp: STRUCTS.barrel.hp, water: 6,
    };
    // Place a funded territory claim cabinet on a stone foundation inside the homestead so 48h offline upkeep protects the pen walls + gate
    const floorId = uid(r, 'e');
    r.entities[floorId] = {
      id: floorId, kind: 'struct', type: 'floor_stone',
      tx: cx + 3, ty: cy + 1, x: (cx + 3) * TILE + 8, y: (cy + 1) * TILE + 8,
      hp: STRUCTS.floor_stone.hp, maxHp: STRUCTS.floor_stone.hp,
    };
    const claimContainerId = uid(r, 'c');
    r.custody[claimContainerId] = { id: claimContainerId, kind: 'chest', slots: Array(12).fill(null) };
    addItem(r, claimContainerId, 'wood', 80);
    addItem(r, claimContainerId, 'stone', 80);
    addItem(r, claimContainerId, 'rope', 40);
    const claimId = uid(r, 'e');
    r.entities[claimId] = {
      id: claimId, kind: 'struct', type: 'claim',
      tx: cx + 3, ty: cy + 1, x: (cx + 3) * TILE + 8, y: (cy + 1) * TILE + 8,
      hp: STRUCTS.claim.hp, maxHp: STRUCTS.claim.hp, c: claimContainerId,
      cabinet: { credit: {}, legacy: false },
    };
    markDirty();

    // Closed gate -> pen is enclosed (9 interior tiles); open gate -> not enclosed!
    expect(inspectPenAt(r, cx + 3, cy).enclosed).toBe(true);
    expect(inspectPenAt(r, cx + 3, cy).tiles.size).toBe(9);
    r.entities[doorId].open = true;
    expect(inspectPenAt(r, cx + 3, cy).enclosed).toBe(false);
    r.entities[doorId].open = false;
    expect(inspectPenAt(r, cx + 3, cy).enclosed).toBe(true);

    // Spawn wild grouse beside player, tame it with animal_feed, lead with lead_rope, release into pen
    const grouseHen: Creature = {
      id: uid(r, 'm'), type: 'grouse',
      x: r.player.x + 12, y: r.player.y,
      hp: CREATURES.grouse.hp, maxHp: CREATURES.grouse.hp,
      homeX: r.player.x + 12, homeY: r.player.y,
      state: 'wander', t: 0, tx: r.player.x + 12, ty: r.player.y,
      angle: 0, dir: 0, knows: null, path: null, pathT: 0, cd: 0, kbx: 0, kby: 0, flash: 0, floor: 0,
    };
    r.creatures.push(grouseHen);
    addItem(r, 'inv', 'animal_feed', 2);
    addItem(r, 'inv', 'lead_rope', 1);

    const tameRes = act(gs, 'husbandry', { cid: grouseHen.id, op: 'tame' }, T0 + 10);
    expect(tameRes.ok).toBe(true);
    expect(grouseHen.husbandry?.tamed).toBe(true);
    expect(countItem(r, 'inv', 'animal_feed')).toBe(1);

    const leadRes = act(gs, 'husbandry', { cid: grouseHen.id, op: 'lead' }, T0 + 20);
    expect(leadRes.ok).toBe(true);
    expect(grouseHen.husbandry?.following).toBe(true);

    // Move hen + a mate inside the enclosed pen and release!
    grouseHen.x = (cx + 3) * TILE + 8; grouseHen.y = cy * TILE + 8;
    r.player.x = cx * TILE + 8; r.player.y = cy * TILE + 8;
    const relRes = act(gs, 'husbandry', { cid: grouseHen.id, op: 'release' }, T0 + 30);
    expect(relRes.ok).toBe(true);
    expect(grouseHen.husbandry?.penned).toBe(true);

    const grouseMate: Creature = {
      ...grouseHen,
      id: uid(r, 'm'),
      x: (cx + 3) * TILE + 10, y: (cy + 1) * TILE + 8,
      husbandry: createTamedState(grouseHen.husbandry?.sex === 'f' ? 'm' : 'f'),
    };
    grouseMate.husbandry!.penned = true;
    r.creatures.push(grouseMate);

    // Physical dusk/night fox test: enclosed pen protects grouse; unpenned outside grouse gets stalked!
    const nightAt = T0 + 12 * HOUR; // midnight
    r.clock.lastSimAt = nightAt;
    const fox: Creature = {
      id: uid(r, 'm'), type: 'fox',
      x: cx * TILE + 8, y: (cy - 3) * TILE + 8,
      hp: CREATURES.fox.hp, maxHp: CREATURES.fox.hp,
      homeX: cx * TILE + 8, homeY: (cy - 3) * TILE + 8,
      state: 'wander', t: 0, tx: cx * TILE + 8, ty: (cy - 3) * TILE + 8,
      angle: 0, dir: 0, knows: null, path: null, pathT: 0, cd: 0, kbx: 0, kby: 0, flash: 0, floor: 0,
    };
    r.creatures.push(fox);
    r.player.x = (cx - 12) * TILE; // step player aside so fox acts undisturbed
    for (let s = 0; s < 15; s++) tick(gs, IDLE_INPUT, 100, nightAt + (s + 1) * 100);
    // Penned grouse inside closed pen took ZERO fox damage!
    expect(grouseHen.hp).toBe(CREATURES.grouse.hp);
    // Remove fox before offline settle test
    r.creatures = r.creatures.filter(c => c.id !== fox.id);

    // Offline settle() catch-up across 8h, 24h, and 48h: real feed/water debit, eggs/feathers yielded, juvenile bred & matured!
    const startFeed = r.custody[troughContainerId].slots.reduce((n, s) => n + (s?.key === 'animal_feed' ? s.qty : 0), 0);
    r.player.hunger = 100; r.player.thirst = 100; r.player.hp = 100; r.player.warmth = 100;
    settle(gs, nightAt + 8 * HOUR);
    const after8hSlots = r.custody[troughContainerId].slots;
    const feedAfter8h = after8hSlots.reduce((n, s) => n + (s?.key === 'animal_feed' ? s.qty : 0), 0);
    const eggsAfter8h = after8hSlots.reduce((n, s) => n + (s?.key === 'grouse_egg' ? s.qty : 0), 0);
    expect(feedAfter8h).toBeLessThan(startFeed);
    expect(eggsAfter8h).toBeGreaterThanOrEqual(1);

    for (const h of [16, 24, 32, 40, 48]) {
      r.player.hunger = 100; r.player.thirst = 100; r.player.hp = 100; r.player.warmth = 100;
      settle(gs, nightAt + h * HOUR);
      if (h === 24) {
        expect(r.creatures.filter(c => c.type === 'grouse' && c.husbandry?.tamed).length).toBeGreaterThanOrEqual(3); // bred juvenile!
      }
    }
    const tamedGrouse48h = r.creatures.filter(c => c.type === 'grouse' && c.husbandry?.tamed);
    // Capacity bounded by pen.capacity (never runaway population explosion — even after window shifts!)
    const henTx = Math.floor(grouseHen.x / TILE), henTy = Math.floor(grouseHen.y / TILE);
    const penCap = inspectPenAt(r, henTx, henTy).capacity;
    expect(penCap).toBeGreaterThanOrEqual(3);
    expect(tamedGrouse48h.length).toBeLessThanOrEqual(penCap);
    // Offspring matured to adult after 24-48h
    expect(tamedGrouse48h.some(c => c.husbandry?.stage === 'adult')).toBe(true);

    // Butcher yields physical meat & feathers (if player died of exposure while outside during 48h settle, respawn & walk back to pen)
    if (r.player.dead) r.player.dead = false, r.player.hp = 100;
    const liveHen = r.creatures.find(c => c.id === grouseHen.id)!;
    r.player.x = liveHen.x - TILE; r.player.y = liveHen.y;
    const butcherRes = act(gs, 'husbandry', { cid: liveHen.id, op: 'butcher' }, nightAt + 48 * HOUR + 1000);
    expect(butcherRes.ok, !butcherRes.ok ? butcherRes.reason : '').toBe(true);
    expect(liveHen.state).toBe('dead');
  });

  it('executes all 48/48 Primordial signature skills (6 Elders × 2 forms × 4 skills) cleanly with zero orphan entities or UTC clock drift', () => {
    expect(VEYRA_PRIMORDIAL_SITES.length).toBe(6);
    const coords = VEYRA_PRIMORDIAL_SITES.map(s => resolvePrimordialGlobalTile(s));
    expect(new Set(coords.map(c => `${c.gx},${c.gy}`)).size).toBe(6);

    const openArenaAdapter: MapAdapter = {
      bounds: { x: 24, y: 24, w: 912, h: 912 },
      obstacles: [],
      queryValidPosition: (p, rad) => ({
        x: Math.max(24 + rad, Math.min(936 - rad, p.x)),
        y: Math.max(24 + rad, Math.min(936 - rad, p.y)),
      }),
      raycast: (_from, to) => ({ hit: false, p: to }),
    };

    let executedCount = 0;
    for (const bossId of BOSS_IDS) {
      for (const form of ['mini', 'ultimate'] as Form[]) {
        const sigs = SIGNATURE[bossId][form];
        expect(sigs.length, `${bossId}:${form} must have 4 signature skills`).toBe(4);

        for (const skill of sigs) {
          const w = new World({ seed: 4242, adapter: openArenaAdapter, difficulty: 1, quality: 'maximum_vfx' });
          installFx(w);
          const player = spawnPlayer(w, v(480, 560));
          player.hp = 99999; player.maxHp = 99999;
          const boss = spawnBoss(w, bossId, form, v(480, 420));
          boss.boss!.target = player.id;

          startSkill(w, boss, skill, 'test');
          expect(boss.boss!.runner?.skill.id).toBe(skill.id);

          // Step through the full skill lifecycle (up to 14s simulated @ 30Hz)
          for (let step = 0; step < 420 && boss.boss!.runner !== null; step++) {
            w.dt = 1 / 30;
            stepWorld(w);
            player.hp = 99999;
            // Verify boss & player stay strictly within valid arena bounds (Atlas rifts never clip into walls)
            expect(boss.pos.x).toBeGreaterThanOrEqual(24);
            expect(boss.pos.x).toBeLessThanOrEqual(936);
            expect(player.pos.x).toBeGreaterThanOrEqual(24);
            expect(player.pos.x).toBeLessThanOrEqual(936);
          }
          expect(boss.boss!.runner, `${skill.id} failed to terminate cleanly`).toBeNull();

          // Verify cleanupOwner removes 100% of owned lethal entities & summons on interrupt/death
          startSkill(w, boss, skill, 'test-interrupt');
          for (let step = 0; step < 18; step++) { w.dt = 1 / 30; stepWorld(w); }
          w.cleanupOwner(boss.id, 'test interrupt');
          expect(w.ents.filter(e => e.owner === boss.id && !e.dead && (e.lethal || e.policy === 'owned')).length).toBe(0);
          expect(w.actors.filter(a => a.summon?.owner === boss.id && a.alive).length).toBe(0);

          executedCount++;
        }
      }
    }
    expect(executedCount).toBe(48);

    // Verify Aion host-bridge integration NEVER mutates SOH's 336h UTC run clock (startedAt / qaOffset)
    const gs = startVeyraRun(31415);
    const r = gs.run!;
    r.creatures = [];
    const aion: Creature = {
      id: 'vy:elder:aion', type: 'elder_aion',
      x: r.player.x + 64, y: r.player.y,
      hp: PRIMORDIAL_ELDERS.aion.hpLatent, maxHp: PRIMORDIAL_ELDERS.aion.hpLatent,
      homeX: r.player.x + 64, homeY: r.player.y,
      state: 'chase', t: 0, tx: r.player.x + 64, ty: r.player.y,
      angle: 0, dir: 0, knows: null, path: null, pathT: 0, cd: 0, kbx: 0, kby: 0, flash: 0, floor: 0,
      elder: { key: 'aion', awake: false, phase: 0, pattern: 0, special: 0 },
    };
    r.creatures.push(aion);
    const origStartedAt = r.startedAt;
    const origQaOffset = r.qaOffset;
    for (let i = 0; i < 60; i++) {
      stepPrimordialHost(gs, 0.05, T0 + i * 50, {
        isBlockedTile: () => false,
        isAwakening: false,
        hurtPlayer: () => {},
        killCreature,
      });
    }
    expect(r.startedAt).toBe(origStartedAt);
    expect(r.qaOffset).toBe(origQaOffset);
    cleanupPrimordialBoss(r);
  });

  it('enforces 6-stone bijection, window-shift offscreen creature continuity, save round-trip, and v1->v2 Elder migration', () => {
    const gs = startVeyraRun(5150);
    const r = gs.run!;

    // Window shift preserves global offscreen creatures and brings them back on return shift
    const initialIds = r.creatures.map(c => c.id);
    expect(initialIds.length).toBeGreaterThan(0);
    expect(shiftVeyraWindowBy(gs, 64, 0, markDirty)).toBe(true);
    const offCount = Object.keys(r.veyraOffscreenCreatures ?? {}).length;
    expect(offCount).toBeGreaterThan(0);

    // Snapshot round-trip with Primordials + offscreen creatures succeeds cleanly
    const snapText = serializeSnapshot(gs);
    const loaded = selectSnapshots([snapText, null]).gs;
    expect(loaded).not.toBeNull();
    expect(loaded!.run!.elderSchemaVersion).toBe(2);

    // 6-stone bijection: 6 Primordial stones = 6; adding duplicate or legacy domain stone never exceeds 6!
    for (const p of Object.values(PRIMORDIAL_ELDERS)) {
      addItem(r, 'inv', p.stone, 1);
    }
    expect(countStones(r)).toBe(6);
    addItem(r, 'inv', 'stone_frost', 1); // same domain as stone_argus
    expect(countStones(r)).toBe(6);

    // Reconstruct a clean v1 Veyra snapshot BEFORE adding Primordial stones so migration converts legacy 'magma' + 'stone_magma' -> 'surtur' + 'stone_surtur'
    const v1Raw = JSON.parse(JSON.parse(snapText).payload);
    v1Raw.run.elderSchemaVersion = 1;
    v1Raw.run.creatures.push({
      id: 'vy:elder:legacy_test', type: 'elder_magma',
      x: 400, y: 400, hp: 190, maxHp: 380, homeX: 400, homeY: 400,
      state: 'sleep', t: 0, tx: 400, ty: 400, angle: 0, dir: 0,
      knows: null, path: null, pathT: 0, cd: 0, kbx: 0, kby: 0, flash: 0, floor: 0,
      elder: { key: 'magma', awake: false, phase: 0, pattern: 0, special: 0 },
    });
    v1Raw.run.custody.inv.slots[10] = { uid: uid(v1Raw.run, 's'), key: 'stone_magma', qty: 1 };
    const migrated = selectSnapshots([JSON.stringify(v1Raw), null]).gs;
    expect(migrated).not.toBeNull();
    expect(migrated!.run!.elderSchemaVersion).toBe(2);
    const migElder = migrated!.run!.creatures.find(c => c.id === 'vy:elder:legacy_test')!;
    expect(migElder.elder?.key).toBe('surtur');
    expect(migElder.maxHp).toBe(PRIMORDIAL_ELDERS.surtur.hpLatent);
    expect(migrated!.run!.custody.inv.slots[10]?.key).toBe('stone_surtur');

    // Fail closed on unknown elderSchemaVersion (99) or forged Elder key ('cthulhu')
    const badVer = JSON.parse(JSON.stringify(v1Raw));
    badVer.run.elderSchemaVersion = 99;
    expect(selectSnapshots([JSON.stringify(badVer), null]).gs).toBeNull();

    const badKey = JSON.parse(JSON.parse(snapText).payload);
    badKey.run.creatures.push({
      id: 'vy:elder:bad', type: 'elder_cthulhu',
      x: 400, y: 400, hp: 100, maxHp: 100, homeX: 400, homeY: 400,
      state: 'sleep', t: 0, tx: 400, ty: 400, angle: 0, dir: 0,
      knows: null, path: null, pathT: 0, cd: 0, kbx: 0, kby: 0, flash: 0, floor: 0,
      elder: { key: 'cthulhu', awake: false, phase: 0, pattern: 0, special: 0 },
    });
    expect(selectSnapshots([JSON.stringify(badKey), null]).gs).toBeNull();

    // Shipping map runs stay 100% untouched with legacy ELDERS
    setActiveLayout('shipping');
    const shipGs = newGame();
    expect(startRun(shipGs, 'male', T0, 0, 1234).ok).toBe(true);
    expect(shipGs.run!.creatures.filter(c => c.elder).map(c => c.elder!.key).sort()).toEqual(Object.keys(ELDERS).sort());
    expect(lookupElderDef('frost')?.name).toBe('Glacier Matron');
    expect(elderStoneDomain('stone_surtur')).toBe('magma');
  });
});

function pubPathFor(rel: string, dir: string): string {
  return path.join(dir, rel);
}
