import { BAL, T, TILE, WW, WH, hash2, clamp, type Creature, type RunState } from '../game/core';
import { CREATURES, SOURCES, PRIMORDIAL_ELDERS, PRIMORDIAL_TO_LEGACY_DOMAIN, ELDERS } from '../game/catalog';
import { U, FRAME_W, FRAME_H, auToTile } from './frame';
import { activeFloor, authoredPlan, type Level } from './floors';
import type { WindowWorld } from './window';

export interface HabitatAnchorSpec {
  species: string;
  poiId: string;
  au: [number, number];
  count: number;
  spreadTiles: number;
  leashTiles: number;
}

/** Canonical AU habitat anchors for the 9 Veyra ordinary creatures (CREATURE_HABITAT_AND_BOSS_DESIGN.md). */
export const ORDINARY_CREATURE_HABITATS: readonly HabitatAnchorSpec[] = [
  { species: 'vampire_1', poiId: 'po_ranger', au: [800, 760], count: 4, spreadTiles: 18, leashTiles: 24 },
  { species: 'vampire_2', poiId: 'po_academy', au: [936, 262], count: 4, spreadTiles: 20, leashTiles: 26 },
  { species: 'vampire_3', poiId: 'po_tombs', au: [520, 1086], count: 3, spreadTiles: 18, leashTiles: 28 },
  { species: 'orc_1', poiId: 'po_freightyard', au: [690, 500], count: 4, spreadTiles: 18, leashTiles: 22 },
  { species: 'orc_2', poiId: 'po_viaduct', au: [655, 448], count: 4, spreadTiles: 18, leashTiles: 26 },
  { species: 'orc_3', poiId: 'po_ironvein', au: [1205, 655], count: 3, spreadTiles: 18, leashTiles: 26 },
  { species: 'slime_1', poiId: 'po_pumphouse', au: [850, 556], count: 4, spreadTiles: 16, leashTiles: 18 },
  { species: 'slime_2', poiId: 'po_oldpump', au: [850, 985], count: 4, spreadTiles: 18, leashTiles: 20 },
  { species: 'slime_3', poiId: 'po_sulfur', au: [1768, 882], count: 4, spreadTiles: 18, leashTiles: 22 },
];

export interface SideBossSiteSpec {
  species: string;
  poiId: string;
  name: string;
  au: [number, number];
  floor: Level;
  leashTiles: number;
}

/** 4 Optional Side Boss sites — optional arenas with open retreat routes and run-local defeat receipts.
 *  Pale Custodian (`boss_custodian`) resides on Argus Academy's authored subterranean Sealed Archive (`floor: -1`),
 *  reachable via both Archive Stair (1842,518) and Service Hatch (1838,534 -> 1838,528). */
export const VEYRA_SIDE_BOSS_SITES: readonly SideBossSiteSpec[] = [
  { species: 'boss_greyback', poiId: 'po_greyquarry', name: 'Greyback Shaleheart', au: [506, 652], floor: 0, leashTiles: 22 },
  { species: 'boss_ronin', poiId: 'po_cairns', name: 'Oathless Ronin', au: [470, 990], floor: 0, leashTiles: 22 },
  { species: 'boss_tidemarshal', poiId: 'po_saltlight', name: 'Saltwick Tidemarshal', au: [1732, 262], floor: 0, leashTiles: 22 },
  { species: 'boss_custodian', poiId: 'po_academy', name: 'Pale Custodian', au: [926, 260], floor: -1, leashTiles: 18 },
];

export interface PrimordialSiteSpec {
  key: 'surtur' | 'typhon' | 'aion' | 'atlas' | 'argus' | 'anubis';
  poiId: string;
  landmarkKind: string;
  floor: Level;
  fallbackAu: [number, number];
}

export const VEYRA_PRIMORDIAL_SITES: readonly PrimordialSiteSpec[] = [
  { key: 'surtur', poiId: 'po_surtur', landmarkKind: 'elder_surtur_forge', floor: -1, fallbackAu: [1694, 826] },
  { key: 'typhon', poiId: 'po_typhon', landmarkKind: 'elder_typhon_shard', floor: 0, fallbackAu: [556, 352] },
  { key: 'aion', poiId: 'po_elderwood', landmarkKind: 'elder_aion_root', floor: -1, fallbackAu: [868, 712] },
  { key: 'atlas', poiId: 'po_gate', landmarkKind: 'elder_atlas_gate', floor: -1, fallbackAu: [168, 512] },
  { key: 'argus', poiId: 'po_hall_eyes', landmarkKind: 'elder_argus_eye', floor: -1, fallbackAu: [992, 212] },
  { key: 'anubis', poiId: 'po_necropolis', landmarkKind: 'elder_anubis_sarc', floor: -1, fallbackAu: [604, 1042] },
];

