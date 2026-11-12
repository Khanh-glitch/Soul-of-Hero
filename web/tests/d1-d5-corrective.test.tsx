// Corrective D1-D5 Verification & Negative-Contract Suite
// Covers:
//   D1: Journey requisition securedCash === 0 (never mints off-map, never touches pre-existing escrow securedCash, overflows pack cleanly to bag)
//   D2: BUILD_ORDER exposes ir_sensor & bear_trap so Classic BuildPanel Defense tab surfaces both
//   D3: Veyra po_greywater Tackle Box (24/24 authored) & po_glade glade_sanctum archetype cache materialize cleanly without regressing Elderwood
//   D4: Offscreen & window-boundary-straddling wire-v1 power network parity (online === offline === shifted) + 12h decay copy
//   D5: Veyra po_slag physical Foundry Recycler (recycler-v1, X:drive recycling, offscreen->onscreen streaming, floor -1 reload, legacy direct-v1 untouched)

const noopCtx: any = new Proxy(
  function () {},
  {
    get: (_t, k) => (k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : noopCtx),
    apply: () => noopCtx,
    set: () => true,
  },
);

class MiniNode {
  nodeType = 1;
  nodeName = 'DIV';
  tagName = 'DIV';
  namespaceURI = 'http://www.w3.org/1999/xhtml';
  parentNode: MiniNode | null = null;
  childNodes: MiniNode[] = [];
  attributes = new Map<string, string>();
  dataset: Record<string, string> = {};
  style: Record<string, any> = {};
  listeners = new Map<string, Set<(ev: any) => void>>();
  nodeValue: string | null = null;
  ownerDocument: any;
  width = 312;
  height = 260;

  constructor(tag: string, doc: any, type = 1, val: string | null = null) {
    this.nodeType = type;
    this.nodeName = tag.toUpperCase();
    this.tagName = this.nodeName;
    this.ownerDocument = doc;
    this.nodeValue = val;
  }
  get firstChild(): MiniNode | null { return this.childNodes[0] ?? null; }
  get nextSibling(): MiniNode | null {
    if (!this.parentNode) return null;
    const i = this.parentNode.childNodes.indexOf(this);
    return i >= 0 ? this.parentNode.childNodes[i + 1] ?? null : null;
  }
  get textContent(): string {
    if (this.nodeType === 3) return this.nodeValue ?? '';
    if (this.nodeType === 8) return '';
    return this.childNodes.map(c => c.textContent).join('');
  }
  set textContent(v: string) {
    if (this.nodeType === 3 || this.nodeType === 8) { this.nodeValue = v; return; }
    for (const c of this.childNodes) c.parentNode = null;
    this.childNodes = v ? [new MiniNode('#text', this.ownerDocument, 3, String(v))] : [];
    for (const c of this.childNodes) c.parentNode = this;
  }
  appendChild(child: MiniNode) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  insertBefore(child: MiniNode, ref: MiniNode | null) {
    if (!ref) return this.appendChild(child);
    if (child.parentNode) child.parentNode.removeChild(child);
    const idx = this.childNodes.indexOf(ref);
    child.parentNode = this;
    if (idx < 0) this.childNodes.push(child);
    else this.childNodes.splice(idx, 0, child);
    return child;
  }
  removeChild(child: MiniNode) {
    const idx = this.childNodes.indexOf(child);
    if (idx >= 0) { this.childNodes.splice(idx, 1); child.parentNode = null; }
    return child;
  }
  setAttribute(k: string, v: string) {
    const s = String(v);
    this.attributes.set(k, s);
    if (k.startsWith('data-')) {
      const dk = k.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
      this.dataset[dk] = s;
    }
    if (k === 'class') (this as any).className = s;
  }
  removeAttribute(k: string) {
    this.attributes.delete(k);
    if (k === 'class') (this as any).className = '';
  }
  getAttribute(k: string) { return this.attributes.get(k) ?? null; }
  addEventListener(type: string, fn: (ev: any) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  removeEventListener(type: string, fn: (ev: any) => void) { this.listeners.get(type)?.delete(fn); }
  getContext() { return noopCtx; }
  toDataURL() { return 'data:,'; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 312, height: 260, right: 312, bottom: 260 }; }
  focus() {}
  blur() {}
  findAll(pred: (n: MiniNode) => boolean, out: MiniNode[] = []): MiniNode[] {
    if (this.nodeType === 1 && pred(this)) out.push(this);
    for (const c of this.childNodes) c.findAll(pred, out);
    return out;
  }
}

