import { useEffect, useState } from 'react';
import { ITEMS, stationBurnable } from '../game/catalog';
import { BAL, type RunState, type Stack, type Container } from '../game/core';
import { C, cartWeight, isStationFuel } from '../game/engine';
import { Icon, type Api } from './common';

// ============================================================================
// ONE item-handling grammar for every container in the game.
//   drag & drop  → move / swap / merge (engine `move`)
//   click        → inspect (never a hidden "pick up, click again" state)
//   double-click → use / equip (engine `useItem`), equipped → back to pack
//   right-click  → quick action (into the open container, or use)
//   shift-click  → quick transfer between pack and the other side
//   hover + 1..8 → place onto that hotbar slot (handled in Game.tsx)
// Every outcome is still decided by dispatch; this file only routes intents.
// ============================================================================
type Ref = { c: string; slot: number };
const store: { drag: (Ref & { key: string; qty: number; uid: string }) | null; keyboardPick: (Ref & { key: string; uid: string }) | null; hover: Ref | null; x: number; y: number; subs: Set<() => void> } = { drag: null, keyboardPick: null, hover: null, x: 0, y: 0, subs: new Set() };
const emit = () => store.subs.forEach(f => f());
export const getHoverSlot = () => store.hover;
export const getKeyboardPick = () => store.keyboardPick;
export const isDragging = () => !!store.drag;
export function clearSlotInteraction() { store.drag = null; store.keyboardPick = null; store.hover = null; emit(); }

function useSlotStore() {
  const [, f] = useState(0);
  useEffect(() => { const s = () => f(v => v + 1); store.subs.add(s); return () => { store.subs.delete(s); }; }, []);
}

const EQ_SLOTS = ['head', 'body', 'back'] as const;
function acceptsUI(r: RunState, c: Container, slot: number, s: Stack): boolean {
  if (['loot', 'cash', 'out'].includes(c.kind)) return false;
  if (isStationFuel(r, c.id)) return stationBurnable(s.key);
  if (c.kind === 'fuel') return !!ITEMS[s.key]?.fuel;
  if (c.kind === 'eq') return ITEMS[s.key]?.slot === EQ_SLOTS[slot];
  return true;
}
function mergeableUI(a: Stack, b: Stack): boolean {
  return a.key === b.key && ITEMS[a.key].max > 1 && a.meta === b.meta && a.dur === b.dur && a.charge === b.charge && !a.reserves && !b.reserves;
}

/** Read-only mirror of engine `move` validation for live drop-target feedback. */
export function canDropInSlot(r: RunState, fromCid: string, fromSlot: number, toCid: string, toSlot: number): { valid: boolean; reason?: string } {
  if (fromCid === toCid && fromSlot === toSlot) return { valid: false };
  const from = C(r, fromCid), to = C(r, toCid);
  if (!from || !to) return { valid: false };
  const s = from.slots[fromSlot];
  if (!s) return { valid: false };
  if (['loot', 'cash', 'out'].includes(to.kind)) return { valid: false, reason: 'Read-only slot' };
  if (isStationFuel(r, to.id) && !stationBurnable(s.key)) return { valid: false, reason: 'Station fuel only' };
  if (to.kind === 'fuel' && !ITEMS[s.key]?.fuel) return { valid: false, reason: 'Fuel items only' };
  if (to.kind === 'eq' && ITEMS[s.key]?.slot !== EQ_SLOTS[toSlot]) return { valid: false, reason: `Needs ${EQ_SLOTS[toSlot]} gear` };
  const tgt = to.slots[toSlot];
  if (tgt) {
    if (mergeableUI(tgt, s)) {
      if (tgt.qty >= ITEMS[s.key].max) return { valid: false, reason: 'Stack full' };
    } else if (!acceptsUI(r, from, fromSlot, tgt)) {
      return { valid: false, reason: 'Cannot swap into source slot' };
    }
  }
  if (to.kind === 'vehicle' && from !== to) {
    const swap = tgt && !mergeableUI(tgt, s) ? ITEMS[tgt.key].w * tgt.qty : 0;
    if (cartWeight(r, to.id) + ITEMS[s.key].w * s.qty - swap > BAL.motorbike.maxWeight + 1e-9) return { valid: false, reason: 'Vehicle overweight' };
  }
  if (from.kind === 'vehicle' && from !== to && tgt && !mergeableUI(tgt, s)) {
    if (cartWeight(r, from.id) - ITEMS[s.key].w * s.qty + ITEMS[tgt.key].w * tgt.qty > BAL.motorbike.maxWeight + 1e-9) return { valid: false, reason: 'Vehicle overweight' };
  }
  return { valid: true };
}

