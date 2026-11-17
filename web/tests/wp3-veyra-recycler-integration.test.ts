import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  T,
  TILE,
  WH,
  WW,
  type Entity,
  type GameState,
  type RunState,
} from '../src/game/core';
import { ITEMS, STRUCTS, WORKBENCH_UPGRADE } from '../src/game/catalog';
import {
  blockGrid,
  C,
  countItem,
  dispatch,
  effTile,
  entsAt,
  harvestHit,
  markDirty,
  newGame,
  sourceAt,
  startRun,
} from '../src/game/engine';
import { selectSnapshots, serializeSnapshot, validate } from '../src/game/persist';
import { FX, HAZ, PROJ, findInteract, settle } from '../src/game/sim';
import { getWorld, setActiveLayout, VEYRA_RECYCLER_SITE } from '../src/game/world';
import { hasAuthorizedRecycler } from '../src/game/wreck-economy';
import { maybeSlideVeyraWindow, windowOrigin } from '../src/veyra05/continuity';
import { activeFloor, applyFloor, stairAt } from '../src/veyra05/floors';
import { getWindowWorld, resetWindowToGround } from '../src/veyra05/window';

const salvageTrace: {source:string; global:[number,number]; uid:string; qty:number}[]=[];
const NOW = process.env.SOH_WP3_SNAP_DIR ? Date.now() - 1_200_000 : Date.UTC(2026, 10, 11, 13, 0, 0);

afterEach(() => {
  salvageTrace.length=0;
  PROJ.length = 0;
  HAZ.length = 0;
  FX.length = 0;
  setActiveLayout('shipping');
});

/** Walk along real walkable, non-blocked tiles (opening closed authored doors on the path) — never teleports across walls. */
function walkPathTo(
  gs: GameState,
  goalTiles: Set<number>,
  nowRef: { t: number },
): { tx: number; ty: number } | null {
  const r = gs.run!;
  const sx = Math.floor(r.player.x / TILE);
  const sy = Math.floor(r.player.y / TILE);
  const startIdx = sy * WW + sx;
  if (goalTiles.has(startIdx)) return { tx: sx, ty: sy };

  const g = blockGrid(r);
  const closedDoors = new Map<number, Entity>();
  for (const e of Object.values(r.entities)) {
    if (e.kind === 'door' && !e.open && e.tx !== undefined && e.ty !== undefined && !e.locked) {
      closedDoors.set(e.ty * WW + e.tx, e);
    }
  }

  const prev = new Int32Array(WW * WH).fill(-1);
  const visited = new Uint8Array(WW * WH);
  const q: number[] = [startIdx];
  visited[startIdx] = 1;
  let found = -1;

  for (let head = 0; head < q.length; head++) {
    const cur = q[head];
    if (goalTiles.has(cur)) { found = cur; break; }
    const cx = cur % WW, cy = (cur / WW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 1 || ny < 1 || nx >= WW - 1 || ny >= WH - 1) continue;
      const ni = ny * WW + nx;
      if (visited[ni]) continue;
      const b = g[ni];
      const passable = (b === 0 || b === 4) || (b === 3 && closedDoors.has(ni));
      if (!passable) continue;
      visited[ni] = 1;
      prev[ni] = cur;
      q.push(ni);
    }
  }
  if (found < 0) return null;

  const path: number[] = [];
  for (let c = found; c !== -1; c = prev[c]) path.push(c);
  path.reverse();

  for (const idx of path) {
    const tx = idx % WW, ty = (idx / WW) | 0;
    const door = closedDoors.get(idx);
    if (door && !door.open) {
      const openRes = dispatch(gs, { id: `open-${door.id}-${nowRef.t}`, type: 'door', eid: door.id }, nowRef.t);
      expect(openRes.ok).toBe(true);
      nowRef.t += 100;
    }
    r.player.x = tx * TILE + 8;
    r.player.y = ty * TILE + 8;
    nowRef.t += 120;
  }
  return { tx: found % WW, ty: (found / WW) | 0 };
}

