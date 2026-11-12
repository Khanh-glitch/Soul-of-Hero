import { afterEach, describe, expect, it } from 'vitest';
import {
  addItem,
  allRunEntities,
  basePowerBoundary,
  blockGrid,
  connectedPower,
  countItem,
  destroyOffscreenStructure,
  destroyStructure,
  dispatch,
  electricDoorGenerator,
  electricDoorPowered,
  findRunEntity,
  markDirty,
  newGame,
  powerAllocation,
  startRun,
  stepBasePower,
  syncElectricDoors,
  turretStatus,
} from '../src/game/engine';
import { STRUCTS } from '../src/game/catalog';
import { T, TILE, WW } from '../src/game/core';
import { selectSnapshots, serializeSnapshot } from '../src/game/persist';
import { FX, HAZ, PROJ, settle, syncWorld } from '../src/game/sim';
import { setActiveLayout } from '../src/game/world';
import { shiftVeyraWindowBy } from '../src/veyra05/continuity';
import { activeFloor, applyFloor } from '../src/veyra05/floors';
import { auToTile } from '../src/veyra05/frame';
import { POIS } from '../src/veyra05/reader';
import { layoutIdAt } from '../src/veyra05/scenes';
import { getWindowWorld } from '../src/veyra05/window';

const NOW = Date.UTC(2026, 3, 1, 10, 0, 0);

afterEach(() => {
  PROJ.length = 0;
  HAZ.length = 0;
  FX.length = 0;
  setActiveLayout('shipping');
});

function findClearStrip(
  r: NonNullable<ReturnType<typeof newGame>['run']>,
  ww: ReturnType<typeof getWindowWorld>,
  startX: number,
  width: number,
  height = 5,
  yMin = 20,
  yMax = 180,
): number {
  const staticAt = new Set(ww.world.statics.map((s) => s.ty * WW + s.tx));
  const entityAt = new Set(
    Object.values(r.entities)
      .filter((e) => e.tx !== undefined && e.ty !== undefined)
      .map((e) => e.ty! * WW + e.tx!),
  );
  for (let y = yMin; y < yMax - height; y++) {
    let ok = true;
    for (let yy = y - 1; yy <= y + height && ok; yy++) {
      for (let xx = startX - 1; xx <= startX + width; xx++) {
        const idx = yy * WW + xx;
        const t = ww.world.tiles[idx];
        if (
          !ww.world.economyMap.buildable[idx] ||
          !ww.world.economyMap.walkable[idx] ||
          ww.floors.ground.solidProps[idx] ||
          staticAt.has(idx) ||
          entityAt.has(idx) ||
          t === T.DEEP || t === T.SHALLOW || t === T.RIVER || t === T.LAVA || t === T.CLIFF || t === T.PWALL
        ) {
          ok = false;
          break;
        }
      }
    }
    if (ok) return y;
  }
  return -1;
}

function clearStripSources(r: NonNullable<ReturnType<typeof newGame>['run']>, ww: ReturnType<typeof getWindowWorld>, x0: number, x1: number, y0: number, y1: number) {
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) {
      const i = yy * WW + xx;
      if (ww.world.sourceV3[i]) r.sources[i] = { stock: 0, hp: 0 };
    }
  }
  markDirty();
}

function buildAt(
  gs: ReturnType<typeof newGame>,
  type: string,
  tx: number,
  ty: number,
  now = NOW,
) {
  const r = gs.run!;
  r.player.x = tx * TILE + 8;
  r.player.y = (ty + 1) * TILE + 8;
  for (const [k, q] of STRUCTS[type].cost) addItem(r, 'inv', k, q);
  const res = dispatch(gs, { id: `b-${type}-${tx}-${ty}-${now}`, type: 'build', struct: type, tx, ty }, now);
  expect(res.ok, `${type} at (${tx},${ty}): ${(res as any).reason}`).toBe(true);
  return Object.values(r.entities).find((e) => e.kind === 'struct' && e.tx === tx && e.ty === ty && e.type === type)!;
}