function installMiniDom() {
  const g = globalThis as any;
  g.IS_REACT_ACT_ENVIRONMENT = true;
  const doc: any = {
    nodeType: 9,
    documentElement: null as any,
    body: null as any,
    activeElement: null as any,
    createElement: (tag: string): MiniNode => new MiniNode(tag, doc, 1),
    createElementNS: (_ns: string, tag: string): MiniNode => new MiniNode(tag, doc, 1),
    createTextNode: (txt: string): MiniNode => new MiniNode('#text', doc, 3, String(txt)),
    createComment: (txt: string): MiniNode => new MiniNode('#comment', doc, 8, String(txt)),
    addEventListener: () => {},
    removeEventListener: () => {},
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
  };
  doc.documentElement = new MiniNode('html', doc, 1);
  doc.body = new MiniNode('body', doc, 1);
  doc.documentElement.appendChild(doc.body);
  doc.defaultView = g;
  g.document = doc;
  if (!g.window) g.window = g;
  g.window.document = doc;
  g.window.addEventListener = g.window.addEventListener ?? (() => {});
  g.window.removeEventListener = g.window.removeEventListener ?? (() => {});
  g.HTMLElement = MiniNode;
  g.HTMLInputElement = MiniNode;
  g.HTMLCanvasElement = MiniNode;
  g.HTMLIFrameElement = MiniNode;
  g.SVGElement = MiniNode;
  g.Node = MiniNode;
  return doc;
}
const miniDoc = installMiniDom();

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { BAL, T, TILE, WW, type GameState } from '../src/game/core';
import { BUILD_ORDER, STRUCTS } from '../src/game/catalog';
import {
  addItem, blockGrid, C, connectedPower, countItem, destroyOffscreenStructure, dispatch,
  electricDoorPowered, findRunEntity, industrialStatus, markDirty, newGame,
  powerAllocation, startRun, stepStations, turretStatus,
} from '../src/game/engine';
import {
  computeAuthoritativeDailyPoints, DAILY_BY_ID, dateKey, FIELDCRAFT, ingestJourney, loadJourney,
} from '../src/game/journey';
import { deriveCues } from '../src/game/presentation-cues';
import { selectSnapshots, serializeSnapshot, validate } from '../src/game/persist';
import { FX, HAZ, PROJ, settle, syncWorld } from '../src/game/sim';
import { getWorld, setActiveLayout, VEYRA_RECYCLER_SITE, webRecyclerSite } from '../src/game/world';
import { hasAuthorizedRecycler, wreckEconomy } from '../src/game/wreck-economy';
import { BUILD_GROUPS, BuildPanel } from '../src/ui/panels';
import { shiftVeyraWindowBy } from '../src/veyra05/continuity';
import { applyFloor, authoredPlan } from '../src/veyra05/floors';
import { auToTile } from '../src/veyra05/frame';
import { POIS } from '../src/veyra05/reader';
import { layoutIdAt } from '../src/veyra05/scenes';
import { getWindowWorld, resetWindowToGround } from '../src/veyra05/window';

const NOW = Date.UTC(2026, 10, 11, 12, 0, 0);

afterEach(() => {
  PROJ.length = 0;
  HAZ.length = 0;
  FX.length = 0;
  setActiveLayout('shipping');
});