function adjacentWalkableGoals(r: RunState, tx: number, ty: number): Set<number> {
  const g = blockGrid(r);
  const out = new Set<number>();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ax = tx + dx, ay = ty + dy;
    if (ax < 1 || ay < 1 || ax >= WW - 1 || ay >= WH - 1) continue;
    const b = g[ay * WW + ax];
    if (b === 0 || b === 4) out.add(ay * WW + ax);
  }
  return out;
}

function findReachableSources(r: RunState, keys: readonly string[], now: number): { tx: number; ty: number; key: string }[] {
  const g = blockGrid(r);
  const sx = Math.floor(r.player.x / TILE);
  const sy = Math.floor(r.player.y / TILE);
  const visited = new Uint8Array(WW * WH);
  const q: number[] = [sy * WW + sx];
  visited[sy * WW + sx] = 1;
  const want = new Set(keys);
  const found: { tx: number; ty: number; key: string }[] = [];
  const seenSrc = new Set<number>();

  for (let head = 0; head < q.length; head++) {
    const cur = q[head];
    const cx = cur % WW, cy = (cur / WW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 1 || ny < 1 || nx >= WW - 1 || ny >= WH - 1) continue;
      const ni = ny * WW + nx;
      const src = sourceAt(r, nx, ny, now);
      if (src && src.stock > 0 && want.has(src.key) && !seenSrc.has(ni)) {
        seenSrc.add(ni);
        found.push({ tx: nx, ty: ny, key: src.key });
      }
      if (!visited[ni] && (g[ni] === 0 || g[ni] === 4)) {
        visited[ni] = 1;
        q.push(ni);
      }
    }
  }
  return found;
}

/** Compact identical stackable slots in 'inv' via real 'move' intents (same as dragging partial stacks together in the UI). */
function compactInv(gs: GameState, nowRef: { t: number }) {
  const r = gs.run!;
  const slots = C(r, 'inv').slots;
  for (let i = 0; i < slots.length; i++) {
    const dst = slots[i];
    if (!dst || dst.meta !== undefined || dst.dur !== undefined || dst.charge !== undefined) continue;
    const max = ITEMS[dst.key].max;
    if (max <= 1 || dst.qty >= max) continue;
    for (let j = slots.length - 1; j > i; j--) {
      const src = slots[j];
      if (!src || src.key !== dst.key || src.meta !== undefined || src.dur !== undefined || src.charge !== undefined) continue;
      if (dst.qty >= max) break;
      const mv = dispatch(gs, { id: `cmp-${i}-${j}-${nowRef.t}`, type: 'move', from: 'inv', fs: j, to: 'inv', ts: i }, nowRef.t);
      if (mv.ok) nowRef.t += 20;
    }
  }
}

function harvestSourceNaturally(
  gs: GameState,
  tx: number,
  ty: number,
  toolKey: string,
  nowRef: { t: number },
  expectedKeys: readonly string[],
): void {
  const r = gs.run!;
  const goals = adjacentWalkableGoals(r, tx, ty);
  if (!goals.size) return;
  if (!walkPathTo(gs, goals, nowRef)) return;

  const source=sourceAt(r,tx,ty,nowRef.t)!;const [ox,oy]=windowOrigin(r);
  const priorDrops=new Set(Object.keys(r.entities));
  const power = ITEMS[toolKey].power || {};
  for (let hit = 0; hit < 40; hit++) {
    const res = harvestHit(gs, tx, ty, power, nowRef.t, r.player.x, r.player.y, { extraction: 'playerTool', tool: toolKey });
    nowRef.t += 350;
    if (res.result !== 'yield' || res.depleted) break;
  }

  const want = new Set(expectedKeys);
  const drops = Object.values(r.entities)
    .filter((e) => e.kind === 'drop' && !priorDrops.has(e.id) && e.c && want.has(C(r, e.c).slots[0]?.key || ''))
    .sort((a, b) => {
      const ka = C(r, a.c!).slots[0]?.key === 'mechanical_gear' ? 0 : 1;
      const kb = C(r, b.c!).slots[0]?.key === 'mechanical_gear' ? 0 : 1;
      return ka - kb;
    });

  for (const e of drops) {
    const st = C(r, e.c!).slots[0];
    if (!st) continue;
    const dtx = Math.floor(e.x / TILE), dty = Math.floor(e.y / TILE);
    const pGoals = new Set<number>([
      ...(blockGrid(r)[dty * WW + dtx] === 0 ? [dty * WW + dtx] : []),
      ...adjacentWalkableGoals(r, dtx, dty),
    ]);
    if (pGoals.size && walkPathTo(gs, pGoals, nowRef)) {
      const pk = dispatch(gs, { id: `pk-${e.id}-${nowRef.t}`, type: 'pickup', eid: e.id }, nowRef.t);
      if (pk.ok) {
        if(st.key==='mechanical_gear')salvageTrace.push({source:source.key,global:[tx+ox,ty+oy],uid:st.uid,qty:st.qty});
        nowRef.t += 100;
      }
    }
  }
  compactInv(gs, nowRef);

}