function stagePoint(cx: number, cy: number) {
  const st = document.querySelector('.stage') as HTMLElement | null; if (!st) return { x: cx, y: cy };
  const r = st.getBoundingClientRect(); const k = r.width / 640;
  return { x: (cx - r.left) / k, y: (cy - r.top) / k };
}

/** Original Gold2 drag target lookup, made Shadow DOM-aware at the R12 seam.
 * PointerEvent.composedPath() exposes the actual slot across the Gold visual
 * boundary; the document-level hit test alone sees only the shadow host. */
function goldDropSlotAtPointer(ev: PointerEvent): HTMLElement | null {
  for (const node of ev.composedPath()) {
    if (node instanceof Element) {
      const slot = node.closest('[data-dslot]');
      if (slot) return slot as HTMLElement;
    }
  }
  let hit: Element | null = document.elementFromPoint(ev.clientX, ev.clientY);
  for (let depth = 0; hit && depth < 6; depth++) {
    const deeper = (hit as HTMLElement).shadowRoot?.elementFromPoint(ev.clientX, ev.clientY);
    if (!deeper || deeper === hit) break;
    hit = deeper;
  }
  return hit?.closest('[data-dslot]') as HTMLElement | null;
}

export function DSlot({ api, cid, slot, s, hotkey, active, quickTo, size = 22, accent }: { api: Api; cid: string; slot: number; s: Stack | null; hotkey?: string; active?: boolean; quickTo?: string; size?: number; accent?: boolean }) {
  useSlotStore();
  const d = s ? ITEMS[s.key] : null;
  const sel = api.sel?.c === cid && api.sel.slot === slot;
  const dragging = store.drag?.c === cid && store.drag.slot === slot;
  const kbdPicked = store.keyboardPick?.c === cid && store.keyboardPick.slot === slot;
  const moving = store.drag || store.keyboardPick;
  const isSource = moving?.c === cid && moving.slot === slot;
  const dropCheck = moving && !isSource && api.gs.run ? canDropInSlot(api.gs.run, moving.c, moving.slot, cid, slot) : null;
  const isHover = store.hover?.c === cid && store.hover.slot === slot;
  const dropCls = dropCheck ? (dropCheck.valid ? (isHover ? 'drop-ok drop-hover' : 'drop-ok') : (isHover ? 'drop-bad drop-hover-bad' : 'drop-bad')) : '';
  const quick = () => {
    if (!s) return;
    const to = cid === 'inv' ? quickTo : 'inv';
    if (to) api.act('move', { from: cid, fs: slot, to });
    else if (cid === 'inv' && d?.slot) api.act('useItem', { c: cid, slot });
  };
  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (e.shiftKey) { quick(); return; }
    // A keyboard pick can also be placed with a pointer click, without turning
    // ordinary inspect-clicks into implicit swap actions.
    const keyboard = store.keyboardPick;
    if (keyboard) {
      store.keyboardPick = null;
      if (!(keyboard.c === cid && keyboard.slot === slot) && api.gs.run?.custody[keyboard.c]?.slots[keyboard.slot]?.uid === keyboard.uid) {
        const res = api.act('move', { from: keyboard.c, fs: keyboard.slot, to: cid, ts: slot });
        if (res.ok) api.setSel({ c: cid, slot });
      } else api.setSel(null);
      emit(); return;
    }
    if (!s) { api.setSel(null); return; }
    const sx = e.clientX, sy = e.clientY; let started = false;
    let finished = false;
    const cleanup = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', abort); window.removeEventListener('blur', abort);
      window.removeEventListener('keydown', cancel, true);
      store.drag = null; emit();
    };
    const abort = () => { if (!finished) { finished = true; cleanup(); } };
    const cancel = (ev: KeyboardEvent) => {
      if (ev.code !== 'Escape') return;
      ev.preventDefault(); ev.stopImmediatePropagation(); abort();
    };
    const move = (ev: PointerEvent) => {
      if (!started && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 3) { started = true; store.drag = { c: cid, slot, key: s.key, qty: s.qty, uid: s.uid }; }
      if (started) { const p = stagePoint(ev.clientX, ev.clientY); store.x = p.x; store.y = p.y; emit(); }
    };
    const up = (ev: PointerEvent) => {
      if (finished) return; finished = true;
      if (!started) { api.setSel(sel ? null : { c: cid, slot }); api.sfx('ui'); cleanup(); return; }
      const el = goldDropSlotAtPointer(ev);
      if (el && api.gs.run?.custody[cid]?.slots[slot]?.uid === s.uid) {
        const [tc, ts] = [el.dataset.c!, Number(el.dataset.s)];
        if (!(tc === cid && ts === slot)) { const res = api.act('move', { from: cid, fs: slot, to: tc, ts }); if (res.ok) { api.setSel({ c: tc, slot: ts }); } }
      }
      cleanup();
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', abort); window.addEventListener('blur', abort);
    window.addEventListener('keydown', cancel, true);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.code === 'Escape' && store.keyboardPick) { e.preventDefault(); e.stopPropagation(); store.keyboardPick = null; api.setSel(null); emit(); return; }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
      const grid = e.currentTarget.closest('.dgrid'); const cols = Number(grid?.getAttribute('data-cols') || 8);
      if (!grid) return;
      const shift = e.code === 'ArrowLeft' ? -1 : e.code === 'ArrowRight' ? 1 : e.code === 'ArrowUp' ? -cols : cols;
      const next = grid.querySelector<HTMLElement>(`[data-c="${cid}"][data-s="${slot + shift}"]`);
      if (next) { e.preventDefault(); e.stopPropagation(); next.focus(); }
      return;
    }
    if (e.code !== 'Enter' && e.code !== 'Space') return;
    e.preventDefault(); e.stopPropagation();
    if (e.shiftKey) { quick(); return; }
    const held = store.keyboardPick;
    if (held) {
      store.keyboardPick = null;
      if (!(held.c === cid && held.slot === slot) && api.gs.run?.custody[held.c]?.slots[held.slot]?.uid === held.uid) {
        const result = api.act('move', { from: held.c, fs: held.slot, to: cid, ts: slot });
        api.setSel(result.ok ? { c: cid, slot } : null);
      } else api.setSel(null);
    } else if (s) { store.keyboardPick = { c: cid, slot, key: s.key, uid: s.uid }; api.setSel({ c: cid, slot }); api.sfx('ui'); }
    emit();
  };
  const onDouble = () => {
    if (!s) return;
    if (cid === 'eq') api.act('move', { from: 'eq', fs: slot, to: 'inv' });
    else if (cid === 'inv') api.act('useItem', { c: 'inv', slot });
    else api.act('move', { from: cid, fs: slot, to: 'inv' });
  };
  const onContext = (e: React.MouseEvent) => {
    e.preventDefault(); if (!s) return;
    if (cid === 'inv') { if (quickTo) api.act('move', { from: cid, fs: slot, to: quickTo }); else api.act('useItem', { c: cid, slot }); }
    else api.act('move', { from: cid, fs: slot, to: 'inv' });
  };
  const durF = s && s.dur !== undefined && d?.dur ? s.dur / d.dur : null;
  const titleText = dropCheck && !dropCheck.valid && dropCheck.reason
    ? `${dropCheck.reason}${d ? ` · ${d.name}` : ''}`
    : d ? `${d.name}${s!.qty > 1 ? ` ×${s!.qty}` : ''}` : '';
  return <div className={`dslot ${sel ? 'sel' : ''} ${active ? 'active' : ''} ${accent ? 'accent' : ''} ${dragging ? 'lifted' : ''} ${kbdPicked ? 'kbd-picked' : ''} ${dropCls} ${s ? '' : 'empty'}`}
    data-dslot="1" data-c={cid} data-s={slot} data-drop={dropCheck ? (dropCheck.valid ? 'ok' : 'bad') : undefined} style={{ width: size, height: size }}
    role="button" tabIndex={0} aria-pressed={sel} aria-label={`Slot ${slot + 1}${hotkey ? `, hotbar ${hotkey}` : ''}: ${d ? `${d.name}, ${s!.qty} carried` : 'empty'}.${active ? ' Active in hand.' : ''}${kbdPicked ? ' Picked up for keyboard move.' : ''} Enter picks or places; Escape cancels.`}
    onPointerDown={onDown} onKeyDown={onKeyDown} onDoubleClick={onDouble} onContextMenu={onContext}
    onPointerEnter={() => { store.hover = { c: cid, slot }; if (store.drag || store.keyboardPick) emit(); }}
    onPointerLeave={() => { if (store.hover?.c === cid && store.hover.slot === slot) { store.hover = null; if (store.drag || store.keyboardPick) emit(); } }}
    onFocus={() => { if (store.keyboardPick) { store.hover = { c: cid, slot }; emit(); } }}
    title={titleText}>
    {hotkey && <span className="dslot__key">{hotkey}</span>}
    {active && <span className="dslot__active-pip" aria-hidden="true" />}
    {kbdPicked && <span className="dslot__hold">MOVE</span>}
    {s && <Icon k={s.key} size={size - 6} />}
    {s && s.qty > 1 && <span className="dslot__qty">{s.qty}</span>}
    {s && d?.charge && s.charge !== undefined && <span className="dslot__qty" style={{ color: s.charge ? 'var(--info)' : 'var(--bad)' }}>{s.charge}⚡</span>}
    {durF !== null && <span className="dslot__dur"><i style={{ width: `${durF * 100}%`, background: durF < 0.25 ? 'var(--bad)' : durF < 0.5 ? 'var(--warn)' : 'var(--good)' }} /></span>}
    {s && s.dur === 0 && d?.repair && <span className="dslot__broken">!</span>}
  </div>;
}