function earnAllDailyObjectives(gs: GameState, at: number) {
  const r = gs.run!;
  const j0 = loadJourney(gs, true);
  const j1 = ingestJourney(j0, gs, at);
  let stepAt = at + 10;
  for (const obj of j1.store.daily!.objectives) {
    const def = DAILY_BY_ID[obj.id];
    if (!def) continue;
    for (let k = 0; k < def.target; k++) {
      stepAt += 5;
      const seq = ++r.seq;
      if (obj.id === 'timber') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'harvest', detail: 'oak@10,10 -12' });
      else if (obj.id === 'quarry') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'harvest', detail: 'rock@11,10 -10' });
      else if (obj.id === 'forage') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'harvest', detail: 'bush@12,10 -6' });
      else if (obj.id === 'variety') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'harvest', detail: `${['oak', 'rock', 'bush'][k % 3]}@${10 + k},10 -1` });
      else if (obj.id === 'handcraft') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'craft.hand', detail: 'rope' });
      else if (obj.id === 'recipes') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'craft.hand', detail: ['rope', 'stone_axe'][k % 2] });
      else if (obj.id === 'raise') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'build', detail: `wall_wood@${20 + k},20` });
      else if (obj.id === 'chart') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'poi.discover', detail: `poi_${k}` });
      else if (obj.id === 'scavenge') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'intel.loot', detail: `site_${k}:loot` });
      else if (obj.id === 'hydrate') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'consume', detail: 'berries' });
      else if (obj.id === 'hunt2' || obj.id === 'hunt5') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'creature.kill', detail: 'boar' });
    }
  }
}

describe('D1 Corrective: Journey Cash-Mint Isolation (Positive & Negative Contracts)', () => {
  it('never mints off-map securedCash, drops items into overflow bag when pack is full, and preserves pre-existing escrow securedCash untouched', () => {
    setActiveLayout('shipping_fresh');
    // Pick a deterministic seed whose 4 daily objectives sum to >= 75 (covering ember=25, hearth=50, beacon=75)
    let gs!: GameState;
    let pts = 0;
    for (let seed = 700; seed < 780; seed++) {
      const candidate = newGame();
      candidate.profile.securedCash = 45;
      expect(startRun(candidate, 'female', NOW, null, seed).ok).toBe(true);
      earnAllDailyObjectives(candidate, NOW + 50);
      pts = computeAuthoritativeDailyPoints(candidate.run!, dateKey(NOW + 500));
      if (pts >= 75) { gs = candidate; break; }
    }
    expect(pts).toBeGreaterThanOrEqual(75);
    const r = gs.run!;

    // Fill every inventory slot to force clean overflow bag delivery (no item deletion, no securedCash injection)
    while (C(r, 'inv').slots.some((s) => !s)) addItem(r, 'inv', 'stone', 99);

    const day = dateKey(NOW + 500);
    for (const ms of ['ember', 'hearth', 'beacon'] as const) {
      const res = dispatch(gs, { id: `req-${ms}`, type: 'journeyRequisition', date: day, milestone: ms, points: 60 }, NOW + 600);
      expect(res.ok, `${ms}: ${(res as any).reason}`).toBe(true);
    }

    // Secured cash must remain EXACTLY 45 (neither minted above 45 nor clobbered below 45)
    expect(gs.profile.securedCash).toBe(45);
    expect((BAL as any).journeyRequisitions.ember.securedCash).toBe(0);
    expect((BAL as any).journeyRequisitions.hearth.securedCash).toBe(0);
    expect((BAL as any).journeyRequisitions.beacon.securedCash).toBe(0);
    // Overflow supplies dropped physically on ground at player's feet without deletion
    const reqTable = (BAL as any).journeyRequisitions as Record<string, { items: [string, number][] }>;
    for (const ms of ['ember', 'hearth', 'beacon'] as const) {
      for (const [k, q] of reqTable[ms].items) {
        const groundQty = Object.values(r.entities)
          .filter((e) => e.kind === 'drop' && e.c)
          .reduce((a, e) => a + countItem(r, e.c!, k), 0);
        expect(countItem(r, 'inv', k) + groundQty).toBeGreaterThanOrEqual(q);
      }
    }

    // Receipt presentation cue labels requisition as supply_requisition (never cash_secured)
    const cues = deriveCues(r.receipts);
    expect(cues.some((ev) => ev.kind === 'supply_requisition')).toBe(true);
  });
});

