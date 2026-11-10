import { useEffect, useState } from 'react';
import { ITEMS } from '../game/catalog';
import { C } from '../game/engine';
import type { Stack } from '../game/core';
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
const store: { drag: (Ref & { key: string; qty: number; uid: string }) | null; keyboardPick: (Ref & { uid: string }) | null; hover: Ref | null; x: number; y: number; subs: Set<() => void> } = { drag: null, keyboardPick: null, hover: null, x: 0, y: 0, subs: new Set() };
const emit = () => store.subs.forEach(f => f());
export const getHoverSlot = () => store.hover;
export const isDragging = () => !!store.drag;
export function clearSlotInteraction() { store.drag = null; store.keyboardPick = null; store.hover = null; emit(); }

function stagePoint(cx: number, cy: number) {
  const st = document.querySelector('.stage') as HTMLElement | null; if (!st) return { x: cx, y: cy };
  const r = st.getBoundingClientRect(); const k = r.width / 640;
  return { x: (cx - r.left) / k, y: (cy - r.top) / k };
}

export function DSlot({ api, cid, slot, s, hotkey, active, quickTo, size = 22, accent }: { api: Api; cid: string; slot: number; s: Stack | null; hotkey?: string; active?: boolean; quickTo?: string; size?: number; accent?: boolean }) {
  const d = s ? ITEMS[s.key] : null;
  const sel = api.sel?.c === cid && api.sel.slot === slot;
  const dragging = store.drag?.c === cid && store.drag.slot === slot;
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
      const el = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest('[data-dslot]') as HTMLElement | null;
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
    } else if (s) { store.keyboardPick = { c: cid, slot, uid: s.uid }; api.setSel({ c: cid, slot }); api.sfx('ui'); }
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
  return <div className={`dslot ${sel ? 'sel' : ''} ${active ? 'active' : ''} ${accent ? 'accent' : ''} ${dragging ? 'lifted' : ''} ${s ? '' : 'empty'}`}
    data-dslot="1" data-c={cid} data-s={slot} style={{ width: size, height: size }}
    role="button" tabIndex={0} aria-pressed={sel} aria-label={`Slot ${slot + 1}${hotkey ? `, hotbar ${hotkey}` : ''}: ${d ? `${d.name}, ${s!.qty} carried` : 'empty'}. Enter picks or places; Escape cancels.`}
    onPointerDown={onDown} onKeyDown={onKeyDown} onDoubleClick={onDouble} onContextMenu={onContext}
    onPointerEnter={() => { store.hover = { c: cid, slot }; }} onPointerLeave={() => { if (store.hover?.c === cid && store.hover.slot === slot) store.hover = null; }}
    title={d ? `${d.name}${s!.qty > 1 ? ` ×${s!.qty}` : ''}` : ''}>
    {hotkey && <span className="dslot__key">{hotkey}</span>}
    {s && <Icon k={s.key} size={size - 6} />}
    {s && s.qty > 1 && <span className="dslot__qty">{s.qty}</span>}
    {s && d?.charge && s.charge !== undefined && <span className="dslot__qty" style={{ color: s.charge ? 'var(--info)' : 'var(--bad)' }}>{s.charge}⚡</span>}
    {durF !== null && <span className="dslot__dur"><i style={{ width: `${durF * 100}%`, background: durF < 0.25 ? 'var(--bad)' : durF < 0.5 ? 'var(--warn)' : 'var(--good)' }} /></span>}
    {s && s.dur === 0 && d?.repair && <span className="dslot__broken">!</span>}
  </div>;
}

/** Floating icon that follows the pointer while dragging; mount once per screen. */
export function DragGhost() {
  const [, f] = useState(0);
  useEffect(() => { const s = () => f(v => v + 1); store.subs.add(s); return () => { store.subs.delete(s); }; }, []);
  if (!store.drag) return null;
  return <div className="drag-ghost" style={{ left: store.x - 10, top: store.y - 10 }}><Icon k={store.drag.key} size={18} />{store.drag.qty > 1 && <b>{store.drag.qty}</b>}</div>;
}

/** Grid of DSlots for any container. */
export function DGrid({ api, cid, cols = 8, quickTo, hotRow = false, size = 22 }: { api: Api; cid: string; cols?: number; quickTo?: string; hotRow?: boolean; size?: number }) {
  useEffect(() => () => clearSlotInteraction(), []);
  const c = C(api.gs.run!, cid); if (!c) return null;
  return <div className="dgrid" data-cols={cols} style={{ gridTemplateColumns: `repeat(${cols}, ${size}px)` }}>
    {c.slots.map((s, i) => <DSlot key={i} api={api} cid={cid} slot={i} s={s} size={size} quickTo={quickTo} hotkey={hotRow && i < 8 ? String(i + 1) : undefined} accent={hotRow && i < 8} active={hotRow && i === api.gs.run!.player.active} />)}
  </div>;
}