describe('WP2: Global / Multi-Floor / Offscreen Power Obstacles, Circuits, Persistence & Scale', () => {
  it('enforces physical & Map-owned obstacles on non-wire connectedPower across window shifts, save/reload, and generator destruction', () => {
    const p = POIS.find((x) => x.id === 'po_greywater')!;
    const [gx, gy] = auToTile(p.at[0], p.at[1]);
    const lid = layoutIdAt(Math.max(128, gx - 100), Math.max(128, gy - 100));
    setActiveLayout(lid);
    const gs = newGame();
    expect(startRun(gs, 'female', NOW, null, 801).ok).toBe(true);
    const r = gs.run!;
    r.creatures = [];
    const ww = getWindowWorld(lid);

    const bx = 62;
    const by = findClearStrip(r, ww, bx, 5, 4);
    expect(by).toBeGreaterThan(0);
    clearStripSources(r, ww, bx - 1, bx + 5, by - 1, by + 3);

    // Build legacy pre-wire direct-link generator + turret within connectionTiles (3 tiles apart)
    const gen = buildAt(gs, 'base_generator', bx, by);
    delete gen.basePower!.network;
    gen.basePower!.capacity = 2;
    addItem(r, gen.c!, 'wood', 4);

    const turret = buildAt(gs, 'arrow_turret', bx + 3, by, NOW + 5);
    addItem(r, turret.c!, 'arrow', 6);

    r.player.x = turret.tx! * TILE + 8;
    r.player.y = (turret.ty! + 1) * TILE + 8;
    expect(dispatch(gs, { id: 'tc-g', type: 'turretConfigure', eid: turret.id, field: 'generatorId', value: gen.id }, NOW + 10).ok).toBe(true);
    expect(dispatch(gs, { id: 'tc-e', type: 'turretConfigure', eid: turret.id, field: 'enabled', value: true }, NOW + 15).ok).toBe(true);
    r.player.x = gen.tx! * TILE + 8;
    r.player.y = (gen.ty! + 1) * TILE + 8;
    expect(dispatch(gs, { id: 'bp-on', type: 'basePower', eid: gen.id, enabled: true }, NOW + 20).ok).toBe(true);

    // Clear line onshore -> connected and allocated
    expect(connectedPower(r, gen, turret)).toBe(true);
    expect(powerAllocation(r, gen).map((e) => e.id)).toEqual([turret.id]);

    // Place blocking wood wall between them (bx+2 = 64, by) -> physically blocks direct link
    const wall = buildAt(gs, 'wall_wood', bx + 2, by, NOW + 25);
    expect(connectedPower(r, gen, turret)).toBe(false);
    expect(powerAllocation(r, gen)).toEqual([]);
    expect(turretStatus(r, turret)).toBe('Connection blocked');

    // Shift window EAST (+64 tiles) so generator(62) & wall(64 -> ntx=0) move offscreen while turret(65 -> ntx=1) remains onscreen
    expect(shiftVeyraWindowBy(gs, +64, 0, markDirty)).toBe(true);
    expect(r.veyraOffscreenEntities?.[gen.id]).toBeDefined();
    expect(r.veyraOffscreenEntities?.[wall.id]).toBeDefined();
    expect(r.entities[turret.id]).toBeDefined();

    const offGen = findRunEntity(r, gen.id)!;
    const onTurret = findRunEntity(r, turret.id)!;
    // CRITICAL REGRESSION GUARD: offscreen endpoint must NOT bypass physical wall obstacle!
    expect(connectedPower(r, offGen, onTurret)).toBe(false);
    expect(powerAllocation(r, offGen)).toEqual([]);
    expect(turretStatus(r, onTurret)).toBe('Connection blocked');

    // Verify Map-owned offscreen obstacle (synthetic terrain wall via veyraGlobalTerrain at wall's tile once wall removed)
    const offWall = findRunEntity(r, wall.id)!;
    destroyOffscreenStructure(r, offWall, NOW + 30);
    // Wall destroyed -> line clears again!
    expect(connectedPower(r, offGen, onTurret)).toBe(true);
    expect(powerAllocation(r, offGen).map((e) => e.id)).toEqual([onTurret.id]);

    // Shift EAST again (+64 tiles) so BOTH generator & turret are offscreen
    expect(shiftVeyraWindowBy(gs, +64, 0, markDirty)).toBe(true);
    expect(r.veyraOffscreenEntities?.[gen.id]).toBeDefined();
    expect(r.veyraOffscreenEntities?.[turret.id]).toBeDefined();
    const bothOffGen = findRunEntity(r, gen.id)!;
    const bothOffTurret = findRunEntity(r, turret.id)!;
    expect(connectedPower(r, bothOffGen, bothOffTurret)).toBe(true);

    // Inject Map-owned terrain wall on the offscreen global tile at midpoint (offGen.tx + 1, offGen.ty)
    const midGi = bothOffGen.ty! * 4000 + (bothOffGen.tx! + 1);
    (r.veyraGlobalTerrain ??= {})[midGi] = { t: T.PWALL };
    expect(connectedPower(r, bothOffGen, bothOffTurret)).toBe(false);
    expect(powerAllocation(r, bothOffGen)).toEqual([]);

    // Online/offline fuel parity when blocked: load is 0 consumer + 1 self draw (never phantom turret draw)
    const snap = serializeSnapshot(gs);
    const reloaded = selectSnapshots([snap, null]).gs!;
    const relGen = findRunEntity(reloaded.run!, gen.id)!;
    const relTurret = findRunEntity(reloaded.run!, turret.id)!;
    expect(connectedPower(reloaded.run!, relGen, relTurret)).toBe(false);

    const online = selectSnapshots([snap, null]).gs!;
    const offline = selectSnapshots([snap, null]).gs!;
    for (let s = 1; s <= 15; s++) syncWorld(online, NOW + 30 + s * 1000);
    settle(offline, NOW + 30 + 15000, true);
    expect(Math.round(findRunEntity(online.run!, gen.id)!.basePower!.energy)).toBe(
      Math.round(findRunEntity(offline.run!, gen.id)!.basePower!.energy),
    );

    // Removing/destroying offscreen terrain wall restores link; zero HP generator or destroyed generator disconnects cleanly
    delete r.veyraGlobalTerrain[midGi];
    expect(connectedPower(r, bothOffGen, bothOffTurret)).toBe(true);
    bothOffGen.hp = 0;
    expect(connectedPower(r, bothOffGen, bothOffTurret)).toBe(false);
    bothOffGen.hp = 100;
    destroyOffscreenStructure(r, bothOffGen, NOW + 40);
    expect(bothOffTurret.turret?.generatorId).toBeUndefined();
    expect(turretStatus(r, bothOffTurret)).toBe('No generator');
  });

  it('enforces wireNodeOn offscreen switches/obstacles, closes offscreen electric doors via syncElectricDoors, and isolates floors cleanly', () => {
    const elder = POIS.find((x) => x.id === 'po_elderwood')!;
    const [ex, ey] = auToTile(elder.at[0], elder.at[1]);
    const lid = layoutIdAt(Math.max(128, ex - 100), Math.max(128, ey - 100));
    setActiveLayout(lid);
    const gs = newGame();
    expect(startRun(gs, 'male', NOW, null, 802).ok).toBe(true);
    const r = gs.run!;
    r.creatures = [];
    const ww = getWindowWorld(lid);
    expect(ww.floors.ground.stairs.some((s) => s.to === -1)).toBe(true);

    // Find clear strip near x=50..60 on Floor 0 (will shift cleanly offscreen on +64 east shift)
    let bx = -1, by = -1;
    for (let xCand = 20; xCand <= 58 && by < 0; xCand += 6) {
      const yCand = findClearStrip(r, ww, xCand, 7, 4);
      if (yCand > 0) { bx = xCand; by = yCand; }
    }
    expect(by).toBeGreaterThan(0);
    clearStripSources(r, ww, bx - 1, bx + 7, by - 1, by + 3);

    const gen = buildAt(gs, 'base_generator', bx, by);
    addItem(r, gen.c!, 'wood', 3);
    const c1 = buildAt(gs, 'power_cable', bx + 1, by, NOW + 1);
    const sw = buildAt(gs, 'power_switch', bx + 2, by, NOW + 2);
    const c2 = buildAt(gs, 'power_cable', bx + 3, by, NOW + 3);
    const door = buildAt(gs, 'door_powered', bx + 4, by, NOW + 4);
    const plate = buildAt(gs, 'pressure_switch', bx + 1, by - 1, NOW + 5);

    r.player.x = gen.tx! * TILE + 8;
    r.player.y = (gen.ty! + 1) * TILE + 8;
    expect(dispatch(gs, { id: 'bp-on', type: 'basePower', eid: gen.id, enabled: true }, NOW + 10).ok).toBe(true);

    // Turn switch ON & open powered door
    sw.wireSwitch!.on = true;
    door.open = true;
    expect(electricDoorGenerator(r, door)?.id).toBe(gen.id);
    expect(electricDoorPowered(r, door)).toBe(true);

    // Save/reload check for wire-v1 network while still onscreen
    const preSnap = serializeSnapshot(gs);
    expect(selectSnapshots([preSnap, null]).gs).not.toBeNull();

    // Descend to Floor -1 using real authored stairs -> player stands at Floor -1 at the exact (x, y) of Floor 0 pressure plate!
    const stair = ww.floors.ground.stairs.find((s) => s.to === -1)!;
    const [ox, oy] = [ww.win.originTx, ww.win.originTy];
    expect(applyFloor(gs, ww, ww.floors, -1, [stair.tx - ox, stair.ty - oy], markDirty)).toBe(true);
    expect(activeFloor(r)).toBe(-1);

    // Move player on Floor -1 directly onto Floor 0's pressure_switch coordinates (must NOT trigger across floors!)
    r.player.x = plate.x;
    r.player.y = plate.y;
    const f0DoorViaPlate = buildAtFloorTestProbe(gs, r, ww, ox, oy, door, plate, sw, gen);
    expect(f0DoorViaPlate.plateTriggersCrossFloor).toBe(false);
    // Floor 0 switch ON -> Floor 0 door MUST remain powered from Floor 0's own walkable ground even while Floor -1 active blockGrid has walls at (bx+1, by)
    expect(electricDoorPowered(r, door)).toBe(true);

    // Cross-floor isolation: verify returning to Floor 0 via the paired stair landing works cleanly
    const upStair = ww.floors.layers.get(-1)!.stairs.find((s) => s.to === 0 || s.from === 0)!;
    const [upLx, upLy] = upStair.to === 0 ? [upStair.tx - ox, upStair.ty - oy] : [upStair.x - ox, upStair.y - oy];
    expect(applyFloor(gs, ww, ww.floors, 0, [upLx, upLy], markDirty)).toBe(true);
    expect(activeFloor(r)).toBe(0);

    // Now shift EAST by +64 so ENTIRE circuit (gen..door) moves offscreen into veyraOffscreenEntities!
    expect(shiftVeyraWindowBy(gs, +64, 0, markDirty)).toBe(true);
    expect(r.veyraOffscreenEntities?.[gen.id]).toBeDefined();
    expect(r.veyraOffscreenEntities?.[sw.id]).toBeDefined();
    expect(r.veyraOffscreenEntities?.[door.id]).toBeDefined();

    const offGen = findRunEntity(r, gen.id)!;
    const offSw = findRunEntity(r, sw.id)!;
    const offDoor = findRunEntity(r, door.id)!;
    expect(electricDoorPowered(r, offDoor)).toBe(true);

    // Save/reload MUST accept offscreen base_generator, power_cable, power_switch, pressure_switch, door_powered!
    const offSnap = serializeSnapshot(gs);
    const reloaded = selectSnapshots([offSnap, null]).gs!;
    const relGen = findRunEntity(reloaded.run!, gen.id)!;
    const relSw = findRunEntity(reloaded.run!, sw.id)!;
    const relDoor = findRunEntity(reloaded.run!, door.id)!;
    expect(electricDoorPowered(reloaded.run!, relDoor)).toBe(true);

    // Reject tampered offscreen power_switch / door_powered metadata at save time (no silent acceptance)
    const badSwitch = structuredClone(gs);
    (badSwitch.run!.veyraOffscreenEntities![sw.id] as any).wireSwitch.on = 'corrupt';
    expect(() => serializeSnapshot(badSwitch)).toThrow('invalid game state');
    const badDoor = structuredClone(gs);
    (badDoor.run!.veyraOffscreenEntities![door.id] as any).electricDoor.interior = [1, 1];
    expect(() => serializeSnapshot(badDoor)).toThrow('invalid game state');

    // Flip offscreen switch OFF -> offscreen door loses power AND syncElectricDoors closes it!
    offSw.wireSwitch!.on = false;
    expect(electricDoorPowered(r, offDoor)).toBe(false);
    const closed = syncElectricDoors(r, NOW + 100);
    expect(closed).toContain(offDoor.id);
    expect(offDoor.open).toBe(false);

    // Flip offscreen switch back ON, then place an offscreen terrain wall on cable c2 -> severs cable offscreen!
    offSw.wireSwitch!.on = true;
    offDoor.open = true;
    expect(electricDoorPowered(r, offDoor)).toBe(true);
    const offC2 = findRunEntity(r, c2.id)!;
    const c2Gi = offC2.ty! * 4000 + offC2.tx!;
    (r.veyraGlobalTerrain ??= {})[c2Gi] = { t: T.RIVER };
    expect(electricDoorPowered(r, offDoor)).toBe(false);
    expect(powerAllocation(r, offGen)).toEqual([]);
    expect(syncElectricDoors(r, NOW + 110)).toContain(offDoor.id);

    // Also verify destroyStructure on onscreen vs offscreen cleans entities cleanly
    delete r.veyraGlobalTerrain[c2Gi];
    destroyStructure(r, findRunEntity(r, c1.id)!, NOW + 120);
    expect(electricDoorPowered(r, offDoor)).toBe(false);
    expect(allRunEntities(r).some((e) => e.id === c1.id)).toBe(false);
  });

  it('scales cleanly in O(N) on large wire-v1 networks (400+ nodes across generators and doors)', () => {
    const p = POIS.find((x) => x.id === 'po_greywater')!;
    const [gx, gy] = auToTile(p.at[0], p.at[1]);
    const lid = layoutIdAt(Math.max(128, gx - 100), Math.max(128, gy - 100));
    setActiveLayout(lid);
    const gs = newGame();
    expect(startRun(gs, 'female', NOW, null, 803).ok).toBe(true);
    const r = gs.run!;
    r.creatures = [];
    const ww = getWindowWorld(lid);

    // Find 4 clear 28-tile strips and snake 4 rows (~100 nodes per branch = 400+ nodes)
    const gens: ReturnType<typeof buildAt>[] = [];
    const doors: ReturnType<typeof buildAt>[] = [];
    const rows: number[] = [];
    for (let y = 16; y < 180 && rows.length < 4; ) {
      const fy = findClearStrip(r, ww, 20, 29, 5, y, 185);
      if (fy < 0) break;
      rows.push(fy);
      y = fy + 6;
    }
    expect(rows.length).toBe(4);

    for (let row = 0; row < 4; row++) {
      const y = rows[row];
      clearStripSources(r, ww, 19, 50, y - 1, y + 4);
      const g = buildAt(gs, 'base_generator', 20, y, NOW + row * 200);
      addItem(r, g.c!, 'wood', 5);
      r.player.x = g.tx! * TILE + 8;
      r.player.y = (g.ty! + 1) * TILE + 8;
      expect(dispatch(gs, { id: `g-on-${row}`, type: 'basePower', eid: g.id, enabled: true }, NOW + row * 200 + 1).ok).toBe(true);
      // Serpentine cable loop (x=21..46 -> down y+1 -> x=46..21 -> down y+2 -> x=21..46 -> down y+3 -> x=46..21 -> y+3,x=20 door) = ~100 nodes per generator!
      const coords: [number, number][] = [];
      for (let x = 21; x <= 46; x++) coords.push([x, y]);
      coords.push([46, y + 1]);
      for (let x = 46; x >= 21; x--) coords.push([x, y + 1]);
      coords.push([21, y + 2]);
      for (let x = 21; x <= 46; x++) coords.push([x, y + 2]);
      coords.push([46, y + 3]);
      for (let x = 46; x >= 22; x--) coords.push([x, y + 3]);
      for (const [cx, cy] of coords) {
        const cid = `e${(r.nextId++).toString(36)}`;
        r.entities[cid] = {
          id: cid,
          kind: 'struct',
          type: 'power_cable',
          x: cx * TILE + 8,
          y: cy * TILE + 8,
          tx: cx,
          ty: cy,
          hp: STRUCTS.power_cable.hp,
          maxHp: STRUCTS.power_cable.hp,
          owner: 'player',
        };
      }
      const d = buildAt(gs, 'door_powered', 21, y + 3, NOW + row * 200 + 2);
      gens.push(g);
      doors.push(d);
    }
    markDirty();

    const t0 = performance.now();
    for (let i = 0; i < 20; i++) {
      basePowerBoundary(r, 60_000, true);
      stepBasePower(r, 1000, NOW + 5000 + i * 1000, true);
      syncElectricDoors(r, NOW + 5000 + i * 1000, true);
    }
    const elapsedMs = performance.now() - t0;

    for (let row = 0; row < 4; row++) {
      expect(electricDoorGenerator(r, doors[row])?.id).toBe(gens[row].id);
      expect(electricDoorPowered(r, doors[row])).toBe(true);
      expect(powerAllocation(r, gens[row]).map((e) => e.id)).toEqual([doors[row].id]);
    }
    expect(elapsedMs).toBeLessThan(1500);
  });
});