/** Floating icon + item label that follows the pointer while dragging; mount once per screen. */
export function DragGhost() {
  useSlotStore();
  if (!store.drag) return null;
  const nm = ITEMS[store.drag.key]?.name ?? store.drag.key;
  return <div className="drag-ghost" style={{ left: store.x - 10, top: store.y - 10 }}>
    <Icon k={store.drag.key} size={18} />
    {store.drag.qty > 1 && <b>{store.drag.qty}</b>}
    <span className="drag-ghost__lbl">{nm}</span>
  </div>;
}

/** Status banner shown when an item is lifted via keyboard Enter/Space. */
export function KeyboardMoveBanner() {
  useSlotStore();
  if (!store.keyboardPick) return null;
  const nm = ITEMS[store.keyboardPick.key]?.name ?? store.keyboardPick.key;
  return <div className="kbd-move-bar" role="status">
    <Icon k={store.keyboardPick.key} size={11} />
    <span>Moving <b>{nm}</b> · Arrows + <span className="key">Enter</span> place · <span className="key">Esc</span> cancel</span>
  </div>;
}

/** Grid of DSlots for any container. When `hotRow` is true, renders a protected Quickbar (1-8) shelf above Backpack. */
export function DGrid({ api, cid, cols = 8, quickTo, hotRow = false, size = 22 }: { api: Api; cid: string; cols?: number; quickTo?: string; hotRow?: boolean; size?: number }) {
  useEffect(() => () => clearSlotInteraction(), []);
  const c = C(api.gs.run!, cid); if (!c) return null;
  if (hotRow && c.slots.length > 8) {
    const hot = c.slots.slice(0, 8), pack = c.slots.slice(8);
    return <div className="dgrid dgrid--tiered" data-cols={cols}>
      <div className="dgrid-tier dgrid-tier--hot">
        <div className="dgrid-tier__head">
          <span>QUICKBAR · 1–8</span>
          <small title="Sort organizes Backpack slots 9–24 while keeping your Quickbar intact">PROTECTED</small>
        </div>
        <div className="dgrid-row" style={{ gridTemplateColumns: `repeat(${cols}, ${size}px)` }}>
          {hot.map((s, i) => <DSlot key={i} api={api} cid={cid} slot={i} s={s} size={size} quickTo={quickTo} hotkey={String(i + 1)} accent active={i === api.gs.run!.player.active} />)}
        </div>
      </div>
      <div className="dgrid-tier dgrid-tier--pack">
        <div className="dgrid-tier__head"><span>BACKPACK · {pack.filter(Boolean).length}/{pack.length}</span></div>
        <div className="dgrid-row" style={{ gridTemplateColumns: `repeat(${cols}, ${size}px)` }}>
          {pack.map((s, j) => { const i = j + 8; return <DSlot key={i} api={api} cid={cid} slot={i} s={s} size={size} quickTo={quickTo} />; })}
        </div>
      </div>
    </div>;
  }
  return <div className="dgrid" data-cols={cols} style={{ gridTemplateColumns: `repeat(${cols}, ${size}px)` }}>
    {c.slots.map((s, i) => <DSlot key={i} api={api} cid={cid} slot={i} s={s} size={size} quickTo={quickTo} hotkey={hotRow && i < 8 ? String(i + 1) : undefined} accent={hotRow && i < 8} active={hotRow && i === api.gs.run!.player.active} />)}
  </div>;
}
