// Control Tower Phase A + Phase B — Failing-First Reproduction & Regression Suite
// Covers:
//   A1: journeyRequisition authoritative progress, UTC date, replay, duplicate & QA-taint validation
//   A2: ExpeditionMap stateful re-render & Fit button when r.discovered / r.poiSeen mutate in place
//   B1: Veyra multi-floor death & respawn (with & without Ground-Floor bed) without softlock
//   B2: Veyra stair transition with mounted motorbike / pulled cart / intervening wall
//   B3: Veyra multi-floor isolation for Creator Core AoEs, hazards, explosions & spiritDestination
//   B4: Projectile substep contact-point detonation (nature_rock / fireball) + Gold rockhit VFX event
//   B5: Wall-bypass prevention for placeCart and husbandry (engine + contextual T helper)
//   B6: Veyra offscreen continuity for stations, gardens, territory upkeep, deathBagView & floor sources

// Minimal stateful DOM for React 19 createRoot + act in Node (zero external dependencies)
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
  getBoundingClientRect() { return { left: 0, top: 0, width: this.width || 312, height: this.height || 260, right: 312, bottom: 260 }; }
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
import { BAL, HOUR, TILE, WW, type GameState } from '../src/game/core';
import {
  addItem, blockGrid, countItem, dispatch, killPlayer, markDirty, mkCreature,
  newGame, planTerritory, respawn, startRun, stepStations, stepTerritory,
} from '../src/game/engine';
import { FX, HAZ, PROJ, spiritDestination, tick } from '../src/game/sim';
import { getWorld, setActiveLayout } from '../src/game/world';
import { selectSnapshots, serializeSnapshot, validate } from '../src/game/persist';
import { deathBagView } from '../src/game/death-view';
import { DAILY_BY_ID, dateKey, ingestJourney, loadJourney } from '../src/game/journey';
import { ExpeditionMap } from '../src/ui/ExpeditionMap';
import { SurvivorScreen } from '../src/ui/SurvivorScreen';
import { ContainerPanel } from '../src/ui/panels';
import { layoutIdAt } from '../src/veyra05/scenes';
import { getWindowWorld, resetWindowToGround } from '../src/veyra05/window';
import { activeFloor, applyFloor } from '../src/veyra05/floors';
import { shiftVeyraWindowBy } from '../src/veyra05/continuity';
import { POIS } from '../src/veyra05/reader';
import { auToTile } from '../src/veyra05/frame';

const NOW = Date.UTC(2026, 10, 9, 12, 0, 0); // 2026-11-09T12:00:00Z
const IDLE_INP = { up: false, down: false, left: false, right: false, mx: 0, my: 0, attack: false, attackPressed: false, roll: false, cancel: false };

afterEach(() => {
  PROJ.length = 0;
  HAZ.length = 0;
  FX.length = 0;
  setActiveLayout('shipping');
});

/** Helper: earn genuine authoritative receipts for one of today's generated Daily Waypoints. */
function satisfyDailyObjectives(gs: GameState, targetPoints: number, at: number) {
  const r = gs.run!;
  const j0 = loadJourney(gs, true);
  const j1 = ingestJourney(j0, gs, at);
  const daily = j1.store.daily!;
  let earned = 0;
  let stepAt = at + 10;
  for (const obj of daily.objectives) {
    if (earned >= targetPoints) break;
    const def = DAILY_BY_ID[obj.id];
    if (!def) continue;
    for (let k = 0; k < def.target; k++) {
      stepAt += 5;
      const seq = ++r.seq;
      if (obj.id === 'timber') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'harvest', detail: 'oak@10,10 -12' });
      else if (obj.id === 'quarry') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'harvest', detail: 'rock@11,10 -10' });
      else if (obj.id === 'forage') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'harvest', detail: 'bush@12,10 -6' });
      else if (obj.id === 'variety') {
        const srcs = ['oak', 'rock', 'bush'];
        r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'harvest', detail: `${srcs[k % 3]}@${10 + k},10 -1` });
      } else if (obj.id === 'handcraft') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'craft.hand', detail: 'rope' });
      else if (obj.id === 'recipes') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'craft.hand', detail: k % 2 === 0 ? 'rope' : 'torch' });
      else if (obj.id === 'mend') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'item.repair', detail: 's1:100->300' });
      else if (obj.id === 'raise') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'build', detail: `wall_wood@${20 + k},20` });
      else if (obj.id === 'fortify') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'structure.repair', detail: 'e1:50->100' });
      else if (obj.id === 'chart') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'poi.discover', detail: `poi_${k}` });
      else if (obj.id === 'scavenge') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'intel.loot', detail: `e${k}:place_${k}` });
      else if (obj.id === 'hydrate') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'drink', detail: '15,15' });
      else if (obj.id === 'rest') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'rest.end', detail: 'e1' });
      else if (obj.id === 'hunt2' || obj.id === 'hunt5') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'creature.kill', detail: `wolf:m${k}` });
      else if (obj.id === 'smelt') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'job.done', detail: 'e1:iron_ingot' });
      else if (obj.id === 'knowledge') r.receipts.push({ id: `r${seq}`, seq, at: stepAt, kind: 'learn.blueprint', detail: 'iron_sword' });
    }
    earned += def.points;
  }
  return { earned, lastAt: stepAt };
}