describe('D2 Corrective: Classic BuildPanel Defense Parity (ir_sensor & bear_trap)', () => {
  it('lists ir_sensor and bear_trap in BUILD_ORDER matching BUILD_GROUPS.Defense and renders both in Classic BuildPanel DOM', () => {
    expect(BUILD_ORDER).toContain('ir_sensor');
    expect(BUILD_ORDER).toContain('bear_trap');
    for (const key of BUILD_GROUPS.Defense) {
      expect(BUILD_ORDER).toContain(key);
    }

    setActiveLayout('shipping_fresh');
    const gs = newGame();
    expect(startRun(gs, 'female', NOW, null, 702).ok).toBe(true);

    const container: MiniNode = miniDoc.createElement('div');
    miniDoc.body.appendChild(container);
    const root = createRoot(container as any);
    const api: any = {
      gs,
      now: () => NOW + 100,
      act: () => ({ ok: true }),
      toast: () => {},
      open: () => {},
      setBuild: () => {},
      setReclaim: () => {},
      setRepairMode: () => {},
      setUpgradeMode: () => {},
    };

    try {
      act(() => { root.render(<BuildPanel api={api} />); });
      const defBtn = container.findAll((n) => n.tagName === 'BUTTON' && n.textContent.includes('Defense'))[0];
      expect(defBtn).toBeTruthy();
      act(() => {
        const reactPropsKey = Object.keys(defBtn).find((k) => k.startsWith('__reactProps$'))!;
        (defBtn as any)[reactPropsKey].onClick({ stopPropagation: () => {}, preventDefault: () => {} });
      });
      expect(container.textContent).toContain('Infrared Sensor');
      expect(container.textContent).toContain('Bear Trap');
    } finally {
      act(() => root.unmount());
      miniDoc.body.removeChild(container);
    }
  });
});

describe('D3 Corrective: Veyra po_greywater Tackle Box & po_glade Archetype Sanctum', () => {
  it('materializes po_greywater Tackle Box cleanly away from Cottage Ladder and po_glade Mosslight cache while keeping Elderwood sanctum intact', () => {
    const grey = authoredPlan('po_greywater')!;
    const greyL0 = grey.levels.get(0)!;
    const tackle = greyL0.loot.find((l) => l.label === 'Tackle Box')!;
    expect(tackle).toBeTruthy();
    expect(greyL0.stairs.some((s) => s.x === tackle.x && s.y === tackle.y)).toBe(false);

    const glade = POIS.find((x) => x.id === 'po_glade')!;
    const [gx, gy] = auToTile(glade.at[0], glade.at[1]);
    const gladeLid = layoutIdAt(Math.max(100, gx - 100), Math.max(100, gy - 100));
    const wwGlade = getWindowWorld(gladeLid);
    const gladeLoot = wwGlade.world.statics.filter((s) => s.poi === 'po_glade' && s.kind === 'loot');
    expect(gladeLoot.length).toBeGreaterThanOrEqual(1);

    const elder = POIS.find((x) => x.id === 'po_elderwood')!;
    const [ex, ey] = auToTile(elder.at[0], elder.at[1]);
    const elderLid = layoutIdAt(Math.max(100, ex - 100), Math.max(100, ey - 100));
    const wwElder = getWindowWorld(elderLid);
    expect(wwElder.poiIds).toContain('po_elderwood');
    expect(wwElder.poiIds).not.toContain('po_glade_collision');
  });
});