/** Resolve the exact global world-tile `(gx, gy, floor)` of a Primordial Elder's authored sanctuary dais. */
export function resolvePrimordialGlobalTile(site: PrimordialSiteSpec): { gx: number; gy: number; floor: Level } {
  const compiled = authoredPlan(site.poiId);
  if (compiled) {
    const prop = compiled.plan.props.find(p => p.kind === site.landmarkKind);
    if (prop) return { gx: prop.x, gy: prop.y, floor: prop.level };
  }
  const [gx, gy] = auToTile(site.fallbackAu[0], site.fallbackAu[1]);
  return { gx, gy, floor: site.floor };
}

export function windowOriginTiles(r: RunState): [number, number] {
  const o = r.sourceMap?.veyra?.originAu;
  return o ? [Math.round(o[0] / U), Math.round(o[1] / U)] : [0, 0];
}

function isElderAlreadyDefeated(r: RunState, key: string): boolean {
  const primStone = PRIMORDIAL_ELDERS[key]?.stone;
  const legDomain = PRIMORDIAL_TO_LEGACY_DOMAIN[key];
  const legStone = legDomain ? ELDERS[legDomain]?.stone : undefined;
  if (r.elderStones.includes(key) || (legDomain && r.elderStones.includes(legDomain))) return true;
  for (const c of Object.values(r.custody)) {
    for (const s of c.slots) {
      if (!s) continue;
      if (s.key === primStone || (legStone && s.key === legStone)) return true;
    }
  }
  return r.receipts.some(rc => rc.kind === 'elder.defeat' && (rc.detail === key || rc.detail === legDomain));
}

function sampleWalkableLocalTile(
  ww: WindowWorld,
  r: RunState,
  level: Level,
  targetLx: number,
  targetLy: number,
  maxRadius: number,
  seed: number,
  avoidPlayerSafeTiles: number,
): [number, number] | null {
  const layer = ww.floors.layers.get(level);
  if (!layer) return null;
  const [ox, oy] = windowOriginTiles(r);

  // Starter spawn global tile (so initial spawn clearance is respected)
  const spChoice = r.spawnChoice;

  for (let attempt = 0; attempt < 64; attempt++) {
    const rad =
      attempt === 0
        ? 0
        : attempt <= 8
          ? 1 + ((attempt - 1) >> 2)
          : Math.min(maxRadius, 2 + Math.floor((attempt / 64) * maxRadius));
    const ang = attempt <= 8 ? ((attempt - 1) * Math.PI) / 4 : hash2(attempt * 17 + 3, level + 11, seed) * Math.PI * 2;
    const lx = Math.round(targetLx + Math.cos(ang) * rad);
    const ly = Math.round(targetLy + Math.sin(ang) * rad);
    if (lx < 3 || ly < 3 || lx >= WW - 3 || ly >= WH - 3) continue;
    const li = ly * WW + lx;
    if (!layer.walkable[li] || layer.solidProps[li]) continue;
    const srcKey = layer.sources[li];
    if (srcKey && SOURCES[srcKey]?.block) continue;
    const t = layer.tiles[li];
    if (t === T.DEEP || t === T.RIVER || t === T.LAVA || t === T.PWALL || t === T.CLIFF) continue;
    if (layer.statics.some(s => s.tx === lx && s.ty === ly && s.kind !== 'door')) continue;

    if (avoidPlayerSafeTiles > 0 && spChoice && level === 0) {
      // Only avoid initial spawn if we haven't shifted away or compare in local space when close
      const dx = (ox + lx) - (ox + spChoice.x);
      const dy = (oy + ly) - (oy + spChoice.y);
      if (r.clock.simMs < 60_000 && Math.hypot(dx, dy) < avoidPlayerSafeTiles) continue;
    }

    // Respect territory cabinet spawn exclusion
    let nearClaim = false;
    for (const e of Object.values(r.entities)) {
      if (e.kind === 'struct' && e.type === 'claim' && e.tx !== undefined && e.ty !== undefined) {
        if (Math.hypot(e.tx - lx, e.ty - ly) < BAL.economy.claimSpawnExclusionTiles) {
          nearClaim = true;
          break;
        }
      }
    }
    if (nearClaim) continue;
    return [lx, ly];
  }
  return null;
}