describe('Phase A1 — journeyRequisition authoritative verification & negative security tests', () => {
  it('rejects forged client points when authoritative run receipts have zero waypoint progress', () => {
    setActiveLayout('shipping_fresh');
    const gs = newGame();
    expect(dispatch(gs, { id: 'a1-start', type: 'startRun', character: 'female', seed: 101 }, NOW).ok).toBe(true);
    const r = gs.run!;

    const forged = dispatch(
      gs,
      { id: 'a1-forged-pts', type: 'journeyRequisition', date: '2026-11-09', milestone: 'beacon', points: 999 },
      NOW + 100,
    );
    expect(forged.ok).toBe(false);
    expect(gs.profile.securedCash).toBe(0);
    expect(countItem(r, 'inv', 'crystal')).toBe(0);
  });

  it('rejects impossible calendar dates, past/future date farming, and QA-tainted runs', () => {
    setActiveLayout('shipping_fresh');
    const gs = newGame();
    expect(dispatch(gs, { id: 'a1-date-start', type: 'startRun', character: 'female', seed: 102 }, NOW).ok).toBe(true);
    satisfyDailyObjectives(gs, 60, NOW + 50);

    // Impossible calendar dates matching \d{4}-\d{2}-\d{2}
    expect(dispatch(gs, { id: 'bad-d1', type: 'journeyRequisition', date: '2026-99-99', milestone: 'ember', points: 60 }, NOW + 500).ok).toBe(false);
    expect(dispatch(gs, { id: 'bad-d2', type: 'journeyRequisition', date: '2026-02-30', milestone: 'ember', points: 60 }, NOW + 510).ok).toBe(false);

    // Arbitrary past or future dates (prevents infinite date-string farming)
    expect(dispatch(gs, { id: 'bad-past', type: 'journeyRequisition', date: '2026-11-08', milestone: 'ember', points: 60 }, NOW + 520).ok).toBe(false);
    expect(dispatch(gs, { id: 'bad-fut', type: 'journeyRequisition', date: '2026-11-10', milestone: 'ember', points: 60 }, NOW + 530).ok).toBe(false);
    expect(gs.profile.securedCash).toBe(0);

    // Legitimate claim on current UTC day succeeds even if client omits/underreports points
    const valid = dispatch(gs, { id: 'ok-ember', type: 'journeyRequisition', date: dateKey(NOW + 600), milestone: 'ember', points: 0 }, NOW + 600);
    expect(valid.ok).toBe(true);
    expect(gs.profile.securedCash).toBe(BAL.journeyRequisitions.ember.securedCash);

    // Once QA time-advance taints the run, remaining milestones cannot mint profile cash
    expect(dispatch(gs, { id: 'qa-adv', type: 'qaAdvance', hours: 0.1 }, NOW + 700).ok).toBe(true);
    expect(dispatch(gs, { id: 'qa-hearth', type: 'journeyRequisition', date: dateKey(NOW + 800), milestone: 'hearth', points: 60 }, NOW + 800).ok).toBe(false);
  });

  it('blocks duplicate claims with different intent IDs, across save/reload, and across a new run on the same UTC day', () => {
    setActiveLayout('shipping_fresh');
    const gs = newGame();
    expect(dispatch(gs, { id: 'a1-rep-start', type: 'startRun', character: 'female', seed: 103 }, NOW).ok).toBe(true);
    satisfyDailyObjectives(gs, 40, NOW + 50);

    const day = dateKey(NOW + 500);
    expect(dispatch(gs, { id: 'claim-1', type: 'journeyRequisition', date: day, milestone: 'ember', points: 40 }, NOW + 500).ok).toBe(true);
    const cashAfterFirst = gs.profile.securedCash;
    expect(cashAfterFirst).toBe(BAL.journeyRequisitions.ember.securedCash);

    // Different intent ID on the same run
    const dupDiffId = dispatch(gs, { id: 'claim-2-diff-id', type: 'journeyRequisition', date: day, milestone: 'ember', points: 40 }, NOW + 520);
    expect(dupDiffId.ok).toBe(false);
    expect(gs.profile.securedCash).toBe(cashAfterFirst);

    // Across serializeSnapshot -> selectSnapshots reload
    const snap = serializeSnapshot(gs);
    const reloaded = selectSnapshots([snap, null]).gs!;
    expect(reloaded).toBeTruthy();
    expect(dispatch(reloaded, { id: 'claim-after-reload', type: 'journeyRequisition', date: day, milestone: 'ember', points: 40 }, NOW + 600).ok).toBe(false);
    expect(reloaded.profile.securedCash).toBe(cashAfterFirst);

    // Across abandon + brand-new run on the same UTC day (even after earning points again)
    expect(dispatch(reloaded, { id: 'ab-1', type: 'abandon' }, NOW + 700).ok).toBe(true);
    expect(dispatch(reloaded, { id: 'start-2', type: 'startRun', character: 'male', seed: 204 }, NOW + 800).ok).toBe(true);
    satisfyDailyObjectives(reloaded, 40, NOW + 850);
    expect(dispatch(reloaded, { id: 'claim-run-2', type: 'journeyRequisition', date: day, milestone: 'ember', points: 40 }, NOW + 1200).ok).toBe(false);
    expect(reloaded.profile.securedCash).toBe(cashAfterFirst);
  });
});