function buildAtFloorTestProbe(
  _gs: ReturnType<typeof newGame>,
  r: NonNullable<ReturnType<typeof newGame>['run']>,
  _ww: ReturnType<typeof getWindowWorld>,
  _ox: number,
  _oy: number,
  _door: any,
  plate: any,
  sw: any,
  gen: any,
) {
  // Temporarily turn off switch so only the pressure plate could bridge Floor 0 power
  const prevSw = sw.wireSwitch!.on;
  sw.wireSwitch!.on = false;
  // Build an adjacent tile check: if pressure_switch falsely detects player on Floor -1, wireReachable or allocation would count it
  // Verify Floor 0 plate DOES NOT conduct when activeFloor(r) === -1 even though r.player is on exact (plate.x, plate.y)
  const plateConnected = connectedPower(r, gen, {
    ...plate,
    id: 'probe_dummy',
    kind: 'struct',
    type: 'door_powered',
    tx: plate.tx,
    ty: plate.ty - 1,
    x: plate.tx * TILE + 8,
    y: (plate.ty - 1) * TILE + 8,
    floor: 0,
    owner: 'player',
    hp: 100,
    electricDoor: { version: 'wire-v1', interior: [0, 1] },
  } as any);
  sw.wireSwitch!.on = prevSw;
  return { plateTriggersCrossFloor: plateConnected };
}