function makeVeyraActor(
  id: string,
  type: string,
  lx: number,
  ly: number,
  floor: Level,
  leashTiles?: number,
  extra?: Partial<Creature>,
): Creature {
  const def = CREATURES[type];
  const hp = extra?.maxHp ?? def?.hp ?? 40;
  const x = lx * TILE + 8;
  const y = ly * TILE + 8;
  return {
    id,
    type,
    x,
    y,
    hp,
    maxHp: hp,
    homeX: x,
    homeY: y,
    state: extra?.elder ? 'sleep' : 'wander',
    t: 0.4,
    tx: x,
    ty: y,
    angle: 0,
    dir: 0,
    knows: null,
    path: null,
    pathT: 0,
    cd: 0,
    kbx: 0,
    kby: 0,
    flash: 0,
    animTime: 0,
    floor,
    ...(leashTiles ? { leashPx: leashTiles * TILE } : {}),
    ...extra,
  };
}

/** Archive off-window / off-floor actors into `r.veyraOffscreenCreatures` (global px) and restore matching actors,
 *  then seed newly entered habitat anchors, wildlife cells, side bosses, and Primordial Elders! */
export function syncVeyraEcosystemActors(
  r: RunState,
  ww: WindowWorld,
  inOldOx?: number,
  inOldOy?: number,
  inNewOx?: number,
  inNewOy?: number,
): void {
  const [curOx, curOy] = windowOriginTiles(r);
  const oldOx = inOldOx ?? curOx;
  const oldOy = inOldOy ?? curOy;
  const newOx = inNewOx ?? curOx;
  const newOy = inNewOy ?? curOy;
  const curFloor = activeFloor(r);
  const off = (r.veyraOffscreenCreatures ??= {});
  const wounds = (r.veyraAmbientWounds ??= {});
  const spawned = (r.veyraSpawnedHabitats ??= {});
  const cooldowns = (r.veyraEcologyCooldowns ??= {});
  const defeatedBosses = (r.sideBossDefeated ??= {});
  r.elderSchemaVersion = 2;

  const now = r.clock.lastSimAt || r.startedAt;
  for (const [cid, due] of Object.entries(cooldowns)) {
    if (!(due > now)) delete cooldowns[cid];
  }
  for (const sk of Object.keys(spawned)) {
    if (sk.startsWith('cell:')) delete spawned[sk];
  }

  const pxShift = (newOx - oldOx) * TILE;
  const pyShift = (newOy - oldOy) * TILE;
  const winCenterGx = newOx + WW / 2;
  const winCenterGy = newOy + WH / 2;

  const isPersistentOffscreenActor = (m: Creature, gxPx: number, gyPx: number): boolean => {
    if (m.husbandry?.tamed || m.elder || m.sideBoss) return true;
    if (m.ephemeral) return m.hp < m.maxHp;
    if (m.hp < m.maxHp || m.knows?.kind === 'sight') return true;
    const distTiles = Math.hypot(gxPx / TILE - winCenterGx, gyPx / TILE - winCenterGy);
    if ((m.id.startsWith('vy:wild:') || m.id.startsWith('vy:roam:')) && distTiles > 260) return false;
    return distTiles <= 360;
  };

  // 1. Shift or archive currently active creatures
  const kept: Creature[] = [];
  for (const m of r.creatures) {
    if (m.state === 'dead') continue; // Prune finished corpses on window/floor transition

    // Tamed animals actively on a lead (`following === true`) accompany the player across windows & floors!
    if (m.husbandry?.tamed && m.husbandry.following) {
      m.x = clamp(r.player.x - 12, TILE * 2, (WW - 2) * TILE);
      m.y = clamp(r.player.y + 10, TILE * 2, (WH - 2) * TILE);
      m.tx = m.x;
      m.ty = m.y;
      m.homeX = m.x;
      m.homeY = m.y;
      m.floor = curFloor;
      m.path = null;
      kept.push(m);
      delete off[m.id];
      continue;
    }

    const mFloor = (m.floor ?? 0) as Level;
    const lx = m.x - pxShift;
    const ly = m.y - pyShift;
    const lHomeX = m.homeX - pxShift;
    const lHomeY = m.homeY - pyShift;
    const ltx = (m.tx ?? m.x) - pxShift;
    const lty = (m.ty ?? m.y) - pyShift;

    const inWindow = lx >= TILE * 2 && ly >= TILE * 2 && lx < (WW - 2) * TILE && ly < (WH - 2) * TILE;
    if (mFloor === curFloor && inWindow) {
      m.x = lx;
      m.y = ly;
      m.homeX = lHomeX;
      m.homeY = lHomeY;
      m.tx = ltx;
      m.ty = lty;
      m.path = null;
      kept.push(m);
    } else {
      const gxPx = oldOx * TILE + m.x;
      const gyPx = oldOy * TILE + m.y;
      if (!isPersistentOffscreenActor(m, gxPx, gyPx)) {
        delete off[m.id];
        continue;
      }
      // Store in global world pixel coordinates!
      off[m.id] = {
        ...m,
        x: gxPx,
        y: gyPx,
        homeX: oldOx * TILE + m.homeX,
        homeY: oldOy * TILE + m.homeY,
        tx: oldOx * TILE + (m.tx ?? m.x),
        ty: oldOy * TILE + (m.ty ?? m.y),
        floor: mFloor,
        path: null,
      };
    }
  }

  // 2. Restore any offscreen creatures that belong on `curFloor` inside `[newOx, newOy]`
  const liveIds = new Set(kept.map(m => m.id));
  for (const [id, om] of Object.entries(off)) {
    const mFloor = (om.floor ?? 0) as Level;
    if (mFloor === curFloor) {
      const lx = om.x - newOx * TILE;
      const ly = om.y - newOy * TILE;
      if (lx >= TILE * 2 && ly >= TILE * 2 && lx < (WW - 2) * TILE && ly < (WH - 2) * TILE) {
        if (!liveIds.has(id)) {
          kept.push({
            ...om,
            x: lx,
            y: ly,
            homeX: om.homeX - newOx * TILE,
            homeY: om.homeY - newOy * TILE,
            tx: (om.tx ?? om.x) - newOx * TILE,
            ty: (om.ty ?? om.y) - newOy * TILE,
            path: null,
          });
          liveIds.add(id);
        }
        delete off[id];
        continue;
      }
    }
    if (!isPersistentOffscreenActor(om, om.x, om.y)) {
      delete off[id];
    }
  }

  // Keep wounds ledger disjoint from live + full-record offscreen actors first
  for (const m of kept) delete wounds[m.id];
  for (const id of Object.keys(off)) delete wounds[id];

  // Rehydrate any evicted wounded stubs whose global position just re-entered `[newOx, newOy, curFloor]`
  for (const [wid, ws] of Object.entries(wounds)) {
    if ((ws.floor as Level) !== curFloor) continue;
    const lxPx = ws.gx - newOx * TILE;
    const lyPx = ws.gy - newOy * TILE;
    if (lxPx >= TILE * 2 && lyPx >= TILE * 2 && lxPx < (WW - 2) * TILE && lyPx < (WH - 2) * TILE) {
      if (!liveIds.has(wid)) {
        const lTileX = clamp(Math.floor(lxPx / TILE), 2, WW - 3);
        const lTileY = clamp(Math.floor(lyPx / TILE), 2, WH - 3);
        const actor = makeVeyraActor(wid, ws.type, lTileX, lTileY, curFloor, undefined, {
          x: lxPx,
          y: lyPx,
          homeX: lxPx,
          homeY: lyPx,
          tx: lxPx,
          ty: lyPx,
          maxHp: ws.maxHp,
          hp: clamp(Math.round(ws.hp), 1, Math.max(1, ws.maxHp - 1)),
          ...(ws.leashPx !== undefined ? { leashPx: ws.leashPx } : {}),
        });
        kept.push(actor);
        liveIds.add(wid);
      }
      delete wounds[wid];
    }
  }

  const MAX_OFFSCREEN_AMBIENT = 96;
  const MAX_AMBIENT_WOUNDS = 512;
  const MAX_ECOLOGY_COOLDOWNS = 1024;
  const ambientOffIds = Object.keys(off).filter(id => {
    const m = off[id];
    return !m.husbandry?.tamed && !m.elder && !m.sideBoss;
  });
  if (ambientOffIds.length > MAX_OFFSCREEN_AMBIENT) {
    ambientOffIds.sort((a, b) => {
      const ma = off[a], mb = off[b];
      const wa = ma.hp < ma.maxHp ? 1 : 0, wb = mb.hp < mb.maxHp ? 1 : 0;
      if (wa !== wb) return wa - wb;
      const da = Math.hypot(ma.x / TILE - winCenterGx, ma.y / TILE - winCenterGy);
      const db = Math.hypot(mb.x / TILE - winCenterGx, mb.y / TILE - winCenterGy);
      return db - da;
    });
    for (let i = 0; i < ambientOffIds.length - MAX_OFFSCREEN_AMBIENT; i++) {
      const evId = ambientOffIds[i];
      const ev = off[evId];
      if (ev && ev.hp > 0 && ev.hp < ev.maxHp) {
        wounds[evId] = {
          type: ev.type,
          gx: Math.round(ev.x),
          gy: Math.round(ev.y),
          floor: ev.floor ?? 0,
          hp: Math.max(1, Math.min(ev.maxHp - 1, Math.round(ev.hp))),
          maxHp: ev.maxHp,
          ...(ev.leashPx !== undefined ? { leashPx: ev.leashPx } : {}),
        };
      }
      delete off[evId];
    }
  }

  // Enforce strict upper bound on compact wound stubs (`<= 512`): overflow converts to respawn cooldown so full-HP resurrection never happens
  const woundIds = Object.keys(wounds);
  if (woundIds.length > MAX_AMBIENT_WOUNDS) {
    woundIds.sort((a, b) => {
      const wa = wounds[a], wb = wounds[b];
      const da = Math.hypot(wa.gx / TILE - winCenterGx, wa.gy / TILE - winCenterGy);
      const db = Math.hypot(wb.gx / TILE - winCenterGx, wb.gy / TILE - winCenterGy);
      return db - da;
    });
    for (let i = 0; i < woundIds.length - MAX_AMBIENT_WOUNDS; i++) {
      const oldWoundId = woundIds[i];
      delete wounds[oldWoundId];
      cooldowns[oldWoundId] = now + 8 * 3600_000;
    }
  }
  const cdIds = Object.keys(cooldowns);
  if (cdIds.length > MAX_ECOLOGY_COOLDOWNS) {
    cdIds.sort((a, b) => cooldowns[a] - cooldowns[b]);
    for (let i = 0; i < cdIds.length - MAX_ECOLOGY_COOLDOWNS; i++) {
      delete cooldowns[cdIds[i]];
    }
  }

  r.creatures = kept;

  const hasActorAnywhere = (id: string) => liveIds.has(id) || !!off[id] || !!wounds[id];
  const isOnCooldown = (id: string) => (cooldowns[id] ?? 0) > now;

  // 3. Seed Canonical 9 Ordinary Creature Habitat Anchors (ground floor 0)
  // Never mark a habitat seeded before confirming valid walkable placement (`placed > 0`)
  if (curFloor === 0) {
    for (const hab of ORDINARY_CREATURE_HABITATS) {
      const [gx, gy] = auToTile(hab.au[0], hab.au[1]);
      const lx = gx - newOx;
      const ly = gy - newOy;
      if (lx < 4 || ly < 4 || lx >= WW - 4 || ly >= WH - 4) continue;
      const habKey = `hab:${hab.species}:${hab.poiId}`;
      let placed = 0;
      for (let i = 0; i < hab.count; i++) {
        const actorId = `vy:ord:${hab.species}:${hab.poiId}:${i}`;
        if (hasActorAnywhere(actorId) || isOnCooldown(actorId)) {
          placed++;
          continue;
        }
        const pos = sampleWalkableLocalTile(ww, r, 0, lx, ly, Math.max(hab.spreadTiles, 20), r.seed + i * 97 + gx, 16);
        if (!pos) continue;
        const actor = makeVeyraActor(actorId, hab.species, pos[0], pos[1], 0, hab.leashTiles);
        r.creatures.push(actor);
        liveIds.add(actorId);
        placed++;
      }
      if (placed > 0) spawned[habKey] = 1;
    }

    // 5. Seed Regional Biome Cells (50×50 world-tile grid): 5 Living Wildlife Species + wilderness ordinary encounters
    const cellSize = 50;
    const cMinX = Math.max(0, Math.floor(newOx / cellSize));
    const cMaxX = Math.min(Math.floor(FRAME_W / cellSize) - 1, Math.floor((newOx + WW - 1) / cellSize));
    const cMinY = Math.max(0, Math.floor(newOy / cellSize));
    const cMaxY = Math.min(Math.floor(FRAME_H / cellSize) - 1, Math.floor((newOy + WH - 1) / cellSize));

    for (let cy = cMinY; cy <= cMaxY; cy++) {
      for (let cx = cMinX; cx <= cMaxX; cx++) {
        const gxCenter = cx * cellSize + 25;
        const gyCenter = cy * cellSize + 25;
        const lxCenter = gxCenter - newOx;
        const lyCenter = gyCenter - newOy;
        if (lxCenter < 6 || lyCenter < 6 || lxCenter >= WW - 6 || lyCenter >= WH - 6) continue;

        const pos = sampleWalkableLocalTile(ww, r, 0, lxCenter, lyCenter, 20, r.seed + cx * 313 + cy * 977, 16);
        if (!pos) continue;
        const tile = ww.floors.ground.tiles[pos[1] * WW + pos[0]];

        // Spawn 2 wildlife actors per habitable biome cell (covering all 5 wildlife species naturally!)
        const wildPool =
          tile === T.MARSH ? ['grouse', 'hare', 'boar']
          : tile === T.FOREST ? ['deer', 'boar', 'fox', 'grouse']
          : tile === T.SNOW || tile === T.HILL ? ['fox', 'hare', 'deer']
          : tile === T.GRASS || tile === T.MEADOW || tile === T.SAND ? ['hare', 'deer', 'boar', 'grouse', 'fox']
          : null;

        if (wildPool) {
          for (let wi = 0; wi < 2; wi++) {
            const wid = `vy:wild:${cx}:${cy}:${wi}`;
            if (hasActorAnywhere(wid) || isOnCooldown(wid)) continue;
            const wPos = wi === 0 ? pos : sampleWalkableLocalTile(ww, r, 0, pos[0], pos[1], 12, r.seed + cx * 71 + cy * 53 + wi, 15);
            if (!wPos) continue;
            const pick = wildPool[Math.floor(hash2(cx + wi * 7, cy * 13, r.seed) * wildPool.length) % wildPool.length];
            r.creatures.push(makeVeyraActor(wid, pick, wPos[0], wPos[1], 0, 28));
            liveIds.add(wid);
          }
        }

        // Light wilderness ordinary encounter outside 26-tile starter safety radius
        const roll = hash2(cx * 19, cy * 29, r.seed ^ 0x55aa);
        if (roll < 0.55) {
          const hid = `vy:roam:${cx}:${cy}`;
          if (!hasActorAnywhere(hid) && !isOnCooldown(hid)) {
            const hPos = sampleWalkableLocalTile(ww, r, 0, pos[0], pos[1], 14, r.seed + cx * 151 + cy * 211, 26);
            if (hPos) {
              const ht = ww.floors.ground.tiles[hPos[1] * WW + hPos[0]];
              let hSpecies: string | null = null;
              if (ht === T.ASH) hSpecies = 'slime_3';
              else if (ht === T.TOXIC) hSpecies = 'slime_2';
              else if (ht === T.MARSH) hSpecies = roll < 0.3 ? 'slime_1' : 'slime_2';
              else if (ht === T.HILL) hSpecies = roll < 0.3 ? 'orc_3' : 'orc_2';
              else if (ht === T.FOREST) hSpecies = roll < 0.3 ? 'vampire_1' : 'orc_1';
              else if (ht === T.SNOW) hSpecies = 'vampire_2';
              if (hSpecies) {
                const leash = CREATURES[hSpecies]?.leashTiles ?? 22;
                r.creatures.push(makeVeyraActor(hid, hSpecies, hPos[0], hPos[1], 0, leash));
                liveIds.add(hid);
              }
            }
          }
        }
      }
    }
  }

  // 4. Seed 4 Optional Side Bosses on their authored floor (`0` outdoors or `-1` Argus Academy Sealed Archive); suppressed once defeated
  for (const sb of VEYRA_SIDE_BOSS_SITES) {
    if (sb.floor !== curFloor) continue;
    if (defeatedBosses[sb.species]) continue;
    const [gx, gy] = auToTile(sb.au[0], sb.au[1]);
    const lx = gx - newOx;
    const ly = gy - newOy;
    if (lx < 4 || ly < 4 || lx >= WW - 4 || ly >= WH - 4) continue;
    const actorId = `vy:boss:${sb.species}`;
    if (hasActorAnywhere(actorId)) continue;
    const pos = sampleWalkableLocalTile(ww, r, curFloor, lx, ly, 16, r.seed + gx * 13, r.qaUsed ? 0 : 8);
    if (!pos) continue;
    const def = CREATURES[sb.species];
    const actor = makeVeyraActor(actorId, sb.species, pos[0], pos[1], curFloor, sb.leashTiles, {
      maxHp: def.hp,
      sideBoss: { key: sb.species, phase: 0, moveIdx: 0, leashPx: sb.leashTiles * TILE },
    });
    r.creatures.push(actor);
    liveIds.add(actorId);
  }

  // 6. Seed the 6 Primordials on their exact authored sanctuary floors (`-1` or `0`)!
  const isDay14Awakening = (now - (r.startedAt - r.qaOffset)) >= BAL.run.elderAwakenHour * 3600_000;
  for (const ps of VEYRA_PRIMORDIAL_SITES) {
    if (isElderAlreadyDefeated(r, ps.key)) continue;
    const loc = resolvePrimordialGlobalTile(ps);
    if (loc.floor !== curFloor) continue;
    const lx = loc.gx - newOx;
    const ly = loc.gy - newOy;
    if (lx < 4 || ly < 4 || lx >= WW - 4 || ly >= WH - 4) continue;
    const eid = `vy:elder:${ps.key}`;
    if (hasActorAnywhere(eid)) continue;
    const targetLy = clamp(ps.key === 'typhon' ? ly + 3 : ly - 4, 4, WH - 5);
    const pos =
      sampleWalkableLocalTile(ww, r, curFloor, lx, targetLy, 8, r.seed + loc.gx, 0) ??
      sampleWalkableLocalTile(ww, r, curFloor, lx, ly, 8, r.seed + loc.gx, 0) ??
      [lx, targetLy];
    const pDef = PRIMORDIAL_ELDERS[ps.key];
    const initHp = isDay14Awakening ? pDef.hpAwake : pDef.hpLatent;
    const actor = makeVeyraActor(eid, `elder_${ps.key}`, pos[0], pos[1], curFloor, 30, {
      maxHp: initHp,
      elder: { key: ps.key, awake: isDay14Awakening, phase: 0, pattern: 0, special: 0 },
    });
    r.creatures.push(actor);
    liveIds.add(eid);
  }

  if (!Object.keys(off).length) delete r.veyraOffscreenCreatures;
  if (!Object.keys(wounds).length) delete r.veyraAmbientWounds;
  if (!Object.keys(cooldowns).length) delete r.veyraEcologyCooldowns;
}