describe('WP3: End-to-End Veyra Natural-Source -> Foundry Recycler -> Spend -> Floor -1 -> Save/Reload Integration Proof', () => {
  it('harvests natural Veyra wrecks/resources (zero item injection), recycles natural gears at po_slag into Parts/ingots, pays a Workbench upgrade, and survives mandatory Floor -1 reload', () => {
    // 1. Start a fresh canonical Veyra05 world run (region 1 = Greywater; zero qaUsed, zero inspectAt, zero addItem)
    setActiveLayout('veyra05-world');
    const gs = newGame();
    expect(startRun(gs, 'female', NOW, 1, 901).ok).toBe(true);
    const r = gs.run!;
    expect(r.qaUsed).toBe(false);
    expect(r.wreckEconomy).toBe('recycler-v1');
    expect(hasAuthorizedRecycler(r)).toBe(true);
    expect(countItem(r, 'inv', 'mechanical_gear')).toBe(0);
    expect(countItem(r, 'inv', 'spares')).toBe(0);
    r.creatures = []; // isolate integration from random ambient combat interruptions

    const nowRef = { t: NOW + 1000 };

    // 2. Harvest natural wood, stone and current Relay Wrecks in Greywater before transporting salvage to Slag Flats.
    const WOOD_SOURCES = ['oak', 'pine', 'snowpine', 'palm', 'willow'] as const;
    for (const src of findReachableSources(r, WOOD_SOURCES, nowRef.t)) {
      if (countItem(r, 'inv', 'wood') >= 14) break;
      harvestSourceNaturally(gs, src.tx, src.ty, 'knife', nowRef, ['wood']);
    }
    for (const src of findReachableSources(r, ['rock'], nowRef.t)) {
      if (countItem(r, 'inv', 'stone') >= 4) break;
      harvestSourceNaturally(gs, src.tx, src.ty, 'knife', nowRef, ['stone']);
    }

    const harvestNearby = (wantGears: number) => {
      for (const w of findReachableSources(r, ['wreck','road_relay_wreck'], nowRef.t)) {
        if (countItem(r, 'inv', 'mechanical_gear') >= wantGears) break;
        harvestSourceNaturally(gs, w.tx, w.ty, 'knife', nowRef, ['mechanical_gear', 'spares']);
      }
    };

    harvestNearby(2);

    // Physical reachability witness, NOT a survival bot/enjoyment proof: follow adjacent legal cells and open doors.
    // Stream windows toward the Recycler while carrying at least two naturally salvaged gears.
    const hasRecyclerInWindow = () => Object.values(r.entities).some((e) => e.kind === 'recycler');
    for (let step = 0; step < 30; step++) {
      const [ox, oy] = windowOrigin(r);
      const localRecX = VEYRA_RECYCLER_SITE.tx - ox;
      const localRecY = VEYRA_RECYCLER_SITE.ty - oy;
      const recCentered =
        hasRecyclerInWindow() &&
        localRecX >= 30 &&
        localRecX <= WW - 30 &&
        localRecY >= 30 &&
        localRecY <= WH - 30;
      if (recCentered && countItem(r, 'inv', 'mechanical_gear') >= 2) break;

      const curGlobX = ox + Math.floor(r.player.x / TILE);
      const curGlobY = oy + Math.floor(r.player.y / TILE);
      const dxGlob = VEYRA_RECYCLER_SITE.tx - curGlobX;
      const dyGlob = VEYRA_RECYCLER_SITE.ty - curGlobY;
      // If two gears have not been found at po_slag, inspect adjacent reachable windows without changing sources/RNG.
      const sweepDirX = dxGlob > 30 ? WW - 12 : dxGlob < -30 ? 12 : step % 2 === 0 ? WW - 12 : 100;
      const sweepDirY = dyGlob > 30 ? WH - 12 : dyGlob < -30 ? 12 : step % 2 === 1 ? WH - 12 : 100;
      const edgeTx = recCentered ? (step % 2 === 0 ? WW - 12 : 12) : sweepDirX;
      const edgeTy = recCentered ? 100 : sweepDirY;

      const g = blockGrid(r);
      const targets = new Set<number>();
      for (let rad = 0; rad < 32 && targets.size === 0; rad++) {
        for (let dy = -rad; dy <= rad; dy++) {
          for (let dx = -rad; dx <= rad; dx++) {
            const tx = Math.max(2, Math.min(WW - 3, edgeTx + dx));
            const ty = Math.max(2, Math.min(WH - 3, edgeTy + dy));
            if (g[ty * WW + tx] === 0) targets.add(ty * WW + tx);
          }
        }
      }
      if (targets.size && walkPathTo(gs, targets, nowRef)) {
        const slid = maybeSlideVeyraWindow(gs, markDirty);
        r.creatures = []; // keep test deterministic (no ambient monster ambush while testing industrial flow)
        if (slid && (countItem(r, 'inv', 'mechanical_gear') < 2)) {
          harvestNearby(2);
        }
      }
    }

    const gearCount = countItem(r, 'inv', 'mechanical_gear');
    expect(gearCount).toBeGreaterThanOrEqual(2);
    expect(salvageTrace.reduce((n,x)=>n+x.qty,0)).toBe(gearCount);
    expect(salvageTrace.every(x=>x.source==='road_relay_wreck'||x.source==='wreck')).toBe(true);

    // Harvest and pickup are real engine calls; no addItem, QA, free gear or altered stock.
    // The source contract, not a retired drive-specific receipt, authorizes this finite salvage.
    expect(ITEMS.mechanical_gear).toBeDefined();
    expect(countItem(r,'inv','damaged_drive')).toBe(0);

    // 4. Locate po_slag's Foundry Recycler (already streamed into window via pure walking) and walk right through slag_sort's door to it
    const rec = Object.values(r.entities).find((e) => e.kind === 'recycler')!;
    expect(rec).toBeTruthy();
    const [curOx, curOy] = windowOrigin(r);
    expect(rec.tx).toBe(VEYRA_RECYCLER_SITE.tx - curOx);
    expect(rec.ty).toBe(VEYRA_RECYCLER_SITE.ty - curOy);

    const recGoals = adjacentWalkableGoals(r, rec.tx!, rec.ty!);
    expect(walkPathTo(gs, recGoals, nowRef)).not.toBeNull();

    // Record incidental spares (if any dropped from wrecks) to verify exact Recycler delta independently
    const incidentalSpares = countItem(r, 'inv', 'spares');

    // Synchronize simulation clock to current action timestamp before timed station processing
    r.creatures = [];
    settle(gs, nowRef.t, true);
    if (r.player.dead) {
      throw new Error(`Player died before recycling: ${JSON.stringify(r.receipts.filter(rc => rc.kind === 'death'))}`);
    }

    const snapDir = process.env.SOH_WP3_SNAP_DIR;
    if (snapDir) {
      mkdirSync(snapDir, { recursive: true });
      r.player.aim = Math.atan2(rec.y - r.player.y, rec.x - r.player.x);
      expect(findInteract(gs, nowRef.t)?.kind).toBe('recycler');
      writeFileSync(resolve(snapDir, 'po-slag-recycler.json'), serializeSnapshot(gs), 'utf8');
    }

    // Pay two naturally salvaged gears, one physical instance at a time: X:gear-v2 -> 4 Parts + 2 ingots
    for (let i = 0; i < 2; i++) {
      let slot = C(r, 'inv').slots.findIndex((s) => s?.key === 'mechanical_gear');
      expect(slot).toBeGreaterThanOrEqual(0);
      while(C(r,'inv').slots[slot]!.qty>1){
        expect(dispatch(gs,{id:`split-gear-${i}-${nowRef.t++}`,type:'split',c:'inv',slot},nowRef.t).ok).toBe(true);
        slot=C(r,'inv').slots.findIndex(s=>s?.key==='mechanical_gear'&&s.qty===1);
        if(slot<0)slot=C(r,'inv').slots.findIndex(s=>s?.key==='mechanical_gear');
      }
      const stack = C(r, 'inv').slots[slot]!;
      // Bring the world to the command boundary before starting new paid work.
      settle(gs,nowRef.t,true);const startedAt=nowRef.t;
      const startRec = dispatch(gs, { id: `rec-${i}-${nowRef.t}`, type: 'recycleItem', eid: rec.id, slot, uid: stack.uid }, nowRef.t);
      expect(startRec.ok, (startRec as any).reason).toBe(true);
      expect(rec.station!.queue[0]).toMatchObject({recipe:'X:gear-v2',total:15000,reserved:[{uid:stack.uid}]});
      expect(C(r,'inv').slots.some(s=>s?.uid===stack.uid)).toBe(false);
      const job=rec.station!.queue[0];
      expect(dispatch(gs,{id:`busy-rec-${i}`,type:'recycleItem',eid:rec.id,slot,uid:stack.uid},nowRef.t).ok).toBe(false);
      expect(rec.station!.queue).toEqual([job]);
      if(i===0){
        let other=C(r,'inv').slots.findIndex(s=>s?.key==='mechanical_gear');
        while(C(r,'inv').slots[other]!.qty>1){
          expect(dispatch(gs,{id:`split-busy-${nowRef.t++}`,type:'split',c:'inv',slot:other},nowRef.t).ok).toBe(true);
          const single=C(r,'inv').slots.findIndex(s=>s?.key==='mechanical_gear'&&s.qty===1);
          if(single>=0)other=single;
        }
        const invBefore=JSON.stringify(C(r,'inv'));
        expect(dispatch(gs,{id:'busy-valid-input',type:'recycleItem',eid:rec.id,slot:other,uid:C(r,'inv').slots[other]!.uid},nowRef.t)).toMatchObject({ok:false,reason:'Recycler is already processing an item.'});
        expect(JSON.stringify(C(r,'inv'))).toBe(invBefore);
      }
      settle(gs,startedAt+14999,true);
      expect(countItem(r,rec.station!.outC,'spares')).toBe(i*2);
      expect(rec.station!.queue).toHaveLength(1);
      const pending=selectSnapshots([serializeSnapshot(gs)]).gs!;
      settle(pending,startedAt+15000,true);
      expect(countItem(pending.run!,pending.run!.entities[rec.id].station!.outC,'spares')).toBe((i+1)*2);
      settle(gs, startedAt + 15000, true);
      if (r.player.dead) {
        throw new Error(`Player died during recycle #${i}: ${JSON.stringify(r.receipts.filter(rc => rc.kind === 'death'))}`);
      }
      nowRef.t += 15500;
    }

    const outC = rec.station!.outC;
    expect(countItem(r, outC, 'spares')).toBe(4);
    expect(countItem(r,outC,'iron_ingot')).toBe(2);
    const outSlot = C(r, outC).slots.findIndex((s) => s?.key === 'spares');
    const colRes = dispatch(gs, { id: `col-spares-${nowRef.t}`, type: 'move', from: outC, fs: outSlot, to: 'inv' }, nowRef.t);
    expect(colRes.ok, (colRes as any).reason).toBe(true);
    expect(countItem(r, 'inv', 'spares')).toBe(incidentalSpares + 4);
    const ingotSlot=C(r,outC).slots.findIndex(s=>s?.key==='iron_ingot');
    expect(dispatch(gs,{id:`col-ingot-${nowRef.t}`,type:'move',from:outC,fs:ingotSlot,to:'inv'},nowRef.t).ok).toBe(true);
    nowRef.t += 500;

    // Spend current Recycler outputs at a real, naturally funded packed Workbench.
    const buildOpenSpot = (structKey: string) => {
      const item=STRUCTS[structKey].item!;
      expect(dispatch(gs,{id:`natural-pack-${structKey}-${nowRef.t}`,type:'craft',recipe:item},nowRef.t).ok).toBe(true);
      const pack=C(r,'inv').slots.find(s=>s?.key===item)!;
      const g = blockGrid(r);
      const w = getWorld();
      const sx0 = Math.floor(r.player.x / TILE), sy0 = Math.floor(r.player.y / TILE);
      const seen = new Uint8Array(WW * WH);
      const q: number[] = [sy0 * WW + sx0];
      seen[sy0 * WW + sx0] = 1;
      const badTiles = new Set<number>([T.DEEP, T.SHALLOW, T.RIVER, T.CLIFF, T.PWALL, T.LAVA, T.FLOOR, T.ICE, T.ROAD, T.BRIDGE]);
      let tries = 0;
      let lastReason = 'no-buildable-tile-found';

      for (let head = 0; head < q.length; head++) {
        const cur = q[head];
        const tx = cur % WW, ty = (cur / WW) | 0;
        if (
          tx > 2 && ty > 2 && tx < WW - 3 && ty < WH - 3 &&
          g[cur] === 0 &&
          w.economyMap.buildable[cur] &&
          !w.economyMap.protected[cur] &&
          !w.accessCorridors?.mask[cur] &&
          !badTiles.has(effTile(r, tx, ty)) &&
          !(sourceAt(r, tx, ty)?.stock ?? 0) &&
          entsAt(r, tx, ty).length === 0
        ) {
          const adj = adjacentWalkableGoals(r, tx, ty);
          if (adj.size && walkPathTo(gs, adj, nowRef)) {
            const b = dispatch(gs, { id: `b-${structKey}-${tx}-${ty}-${nowRef.t}`, type: 'build', struct: structKey, tx, ty }, nowRef.t);
            if (b.ok) {
              nowRef.t += 200;
              const placed=Object.values(r.entities).find((e) => e.kind === 'struct' && e.type === structKey && e.tx === tx && e.ty === ty)!;
              expect(placed.deployed!.uid).toBe(pack.uid);
              return placed;
            }
            lastReason = `${(b as any).reason} (wood=${countItem(r, 'inv', 'wood')}, stone=${countItem(r, 'inv', 'stone')}, spares=${countItem(r, 'inv', 'spares')})`;
            if (++tries >= 5) throw new Error(`buildOpenSpot(${structKey}) failed at ${tx},${ty}: ${lastReason}`);
          }
        }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = tx + dx, ny = ty + dy;
          if (nx < 1 || ny < 1 || nx >= WW - 1 || ny >= WH - 1) continue;
          const ni = ny * WW + nx;
          if (!seen[ni] && (g[ni] === 0 || g[ni] === 4)) {
            seen[ni] = 1;
            q.push(ni);
          }
        }
      }
      throw new Error(`buildOpenSpot(${structKey}) exhausted BFS: ${lastReason}`);
    };

    const bench=buildOpenSpot('workbench');
    expect(walkPathTo(gs,adjacentWalkableGoals(r,bench.tx!,bench.ty!),nowRef)).not.toBeNull();
    const sparesBeforeSpend=countItem(r,'inv','spares');
    const ingotsBeforeSpend=countItem(r,'inv','iron_ingot');
    expect(WORKBENCH_UPGRADE.cost).toEqual([['iron_ingot',2],['spares',4]]);
    expect(dispatch(gs,{id:`upg-bench-${nowRef.t}`,type:'upgradeStation',eid:bench.id},nowRef.t).ok).toBe(true);
    expect(bench.station!.level).toBe(2);
    expect(countItem(r,'inv','spares')).toBe(sparesBeforeSpend-4);
    expect(countItem(r,'inv','iron_ingot')).toBe(ingotsBeforeSpend-2);

    // Zero QA/inspect/cheat tampering across the whole natural loop
    expect(r.qaUsed).toBe(false);
    expect(r.receipts.some((rc) => rc.kind.startsWith('qa') || rc.kind === 'inspect')).toBe(false);

    // 6. MANDATORY Floor -1 Descent, Save/Reload, and Return (NO `if` skip guards, NO window teleports!)
    // Walk inside po_slag to the Ground -> Floor -1 stair (`Quench drain service hatch`), descend, save/reload, and ascend back to Floor 0.
    const slagWw = getWindowWorld(r.layoutId!);
    const stairToB1 = slagWw.floors.ground.stairs.find((s) => s.to === -1 && s.from === 0)!;
    expect(stairToB1).toBeDefined();

    const [winOx, winOy] = windowOrigin(r);
    const sx = stairToB1.x - winOx;
    const sy = stairToB1.y - winOy;
    expect(walkPathTo(gs, new Set([sy * WW + sx]), nowRef)).not.toBeNull();

    // Verify stairAt recognizes the exact Ground -> -1 stair landing and descend cleanly
    const resolvedStair = stairAt(slagWw.floors, r, sx, sy);
    expect(resolvedStair).not.toBeNull();
    expect(resolvedStair!.to).toBe(-1);

    expect(
      applyFloor(
        gs,
        slagWw,
        slagWw.floors,
        -1,
        [stairToB1.tx - winOx, stairToB1.ty - winOy],
        markDirty,
      ),
    ).toBe(true);
    expect(activeFloor(r)).toBe(-1);
    expect(hasAuthorizedRecycler(r)).toBe(true);

    // Save & cold reload WHILE standing on Floor -1
    const snapB1 = serializeSnapshot(gs);
    if (snapDir) {
      writeFileSync(resolve(snapDir, 'floor-minus1.json'), snapB1, 'utf8');
    }
    const parsedB1 = JSON.parse(snapB1);
    expect(validate(JSON.parse(parsedB1.payload))).toBeTruthy();
    const reloaded = selectSnapshots([snapB1, null]).gs!;
    expect(reloaded).toBeTruthy();
    expect(activeFloor(reloaded.run!)).toBe(-1);
    expect(hasAuthorizedRecycler(reloaded.run!)).toBe(true);
    expect(reloaded.run!.wreckEconomy).toBe('recycler-v1');
    expect(reloaded.run!.qaUsed).toBe(false);
    // Same packed Workbench UID, paid level and remaining Parts survive Floor -1 cold reload
    expect(reloaded.run!.entities[bench.id]?.station?.level).toBe(2);
    expect(reloaded.run!.entities[bench.id]?.deployed?.uid).toBe(bench.deployed!.uid);
    expect(countItem(reloaded.run!, 'inv', 'spares')).toBe(sparesBeforeSpend - 4);

    // Ascend back to Floor 0 using the Floor -1 return stair
    const loadedWw = getWindowWorld(reloaded.run!.layoutId!);
    const returnStair = loadedWw.floors.layers.get(-1)!.stairs.find((s) => s.to === 0 || s.from === 0)!;
    const [lOx, lOy] = windowOrigin(reloaded.run!);
    const [upLx, upLy] =
      returnStair.to === 0
        ? [returnStair.tx - lOx, returnStair.ty - lOy]
        : [returnStair.x - lOx, returnStair.y - lOy];
    expect(applyFloor(reloaded, loadedWw, loadedWw.floors, 0, [upLx, upLy], markDirty)).toBe(true);
    expect(activeFloor(reloaded.run!)).toBe(0);
    expect(reloaded.run!.entities[bench.id]?.station?.level).toBe(2);

    resetWindowToGround(loadedWw);
  });
});