describe('Phase A2 — ExpeditionMap live discovery bounds & Fit button on in-place r.discovered mutation', () => {
  it('updates charted % and Fit zoom level when r.discovered mutates in place while ExpeditionMap stays mounted', () => {
    setActiveLayout('shipping_fresh');
    const gs = newGame();
    expect(dispatch(gs, { id: 'a2-start', type: 'startRun', character: 'female', seed: 55 }, NOW).ok).toBe(true);
    const r = gs.run!;
    // Initial discovery around spawn (~4% charted -> span <= 48 -> Fit picks 4x)
    tick(gs, IDLE_INP, 50, NOW + 50);

    const container: MiniNode = miniDoc.createElement('div');
    miniDoc.body.appendChild(container);
    const root = createRoot(container as any);
    const api: any = {
      gs,
      now: () => NOW + 1000,
      act: () => ({ ok: true }),
      toast: () => {},
      open: () => {},
      panel: { kind: 'map' },
      sel: null,
      setSel: () => {},
      setBuild: () => {},
      buildType: null,
      reclaim: false,
      setReclaim: () => {},
      repairMode: false,
      setRepairMode: () => {},
      setUpgradeMode: () => {},
      sfx: () => {},
      rerender: () => {},
    };

    try {
      act(() => {
        root.render(<ExpeditionMap api={api} qaSession />);
      });
      expect(container.textContent).toContain('0% charted');

      // Mutate r.discovered IN PLACE (same array reference, exactly as sim.ts discover() does) across >60% of the map
      const sameArrayRef = r.discovered;
      for (let y = 2; y < 46; y++) {
        for (let x = 2; x < 46; x++) {
          r.discovered[y * 50 + x] = 1;
        }
      }
      expect(r.discovered).toBe(sameArrayRef);

      // Re-render mounted ExpeditionMap (simulating Game.tsx HUD tick while map is open)
      act(() => {
        root.render(<ExpeditionMap api={api} qaSession />);
      });
      // Charted percentage MUST reflect newly explored cells, not stay frozen at 0%
      expect(container.textContent).not.toContain('0% charted');
      expect(container.textContent).toContain('77% charted');

      // Clicking "Fit" must zoom out to 1× to frame the newly discovered 176-tile span (not stay at stale 4×)
      const fitBtn = container.findAll(n => n.tagName === 'BUTTON' && n.textContent === 'Fit')[0];
      expect(fitBtn).toBeTruthy();
      act(() => {
        const reactPropsKey = Object.keys(fitBtn).find(k => k.startsWith('__reactProps$'));
        (fitBtn as any)[reactPropsKey!].onClick({ stopPropagation: () => {}, preventDefault: () => {} });
      });
      const zoom1Btn = container.findAll(n => n.tagName === 'BUTTON' && n.textContent === '1×')[0];
      expect(zoom1Btn.getAttribute('class')).toContain('gold');
    } finally {
      act(() => root.unmount());
      miniDoc.body.removeChild(container);
    }
  });
});