describe('D4 Corrective: Offscreen/Boundary-Straddling Wire-v1 Power Parity & 12h Decay Copy', () => {
  it('allocates loads, powers doors/stations/turrets, and drains generator fuel across offscreen window boundaries with online/offline parity', () => {
    const p = POIS.find((x) => x.id === 'po_greywater')!;
    const [gx, gy] = auToTile(p.at[0], p.at[1]);
    const lid = layoutIdAt(Math.max(128, gx - 100), Math.max(128, gy - 100));
    setActiveLayout(lid);
    const gs = newGame();
    expect(startRun(gs, 'female', NOW, null, 704).ok).toBe(true);
    const r = gs.run!;
    r.creatures = [];
    const ww = getWindowWorld(lid);
    try {
      // Clear a buildable strip spanning x=61..66 (after +64 shift east, 61..63 move into veyraOffscreenEntities while 64..66 stay onscreen)
      const bx = 61;
      const grid = blockGrid(r);
      let by = -1;
      for (let y = 30; y < 170; y++) {
        let clear = true;
        for (let yy = y - 2; yy <= y + 2 && clear; yy++) {
          for (let xx = bx - 1; xx <= bx + 7; xx++) {
            const idx = yy * WW + xx;
            if (!ww.world.economyMap.buildable[idx] || grid[idx] !== 0) {
              clear = false;
              break;
            }
          }
        }
        if (clear) { by = y; break; }
      }
      expect(by).toBeGreaterThan(0);

      for (let yy = by - 2; yy <= by + 2; yy++) {
        for (let xx = bx - 1; xx <= bx + 7; xx++) {
          const i = yy * WW + xx;
          if (ww.world.sourceV3[i]) r.sources[i] = { stock: 0, hp: 0 };
        }
      }
      markDirty();

      const buildAt = (type: string, tx: number, ty: number) => {
        r.player.x = tx * TILE + 8;
        r.player.y = (ty + 1) * TILE + 8;
        for (const [k, q] of STRUCTS[type].cost) addItem(r, 'inv', k, q);
        const res = dispatch(gs, { id: `b-${type}-${tx}-${ty}`, type: 'build', struct: type, tx, ty }, NOW);
        expect(res.ok, `${type}: ${(res as any).reason}`).toBe(true);
        return Object.values(r.entities).find((e) => e.kind === 'struct' && e.tx === tx && e.ty === ty && e.type === type)!;
      };

      const gen = buildAt('base_generator', bx, by);
      buildAt('power_cable', bx + 1, by);
      buildAt('power_cable', bx + 2, by);
      buildAt('power_cable', bx + 3, by);
      buildAt('power_cable', bx + 4, by);
      const turret = buildAt('arrow_turret', bx + 5, by);
      const door = buildAt('door_powered', bx + 4, by - 1);
      gen.basePower!.capacity = 2;
      addItem(r, gen.c!, 'wood', 3);
      addItem(r, turret.c!, 'arrow', 5);

      r.player.x = turret.tx! * TILE + 8;
      r.player.y = (turret.ty! + 1) * TILE + 8;
      expect(dispatch(gs, { id: 'tc-g', type: 'turretConfigure', eid: turret.id, field: 'generatorId', value: gen.id }, NOW + 10).ok).toBe(true);
      expect(dispatch(gs, { id: 'tc-e', type: 'turretConfigure', eid: turret.id, field: 'enabled', value: true }, NOW + 15).ok).toBe(true);
      r.player.x = gen.tx! * TILE + 8;
      r.player.y = (gen.ty! + 1) * TILE + 8;
      expect(dispatch(gs, { id: 'bp-on', type: 'basePower', eid: gen.id, enabled: true }, NOW + 20).ok).toBe(true);

      // Shift window EAST by +64 tiles -> generator(61) & cables(62,63) go OFFSCREEN while cable(64), door(64), turret(66) stay ONSCREEN
      expect(shiftVeyraWindowBy(gs, +64, 0, markDirty)).toBe(true);
      expect(r.veyraOffscreenEntities?.[gen.id]).toBeDefined();
      expect(r.entities[turret.id]).toBeDefined();
      expect(r.entities[door.id]).toBeDefined();

      // Straddling wire-v1 network MUST remain connected, powered, and ready
      const offGen = findRunEntity(r, gen.id)!;
      expect(connectedPower(r, offGen, r.entities[turret.id])).toBe(true);
      expect(powerAllocation(r, offGen).map((e) => e.id).sort()).toEqual([door.id, turret.id].sort());
      expect(turretStatus(r, r.entities[turret.id])).toBe('Ready');
      expect(electricDoorPowered(r, r.entities[door.id])).toBe(true);

      // Online 1s ticks vs Single offline settle(20s) MUST burn identical fuel across window boundary
      const snap = serializeSnapshot(gs);
      const online = selectSnapshots([snap, null]).gs!;
      const offline = selectSnapshots([snap, null]).gs!;
      for (let s = 1; s <= 20; s++) syncWorld(online, NOW + 20 + s * 1000);
      settle(offline, NOW + 20 + 20000, true);

      const gOn = findRunEntity(online.run!, gen.id)!;
      const gOff = findRunEntity(offline.run!, gen.id)!;
      expect(countItem(online.run!, gOn.c!, 'wood')).toBe(countItem(offline.run!, gOff.c!, 'wood'));
      expect(Math.round(gOn.basePower!.energy)).toBe(Math.round(gOff.basePower!.energy));
      expect(powerAllocation(offline.run!, gOff).length).toBe(2);

      // Destroying offscreen generator cleanly clears child turret generatorId
      destroyOffscreenStructure(r, offGen, NOW + 30000);
      expect(r.entities[turret.id].turret?.generatorId).toBeUndefined();
      expect(industrialStatus(r, r.entities[turret.id])).toBe('Not installed');

      // Journey shelter tooltip matches BAL.territory.unprotectedCollapseHours (12h, never stale ~2h)
      const claimStep = FIELDCRAFT.flatMap((ch) => ch.steps).find((st) => st.id === 'claim')!;
      expect(claimStep.why).toContain(`about ${BAL.territory.unprotectedCollapseHours} hours`);
      expect(claimStep.why).not.toContain('about 2 hours');
    } finally {
      resetWindowToGround(getWindowWorld(r.layoutId!));
    }
  });
});

