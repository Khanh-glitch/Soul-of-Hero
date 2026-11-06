// B04-P3 local heat card: read-only view of the real thermal evaluator and real station fuel custody.
import { TILE, WW, type RunState } from '../game/core';
import { darkness, weatherAt, isWet, isSheltered, effTile } from '../game/engine';
import { thermalEnv, thermalStatusView, type HeaterRow } from '../game/thermal';
import { getWorld } from '../game/world';

export function thermalEnvNow(r: RunState, now: number) {
  const p = r.player, tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
  return thermalEnv(r, {
    x: p.x, y: p.y, zone: getWorld().zone[ty * WW + tx], tileType: effTile(r, tx, ty),
    wet: isWet(weatherAt(r, now)), dark: darkness(r, now) > 0.45, sheltered: isSheltered(r, p.x, p.y),
  });
}

function heaterLine(h: HeaterRow): { text: string; tone: string } {
  const name = h.kind === 'campfire' ? 'Campfire' : 'Furnace', id = h.id.slice(-4), mins = Math.floor(h.paidMs / 60000);
  if (h.status === 'burning') return { text: `${name} …${id} · burning · ${mins} min paid · +${h.contributes}`, tone: '#9ae0a0' };
  if (h.status === 'out_of_fuel') return { text: `${name} …${id} · out of fuel (burned out) · 0`, tone: '#ff9a8a' };
  if (h.status === 'idle_furnace') return { text: `${name} …${id} · idle, no job · 0`, tone: '#d8c890' };
  return { text: `${name} …${id} · blocked by wall · 0`, tone: '#ff9a8a' };
}

export function ThermalStatusCard({ r, now, hidden }: { r: RunState; now: number; hidden?: boolean }) {
  if (hidden || r.player.dead) return null;
  const v = thermalStatusView(r, thermalEnvNow(r, now), r.player.warmth);
  const show = v.cold || v.heaters.length > 0 || v.warmth < v.coldThreshold + 20;
  if (!show) return null;
  const pct = Math.max(0, Math.min(100, Math.round(v.warmth)));
  const tone = v.cold ? '#ff9a8a' : '#9ae0a0';
  const exposure = v.exposures.length ? v.exposures.map(e => `${e.label} ${e.value}`).join(' · ') : 'none';
  return (
    <div className="panel absolute" data-testid="thermal-status" data-cold={v.cold ? '1' : '0'} style={{ left: 4, top: 88, width: 240, padding: '3px 5px', fontSize: 11, lineHeight: 1.15, pointerEvents: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
        <b style={{ color: tone }}>{v.cold ? 'COLD' : 'WARMTH'} {pct}</b>
        <span style={{ color: '#cfc2dc' }}>target {Math.round(v.target)}</span>
      </div>
      <div style={{ height: 3, background: '#2a1f33', margin: '2px 0' }}><div style={{ width: `${pct}%`, height: 3, background: tone }} /></div>
      <div style={{ color: '#b8a8c8' }}>exposure: {exposure}</div>
      <div style={{ color: '#b8a8c8' }}>gear insulation {v.insulation}{v.insulation ? ` (cuts exposure ${Math.round(v.insulation / 3)})` : ''}</div>
      <div style={{ color: v.sheltered ? '#9ae0a0' : '#b8a8c8' }}>{v.sheltered ? 'roofed enclosed shelter (counts)' : 'no roofed shelter'}</div>
      {v.heaters.length === 0 && <div style={{ color: '#ffae89' }}>no campfire or furnace within reach</div>}
      {v.heaters.map(h => { const l = heaterLine(h); return <div key={h.id} style={{ color: l.tone }}>{l.text}</div>; })}
      <div style={{ color: '#7a6a8a' }}>heat counts only while paid fuel burns</div>
    </div>
  );
}