describe('Phase B — Independent Gameplay & Gold-Seam Defect Regressions', () => {
  it('B1: dying on Veyra Floor -1 respawns cleanly at Ground-Floor bed or legal Ground spawn without softlocking the run', () => {
    const p = POIS.find(x => x.id === 'po_greywater')!;
    const [gx, gy] = auToTile(p.at[0], p.at[1]);
    const lid = layoutIdAt(gx - 100, gy - 100);
    setActiveLayout(lid);
    const gs = newGame();
    expect(startRun(gs, 'female', NOW, null, 20261109).ok).toBe(true);
    const r = gs.run!;
    r.creatures = [];
    const ww = getWindowWorld(lid);

    // Descend stairs to Floor -1 with no bed owned, carry a unique item, and die
    const stair = ww.floors.ground.stairs.find(s => s.to === -1)!;
    const [lx, ly] = [stair.tx - ww.win.originTx, stair.ty - ww.win.originTy];
    expect(applyFloor(gs, ww, ww.floors, -1, [lx, ly], markDirty)).toBe(true);
    expect(activeFloor(r)).toBe(-1);

    killPlayer(gs, NOW + 100, 'basement ambush');
    expect(r.player.dead).toBe(true);
    const bagView = deathBagView(r);
    expect(bagView.status).toBe('present');
    expect((bagView.bag as any).floor).toBe(-1);

    // Respawn MUST succeed onto Ground Floor 0 (not fail with 'No safe spawn is currently available.')
    const res = respawn(gs, NOW + 200);
    expect(res.ok).toBe(true);
    expect(r.player.dead).toBe(false);
    expect(activeFloor(r)).toBe(0);
    expect(validate(structuredClone(gs))).not.toBeNull();
    resetWindowToGround(ww);
  });

  it('B2: Veyra applyFloor rejects mounted motorbike (preserving save validity) and detaches pulled cart', () => {
    const p = POIS.find(x => x.id === 'po_greywater')!;
    const [gx, gy] = auToTile(p.at[0], p.at[1]);
    const lid = layoutIdAt(gx - 100, gy - 100);
    setActiveLayout(lid);
    const gs = newGame();
    expect(startRun(gs, 'female', NOW, null, 20261109).ok).toBe(true);
    const r = gs.run!;
    const ww = getWindowWorld(lid);
    const stair = ww.floors.ground.stairs.find(s => s.to === -1)!;
    const [lx, ly] = [stair.tx - ww.win.originTx, stair.ty - ww.win.originTy];

    // Mount a fake deployed vehicle at player position and try applyFloor
    const bikeId = 'e_bike_test';
    const bikeC = 'c_bike_test';
    r.custody[bikeC] = { id: bikeC, kind: 'vehicle', slots: Array(BAL.motorbike.slots).fill(null) };
    r.entities[bikeId] = {
      id: bikeId, kind: 'vehicle', x: r.player.x, y: r.player.y, c: bikeC,
      hp: BAL.motorbike.maxHp, maxHp: BAL.motorbike.maxHp,
      deployed: { uid: 's_bike_test', key: 'motorbike_kit', qty: 1, dur: BAL.motorbike.maxHp },
      vehicle: { fuel: 20, angle: 0, odometer: 0, geometry: 'vehicle-geometry-v1' },
    };
    r.player.vehicle = bikeId;

    // Must refuse stair transition while mounted so r.player.x === bike.x invariant is never violated
    expect(applyFloor(gs, ww, ww.floors, -1, [lx, ly], markDirty)).toBe(false);
    expect(activeFloor(r)).toBe(0);

    // Dismount and pull a cart instead -> applyFloor detaches r.player.pulling cleanly
    delete r.player.vehicle;
    delete r.entities[bikeId];
    delete r.custody[bikeC];
    r.player.pulling = 'cart_ground';
    expect(applyFloor(gs, ww, ww.floors, -1, [lx, ly], markDirty)).toBe(true);
    expect(r.player.pulling).toBeNull();
    resetWindowToGround(ww);
  });

  it('B3: Creator Core AoEs, explosions, hazards & spiritDestination on Floor 0 do not bleed into Floor -1 creatures', () => {
    setActiveLayout('shipping_fresh');
    const gs = newGame();
    expect(dispatch(gs, { id: 'b3-start', type: 'startRun', character: 'female', seed: 88 }, NOW).ok).toBe(true);
    const r = gs.run!;
    r.creatures = [];
    r.discovered = Array(2500).fill(1);
    const grid = blockGrid(r), w = getWorld();
    let tx = 40, ty = 40;
    outer: for (let y = 25; y < 170; y++) {
      for (let x = 25; x < 170; x++) {
        if ([0, 1, 2, 3].every(dx => grid[y * WW + x + dx] === 0 && !w.economyMap.protected[y * WW + x + dx])) {
          tx = x; ty = y; break outer;
        }
      }
    }
    r.player.x = tx * TILE + 8;
    r.player.y = ty * TILE + 8;

    // Place a creature at (tx+2, ty) on Floor -1 while player is on Floor 0
    const basementWolf = mkCreature(r, 'wolf', (tx + 2) * TILE + 8, ty * TILE + 8, 50);
    (basementWolf as any).floor = -1;
    r.creatures.push(basementWolf);

    // 1) Basement creature must NOT block spiritDestination on Floor 0
    expect(spiritDestination(r, (tx + 2) * TILE + 8, ty * TILE + 8)).toBeNull();

    // 2) Fireball explosion on Floor 0 at (tx+2, ty) must NOT damage Floor -1 creature
    PROJ.push({ x: (tx + 2) * TILE + 8, y: ty * TILE + 8, vx: 0, vy: 0, life: 0.01, dmg: 30, from: 'player', kind: 'fireball', r: 5 });
    // 3) Lightning strike hazard on Floor 0 at (tx+2, ty) must NOT damage Floor -1 creature
    HAZ.push({ kind: 'circle', x: (tx + 2) * TILE + 8, y: ty * TILE + 8, r: 28, t: 0, tell: 0, dur: 100, dmg: 30, style: 'lightning', effect: 'mjolnirStrike', owner: 'player' });
    tick(gs, IDLE_INP, 50, NOW + 50);
    expect(basementWolf.hp).toBe(50);
  });

  it('B4: nature_rock detonates AoE at substep contact point (not stale pre-step) and emits Gold rockhit FX', () => {
    setActiveLayout('shipping_fresh');
    const gs = newGame();
    expect(dispatch(gs, { id: 'b4-start', type: 'startRun', character: 'female', seed: 89 }, NOW).ok).toBe(true);
    const r = gs.run!;
    r.creatures = [];
    const grid = blockGrid(r), w = getWorld();
    let tx = 40, ty = 40;
    outer: for (let y = 25; y < 170; y++) {
      for (let x = 25; x < 170; x++) {
        if ([0, 1, 2, 3, 4].every(dx => grid[y * WW + x + dx] === 0 && w.economyMap.buildable[y * WW + x + dx])) { tx = x; ty = y; break outer; }
      }
    }
    const baseX = tx * TILE + 8, baseY = ty * TILE + 8;
    r.player.x = (tx - 1) * TILE + 8;
    r.player.y = baseY;
    tick(gs, IDLE_INP, 0, NOW);
    // Wolf A at baseX + 12 (hit on substep: contact x = baseX + 3.6 -> dist = 8.4 < 10)
    // Wolf B at baseX + 25.5: dist from contact (baseX + 3.6) is 21.9 < rockRadius (24),
    // whereas dist from stale pre-step baseX was 25.5 >= 24!
    const wolfA = mkCreature(r, 'wolf', baseX + 12, baseY, 50);
    const wolfB = mkCreature(r, 'wolf', baseX + 25.5, baseY, 50);
    wolfA.frozenUntil = NOW + 5000;
    wolfB.frozenUntil = NOW + 5000;
    r.creatures.push(wolfA, wolfB);

    FX.length = 0;
    PROJ.push({ x: baseX, y: baseY, vx: 180, vy: 0, life: 0.8, dmg: 20, from: 'player', kind: 'nature_rock', r: 4 });
    tick(gs, IDLE_INP, 50, NOW + 50);
    const events = FX.map(e => e.type);

    expect(wolfA.hp).toBeLessThan(50);
    expect(wolfB.hp).toBeLessThan(50);
    expect(events).toContain('rockhit');
  });

  it('B5: blocks placeCart and husbandry actions through solid walls', () => {
    setActiveLayout('shipping_fresh');
    const gs = newGame();
    expect(dispatch(gs, { id: 'b5-start', type: 'startRun', character: 'female', seed: 91 }, NOW).ok).toBe(true);
    const r = gs.run!;
    r.creatures = [];
    const grid = blockGrid(r), w = getWorld();
    let tx = 40, ty = 40;
    outer: for (let y = 25; y < 170; y++) {
      for (let x = 25; x < 170; x++) {
        if ([0, 1, 2, 3].every(dx => grid[y * WW + x + dx] === 0 && w.economyMap.buildable[y * WW + x + dx])) {
          tx = x; ty = y; break outer;
        }
      }
    }
    r.player.x = tx * TILE + 8;
    r.player.y = ty * TILE + 8;
    addItem(r, 'inv', 'wood', 40);
    addItem(r, 'inv', 'cart_kit', 1);
    addItem(r, 'inv', 'berries', 5);

    // Build a solid wood wall at (tx + 1, ty)
    expect(dispatch(gs, { id: 'b5-wall', type: 'build', struct: 'wall_wood', tx: tx + 1, ty }, NOW + 10).ok).toBe(true);

    // Attempting to deploy cart_kit at (tx + 2, ty) across the solid wall must fail
    const cartBehindWall = dispatch(gs, { id: 'b5-cart', type: 'placeCart', x: (tx + 2) * TILE + 8, y: ty * TILE + 8 }, NOW + 20);
    expect(cartBehindWall.ok).toBe(false);
    expect(countItem(r, 'inv', 'cart_kit')).toBe(1);

    // Attempting to tame or butcher an animal standing behind the solid wall at (tx + 2, ty) must fail
    const berriesBefore = countItem(r, 'inv', 'berries');
    const hare = mkCreature(r, 'hare', (tx + 2) * TILE + 8, ty * TILE + 8, 20);
    r.creatures.push(hare);
    expect(dispatch(gs, { id: 'b5-tame', type: 'husbandry', cid: hare.id, op: 'tame' }, NOW + 30).ok).toBe(false);
    expect(countItem(r, 'inv', 'berries')).toBe(berriesBefore);
  });

  it('B6: Veyra offscreen stations smelt, offscreen cabinets fund edge walls, and offscreen deathBagView stays present', () => {
    const p = POIS.find(x => x.id === 'po_greywater')!;
    const [gx, gy] = auToTile(p.at[0], p.at[1]);
    const lid = layoutIdAt(Math.max(128, gx - 100), Math.max(128, gy - 100));
    setActiveLayout(lid);
    const gs = newGame();
    expect(startRun(gs, 'female', NOW, null, 20261109).ok).toBe(true);
    const r = gs.run!;
    r.creatures = [];

    // Place a funded Territory Cabinet + Foundation at tx = 140 (slides offscreen when shifting -64 -> 140+64 = 204 >= 199)
    // and a Wood Wall at tx = 132 (stays onscreen at 132+64 = 196 < 199, only 8 tiles from cabinet <= 20 radius!)
    const floorId = 'e_fl1', cabId = 'e_cab1', wallId = 'e_wall1', furnId = 'e_furn1', unprotId = 'e_unprot1';
    const cabC = 'c_cab1', fuelC = 'c_fuel1', outC = 'c_out1';
    r.custody[cabC] = {
      id: cabC,
      kind: 'chest',
      slots: [{ uid: 's_upk', key: 'wood', qty: 50 }, { uid: 's_upk_st', key: 'stone', qty: 50 }, ...Array(22).fill(null)],
    };
    r.custody[fuelC] = { id: fuelC, kind: 'fuel', slots: [{ uid: 's_coal', key: 'coal', qty: 5 }, null, null] };
    r.custody[outC] = { id: outC, kind: 'out', slots: Array(6).fill(null) };
    r.entities[floorId] = { id: floorId, kind: 'struct', type: 'floor_wood', tx: 140, ty: 100, x: 140 * TILE + 8, y: 100 * TILE + 8, hp: 200, maxHp: 200 };
    r.entities[cabId] = { id: cabId, kind: 'struct', type: 'claim', tx: 140, ty: 100, x: 140 * TILE + 8, y: 100 * TILE + 8, hp: 300, maxHp: 300, c: cabC, cabinet: { credit: {}, legacy: false } };
    r.entities[wallId] = { id: wallId, kind: 'struct', type: 'wall_wood', tx: 132, ty: 100, x: 132 * TILE + 8, y: 100 * TILE + 8, hp: 250, maxHp: 250 };
    // Unprotected wall far outside cabinet radius (tx = 180) that also slides offscreen (no free decay immunity!)
    r.entities[unprotId] = { id: unprotId, kind: 'struct', type: 'wall_wood', tx: 180, ty: 100, x: 180 * TILE + 8, y: 100 * TILE + 8, hp: 250, maxHp: 250 };
    r.entities[furnId] = {
      id: furnId, kind: 'struct', type: 'furnace', tx: 142, ty: 100, x: 142 * TILE + 8, y: 100 * TILE + 8, hp: 250, maxHp: 250,
      station: {
        fuelC, outC, burn: 0,
        queue: [{ id: 'j_ingot1', recipe: 'iron_ingot', left: 5000, total: 5000, reserved: [{ uid: 's_ore1', key: 'iron_ore', qty: 2 }] }],
      },
    };
    // Also create a death bag at tx = 144 so it moves into veyraOffscreenEntities on shift -64
    const bagC = 'c_dbag1';
    r.custody[bagC] = { id: bagC, kind: 'bag', slots: [{ uid: 's_knife_lost', key: 'knife', qty: 1, dur: 250 }] };
    r.entities['b_lost1'] = { id: 'b_lost1', kind: 'bag', x: 144 * TILE + 8, y: 100 * TILE + 8, c: bagC, label: 'Your bag', born: NOW };
    r.receipts.push({ id: `r${++r.seq}`, seq: r.seq, at: NOW, kind: 'death', detail: 'wolf; bag=b_lost1' });
    markDirty();

    // Shift window west by -64 tiles so cabinet, furnace & death bag move into veyraOffscreenEntities while wall stays in r.entities
    expect(shiftVeyraWindowBy(gs, -64, 0, markDirty)).toBe(true);
    expect(r.veyraOffscreenEntities?.[cabId]).toBeDefined();
    expect(r.veyraOffscreenEntities?.[furnId]).toBeDefined();
    expect(r.veyraOffscreenEntities?.['b_lost1']).toBeDefined();
    expect(r.entities[wallId]).toBeDefined();

    // 1) Offscreen death bag must STILL be reported as 'present' (not 'missing')
    expect(deathBagView(r).status).toBe('present');

    // 2) Offscreen furnace must finish smelting iron_ingot when stepStations advances 10s
    stepStations(gs, 10000, NOW + 10000);
    expect(countItem(r, outC, 'iron_ingot')).toBe(1);

    // 3) Onscreen wall (8 global tiles from offscreen funded cabinet) must remain funded & undamaged after 1h upkeep,
    //    while unprotected offscreen wall decays honestly (no free offscreen decay immunity)
    const plan = planTerritory(r);
    expect(plan.assigned.get(wallId)?.id).toBe(cabId);
    expect(plan.assigned.get(unprotId)).toBeNull();
    stepTerritory(r, HOUR, NOW + HOUR);
    expect(r.entities[wallId].hp).toBe(250);
    expect(r.veyraOffscreenEntities![unprotId].hp).toBeLessThan(250);
  });

  it('B6b: harvested non-ground Veyra floor sources do not refill across window shifts (K3)', () => {
    const p = POIS.find(x => x.id === 'po_greywater')!;
    const [gx, gy] = auToTile(p.at[0], p.at[1]);
    const lid = layoutIdAt(Math.max(128, gx - 100), Math.max(128, gy - 100));
    setActiveLayout(lid);
    const gs = newGame();
    expect(startRun(gs, 'female', NOW, null, 20261109).ok).toBe(true);
    const r = gs.run!;
    const ww = getWindowWorld(lid);
    const stair = ww.floors.ground.stairs.find(s => s.to === -1)!;
    const [lx, ly] = [stair.tx - ww.win.originTx, stair.ty - ww.win.originTy];

    expect(applyFloor(gs, ww, ww.floors, -1, [lx, ly], markDirty)).toBe(true);
    // Find an authored resource node on Floor -1 (or seed one into layer + world sourceV3) and deplete it
    const bLayer = ww.floors.layers.get(-1)!;
    let srcIdx = bLayer.sources.findIndex(v => !!v);
    if (srcIdx < 0) {
      srcIdx = ly * WW + lx;
      bLayer.sources[srcIdx] = 'rock';
      ww.world.sourceV3[srcIdx] = 'rock';
    }
    r.sources[srcIdx] = { stock: 0, hp: 0 };
    expect(applyFloor(gs, ww, ww.floors, 0, [lx, ly], markDirty)).toBe(true);

    // Shift window west by -64 and back east by +64, then descend to Floor -1 again
    expect(shiftVeyraWindowBy(gs, -64, 0, markDirty)).toBe(true);
    expect(shiftVeyraWindowBy(gs, +64, 0, markDirty)).toBe(true);
    const wwAfter = getWindowWorld(r.layoutId!);
    if (!wwAfter.floors.layers.get(-1)!.sources[srcIdx]) {
      wwAfter.floors.layers.get(-1)!.sources[srcIdx] = 'rock';
    }
    expect(applyFloor(gs, wwAfter, wwAfter.floors, -1, [lx, ly], markDirty)).toBe(true);
    expect(r.sources[srcIdx]?.stock).toBe(0);
    resetWindowToGround(wwAfter);
  });

  it('B7: Gold SurvivorScreen and ContainerPanel InvSide resolve every category & equipment ghost icon without empty src=""', () => {
    setActiveLayout('shipping_fresh');
    const gs = newGame();
    expect(dispatch(gs, { id: 'b7-start', type: 'startRun', character: 'female', seed: 99 }, NOW).ok).toBe(true);
    const r = gs.run!;
    const grid = blockGrid(r), w = getWorld();
    let tx = 40, ty = 40;
    outer: for (let y = 25; y < 170; y++) {
      for (let x = 25; x < 170; x++) {
        if (grid[y * WW + x] === 0 && grid[y * WW + x + 1] === 0 && w.economyMap.buildable[y * WW + x + 1]) { tx = x; ty = y; break outer; }
      }
    }
    r.player.x = tx * TILE + 8;
    r.player.y = ty * TILE + 8;
    addItem(r, 'inv', 'wood', 30);
    expect(dispatch(gs, { id: 'b7-chest', type: 'build', struct: 'chest_small', tx: tx + 1, ty }, NOW + 10).ok).toBe(true);
    const chest = Object.values(r.entities).find(e => e.type === 'chest_small')!;

    const container: MiniNode = miniDoc.createElement('div');
    miniDoc.body.appendChild(container);
    const root = createRoot(container as any);
    const api: any = {
      gs, now: () => NOW + 100, act: () => ({ ok: true }), toast: () => {}, open: () => {},
      panel: { kind: 'inv' }, sel: null, setSel: () => {}, setBuild: () => {}, buildType: null,
      reclaim: false, setReclaim: () => {}, repairMode: false, setRepairMode: () => {}, setUpgradeMode: () => {},
      sfx: () => {}, rerender: () => {},
    };
    (globalThis as any).requestAnimationFrame = () => 1;
    (globalThis as any).cancelAnimationFrame = () => {};
    try {
      act(() => {
        root.render(
          <div>
            <SurvivorScreen api={api} />
            <ContainerPanel api={{ ...api, panel: { kind: 'container', eid: chest.id } }} eid={chest.id} />
          </div>,
        );
      });
      const imgs = container.findAll(n => n.tagName === 'IMG');
      expect(imgs.length).toBeGreaterThan(5);
      expect(imgs.filter(n => !n.getAttribute('src'))).toHaveLength(0);
    } finally {
      act(() => root.unmount());
      miniDoc.body.removeChild(container);
    }
  });
});