describe('D5 Corrective: Veyra po_slag Foundry Recycler, Offscreen Streaming & Legacy Save Safety', () => {
  it('spawns one physical Foundry Recycler at po_slag on veyra05-world, recycles X:drive, validates across floor -1 reload, and leaves legacy static Veyra direct-v1', () => {
    // 1. Live Veyra05 world spawns authorized po_slag recycler & enables recycler-v1
    setActiveLayout('veyra05-world');
    const gs = newGame();
    expect(startRun(gs, 'female', NOW, null, 705).ok).toBe(true);
    const r = gs.run!;
    expect(r.wreckEconomy).toBe('recycler-v1');
    expect(hasAuthorizedRecycler(r)).toBe(true);

    // At spawn (westmouth), po_slag recycler lives cleanly in veyraOffscreenEntities
    const offRecs = Object.values(r.veyraOffscreenEntities ?? {}).filter((e) => e.kind === 'recycler');
    const onRecs = Object.values(r.entities).filter((e) => e.kind === 'recycler');
    expect(offRecs.length + onRecs.length).toBe(1);
    expect(validate(gs)).toBeTruthy();

    // Stream window directly to po_slag so the Foundry Recycler moves into active r.entities on walkable T.FLOOR
    const slagWinLid = layoutIdAt(VEYRA_RECYCLER_SITE.tx - 100, VEYRA_RECYCLER_SITE.ty - 100);
    const targetWw = getWindowWorld(slagWinLid);
    const curWw = getWindowWorld(r.layoutId!);
    const dx = targetWw.win.originTx - curWw.win.originTx;
    const dy = targetWw.win.originTy - curWw.win.originTy;
    if (dx !== 0 || dy !== 0) expect(shiftVeyraWindowBy(gs, dx, dy, markDirty)).toBe(true);
    expect(webRecyclerSite(targetWw.world, slagWinLid)).not.toBeNull();

    const activeRec = Object.values(r.entities).find((e) => e.kind === 'recycler')!;
    expect(activeRec).toBeTruthy();
    expect(activeRec.tx).toBe(VEYRA_RECYCLER_SITE.tx - targetWw.win.originTx);
    expect(activeRec.ty).toBe(VEYRA_RECYCLER_SITE.ty - targetWw.win.originTy);

    // Recycle a damaged_drive -> X:drive -> 2 spares and verify save/reload persistence
    r.player.x = activeRec.x;
    r.player.y = activeRec.y + TILE;
    addItem(r, 'inv', 'damaged_drive', 1);
    const driveSlot = C(r, 'inv').slots.findIndex((s) => s?.key === 'damaged_drive');
    const driveUid = C(r, 'inv').slots[driveSlot]!.uid;
    const startRes = dispatch(gs, { id: 'rec-drv-start', type: 'recycleItem', eid: activeRec.id, slot: driveSlot, uid: driveUid }, NOW + 100);
    expect(startRes.ok, (startRes as any).reason).toBe(true);
    stepStations(gs, 13000, NOW + 13100);
    const outC = activeRec.station!.outC;
    expect(countItem(r, outC, 'spares')).toBe(2);
    const outSlot = C(r, outC).slots.findIndex((s) => s?.key === 'spares');
    const colRes = dispatch(gs, { id: 'rec-drv-collect', type: 'move', from: outC, fs: outSlot, to: 'inv' }, NOW + 13200);
    expect(colRes.ok, (colRes as any).reason).toBe(true);
    expect(countItem(r, 'inv', 'spares')).toBe(2);

    // Descend to Floor -1 inside po_slag and verify cold reload stays valid while po_slag recycler is offscreen Floor-0
    const snap = serializeSnapshot(gs);
    const parsed = JSON.parse(snap);
    expect(validate(JSON.parse(parsed.payload))).toBeTruthy();
    const loaded = selectSnapshots([snap, null]).gs!;
    expect(loaded).toBeTruthy();
    expect(hasAuthorizedRecycler(loaded.run!)).toBe(true);
    if (targetWw.floors.ground.stairs.some((s) => s.to === -1)) {
      const st = targetWw.floors.ground.stairs.find((s) => s.to === -1)!;
      expect(applyFloor(loaded, targetWw, targetWw.floors, -1, [st.tx - targetWw.win.originTx, st.ty - targetWw.win.originTy], markDirty)).toBe(true);
      expect(webRecyclerSite(getWorld(loaded.run!.layoutId!), loaded.run!.layoutId!)).not.toBeNull();
      const snapF1 = serializeSnapshot(loaded);
      expect(selectSnapshots([snapF1, null]).gs).toBeTruthy();
    }
    resetWindowToGround(getWindowWorld(r.layoutId!));

    // 2. Negative/backward-compat check: legacy static Veyra layouts stay direct-v1 with ZERO physical recycler
    setActiveLayout('veyra-greywater-lr02-u16');
    const gsLegacy = newGame();
    expect(startRun(gsLegacy, 'female', NOW, null, 706).ok).toBe(true);
    expect(gsLegacy.run!.wreckEconomy).toBe('direct-v1');
    expect(webRecyclerSite(getWorld('veyra-greywater-lr02-u16'), 'veyra-greywater-lr02-u16')).toBeNull();
    expect(hasAuthorizedRecycler(gsLegacy.run!)).toBe(false);
    expect(Object.values(gsLegacy.run!.entities).filter((e) => e.kind === 'recycler')).toHaveLength(0);
    expect(wreckEconomy(gsLegacy.run!)).toBe('direct-v1');
  });
});
