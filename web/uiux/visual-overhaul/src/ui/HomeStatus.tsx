// Contextual home maintenance UI. All numbers come from engine.homeStatus(), the same
// planTerritory authority used by upkeep, decay and collapse. Nothing here moves items.
import { ITEMS } from '../game/catalog';
import { BAL } from '../game/core';
import type { RunState } from '../game/core';
import { homeStatus, nearestHomeStructure, claimAt, type HomeCabinetState } from '../game/engine';
import { Glyph } from './hud';
import { Icon } from './common';

export const CABINET_STATE_LABEL: Record<HomeCabinetState, string> = {
  idle: 'No structures covered yet',
  unfunded: 'UNFUNDED',
  low: 'Low stock',
  funded: 'Funded',
};

export function hoursLabel(h: number | null | undefined) {
  if (h === null || h === undefined || !Number.isFinite(h)) return 'stable';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  return `${h.toFixed(1)} h`;
}

function stockList(stock: Record<string, number>, empty = 'none') {
  const parts = Object.entries(stock).map(([k, q]) => `${q} ${ITEMS[k]?.name || k}`);
  return parts.length ? parts.join(', ') : empty;
}

/** Top-right contextual card shown only near owned structures. Never a permanent dashboard. */
export function HomeStatusCard({ r, px, py, hidden }: { r: RunState; px: number; py: number; hidden?: boolean }) {
  if (hidden) return null;
  const tx = Math.floor(px / 16), ty = Math.floor(py / 16);
  const near = nearestHomeStructure(r, tx, ty, 6);
  if (!near) return null;
  const status = homeStatus(r);
  const s = status.structures.find(x => x.id === near.id);
  if (!s) return null;
  const cab = s.cabinetId ? status.cabinets.find(c => c.id === s.cabinetId) : null;
  const tone = s.state === 'funded' ? (s.damaged ? '#ffd98a' : '#9ae0a0') : '#ffae89';
  const headline = s.state === 'uncovered'
    ? `No Cabinet coverage · collapses in ${hoursLabel(s.hoursToCollapse)}`
    : s.state === 'unfunded'
      ? `Covered, unfunded · collapses in ${hoursLabel(s.hoursToCollapse)}`
      : s.damaged ? 'Funded · damaged, repair at Cabinet' : 'Funded · protected from decay';
  const pct = Math.max(0, Math.min(100, Math.round((s.hp / s.maxHp) * 100)));
  const protectedOk = s.state === 'funded';
  const hours = cab?.funded && cab.state !== 'idle' ? hoursLabel(cab.hours) : s.hoursToCollapse !== null && s.hoursToCollapse !== undefined ? hoursLabel(s.hoursToCollapse) : null;
  void headline; void CABINET_STATE_LABEL;
  return (
    <div className="plate absolute homecard" data-testid="home-status" data-state={s.state} style={{ right: 4, top: 132, width: 150, padding: '3px 5px', pointerEvents: 'none' }} title={headline}>
      <div className="homecard__row">
        <Glyph k="home" c={protectedOk ? 'var(--good)' : 'var(--warn)'} s={8} />
        <b className="homecard__name">{s.name}</b>
        <span className="homecard__hp" style={{ color: pct > 50 ? 'var(--paper)' : pct > 25 ? 'var(--warn)' : 'var(--bad)' }}>{Math.ceil(s.hp)}</span>
      </div>
      <div className="homecard__track"><i style={{ width: `${pct}%`, background: pct > 50 ? 'var(--good)' : pct > 25 ? 'var(--warn)' : 'var(--bad)' }} /></div>
      <div className="homecard__lamps">
        <span className="chip" style={{ color: protectedOk ? 'var(--good)' : s.state === 'unfunded' ? 'var(--warn)' : 'var(--bad)' }} title={headline}>
          <i className="lamp round" style={{ color: 'currentColor' }} />{protectedOk ? 'PROTECTED' : s.state === 'unfunded' ? 'UNFUNDED' : 'NO CABINET'}{hours ? ` · ${hours}` : ''}
        </span>
        {cab && cab.state !== 'funded' && Object.keys(cab.per24h).slice(0, 5).map(k => <span key={k} title={`Deposit ${ITEMS[k].name} in the Cabinet`}><Icon k={k} size={9} /></span>)}
        {!cab && !claimAt(r, s.tx, s.ty) && <span title="Place a Territory Cabinet on this foundation"><Icon k="st:claim" size={10} /></span>}
        {cab && s.damaged && <span className="chip" style={{ color: 'var(--warn)' }} title={`Repair: ${s.repairCost.map(([k, q]) => `${q} ${ITEMS[k].name}`).join(' + ')} in cabinet`}>⚒ {s.repairCost.map(([k, q]) => <span key={k}><Icon k={k} size={8} />{q}</span>)}</span>}
      </div>
    </div>
  );
}

