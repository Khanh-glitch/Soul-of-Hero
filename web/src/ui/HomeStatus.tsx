// Contextual home maintenance UI. All numbers come from engine.homeStatus(), the same
// planTerritory authority used by upkeep, decay and collapse. Nothing here moves items.
import { ITEMS } from '../game/catalog';
import { BAL } from '../game/core';
import type { RunState } from '../game/core';
import { homeStatus, nearestHomeStructure, claimAt, type HomeCabinetState } from '../game/engine';

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
  return (
    <div className="panel absolute" data-testid="home-status" data-state={s.state} style={{ right: 4, top: 96, width: 214, padding: '3px 5px', fontSize: 9, lineHeight: 1.15, pointerEvents: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
        <b>{s.name}</b><span style={{ color: '#b8a8c8' }}>HP {Math.ceil(s.hp)}/{s.maxHp}</span>
      </div>
      <div style={{ height: 3, background: '#2a1f33', margin: '2px 0' }}><div style={{ width: `${pct}%`, height: 3, background: pct > 50 ? '#7fd08a' : pct > 25 ? '#e8c060' : '#e0604a' }} /></div>
      <div style={{ color: tone }}>{headline}</div>
      {cab ? (
        <div style={{ color: cab.state === 'funded' ? '#9ae0ff' : '#ffae89' }}>
          Cabinet {cab.tx},{cab.ty} · {CABINET_STATE_LABEL[cab.state]}{cab.funded && cab.state !== 'idle' ? ` · ${hoursLabel(cab.hours)} left` : ''}
        </div>
      ) : (
        <div style={{ color: '#ffae89' }}>{claimAt(r, s.tx, s.ty) ? 'Cabinet in range' : 'Place a Cabinet on this foundation to fund upkeep'}</div>
      )}
      {cab && s.damaged && <div style={{ color: '#b8a8c8' }}>Repair needs {s.repairCost.map(([k, q]) => `${q} ${ITEMS[k].name}`).join(' + ')} in cabinet</div>}
      {cab && cab.state !== 'funded' && <div style={{ color: '#b8a8c8' }}>Open Cabinet (E) to deposit {Object.keys(cab.per24h).map(k => ITEMS[k].name).join(', ') || 'materials'}</div>}
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