/** Deterministic day/night & weather behavior modifiers for ordinary creatures & nocturnal predators. */
export function computeCreatureEnvFactors(
  species: string,
  sunLevel: number, // 0 = midnight, 1 = noon
  weatherKind: string,
): { speedMul: number; sightMul: number } {
  let speedMul = 1;
  let sightMul = 1;

  if (species.startsWith('vampire_')) {
    if (sunLevel < 0.35) {
      speedMul *= 1.18;
      sightMul *= 1.26;
    } else if (sunLevel > 0.65 && weatherKind === 'clear') {
      speedMul *= 0.88;
      sightMul *= 0.68;
    }
  } else if (species === 'fox') {
    if (sunLevel < 0.45) {
      speedMul *= 1.12;
      sightMul *= 1.22;
    }
  } else if (species === 'slime_1') {
    if (weatherKind === 'rain' || weatherKind === 'storm') {
      speedMul *= 1.22;
      sightMul *= 1.15;
    }
  } else if (species === 'slime_2') {
    if (weatherKind === 'fog' || weatherKind === 'rain') {
      speedMul *= 1.16;
      sightMul *= 1.12;
    }
  } else if (species === 'slime_3') {
    if (weatherKind === 'ash') {
      speedMul *= 1.16;
    } else if (weatherKind === 'rain' || weatherKind === 'storm') {
      speedMul *= 0.84;
    }
  } else if (species.startsWith('orc_')) {
    if (weatherKind === 'storm') {
      sightMul *= 0.86;
    }
  }

  return { speedMul, sightMul };
}