/** Legible cabinet readout used inside the Cabinet panel: state, stock, credit, rates and per-building risk. */
export function CabinetReadout({ r, eid }: { r: RunState; eid: string }) {
  const status = homeStatus(r);
  const c = status.cabinets.find(x => x.id === eid);
  if (!c) return null;
  const mine = status.structures.filter(s => s.cabinetId === eid && s.id !== eid);
  const shown = [...mine].sort((a, b) => (a.hoursToCollapse ?? 1e9) - (b.hoursToCollapse ?? 1e9)).slice(0, 8);
  const rates = Object.entries(c.per24h).map(([k, v]) => `${v.toFixed(2)} ${ITEMS[k].name}`).join(' · ') || 'none';
  const color = c.state === 'funded' ? '#9ae0a0' : c.state === 'low' ? '#e8c060' : c.state === 'unfunded' ? '#ff9a8a' : '#b8a8c8';
  return (
    <div data-testid="cabinet-readout" style={{ fontSize: 10, lineHeight: 1.25 }}>
      <div><b style={{ color }}>{CABINET_STATE_LABEL[c.state]}</b> · {c.external} covered · 25-tile coverage, nearest Cabinet assigned{c.selfOnly ? ' · Cabinet pays only its own upkeep' : ''}</div>
      <div>Physical stock: {stockList(c.stock)}</div>
      <div>Prepaid credit: {stockList(Object.fromEntries(Object.entries(c.prepaid).map(([k, q]) => [k, Math.round(q * 100) / 100])), 'none')}</div>
      <div>Upkeep per 24h: {rates}{c.state === 'funded' || c.state === 'low' ? ` · lasts ${hoursLabel(c.hours)}` : ''}</div>
      {shown.length === 0 && <div style={{ color: '#b8a8c8' }}>No structures in range yet.</div>}
      {shown.map(s => (
        <div key={s.id} data-state={s.state} style={{ display: 'flex', gap: 4, color: s.state === 'funded' ? (s.damaged ? '#ffd98a' : '#cfc2dc') : '#ffae89' }}>
          <span style={{ width: 84, overflow: 'hidden', whiteSpace: 'nowrap' }}>{s.name}</span>
          <span style={{ width: 52 }}>{Math.ceil(s.hp)}/{s.maxHp}</span>
          <span>{s.state === 'funded' ? (s.damaged ? 'funded · damaged' : 'funded') : `${s.state === 'unfunded' ? 'unfunded' : 'uncovered'} · ${hoursLabel(s.hoursToCollapse)}`}</span>
        </div>
      ))}
      {mine.length > shown.length && <div style={{ color: '#8a7a9a' }}>+{mine.length - shown.length} more structures in range</div>}
      <div style={{ color: '#8a7a9a' }}>Protection stops decay but does not repair. Repairs cost cabinet materials and restore a quarter of max HP.</div>
      <div style={{ color: '#8a7a9a' }}>Cabinet HP {Math.ceil(r.entities[eid]?.hp ?? 0)} · upkeep {Math.round(BAL.territory.upkeepFractionPerDay * 100)}% of each covered build cost per 24h.</div>
      {c.state !== 'funded' && <div style={{ color: '#ffd98a' }}>Deposit wood, stone or fiber into the cabinet to fund upkeep.</div>}
    </div>
  );
}
