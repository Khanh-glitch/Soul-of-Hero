// B04-P3 local heat card: read-only view of the real thermal evaluator and real station fuel custody.
import { TILE, WW, type RunState } from '../game/core';
import { darkness, weatherAt, isWet, isSheltered, effTile } from '../game/engine';
import { thermalEnv, thermalStatusView, type HeaterRow } from '../game/thermal';
import { getWorld } from '../game/world';
import { Glyph } from './hud';
import { Icon } from './common';

export function thermalEnvNow(r: RunState, now: number) {
  const p = r.player, tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
  return thermalEnv(r, {
    x: p.x, y: p.y, zone: getWorld().zone[ty * WW + tx], tileType: effTile(r, tx, ty),
    wet: isWet(weatherAt(r, now)), dark: darkness(r, now) > 0.45, sheltered: isSheltered(r, p.x, p.y),
  });
}

/** Compact heat card: one gauge with the thermal target as a tick, then glyph lamps. No sentences. */
export function ThermalStatusCard({ r, now, hidden }: { r: RunState; now: number; hidden?: boolean }) {
  if (hidden || r.player.dead) return null;
  const v = thermalStatusView(r, thermalEnvNow(r, now), r.player.warmth);
  const show = v.cold || v.heaters.length > 0 || v.warmth < v.coldThreshold + 20;
  if (!show) return null;
  const pct = Math.max(0, Math.min(100, Math.round(v.warmth)));
  const tone = v.cold ? 'var(--bad)' : 'var(--warm)';
  const HEAT: Record<HeaterRow['status'], { c: string; t: string }> = { burning: { c: 'var(--good)', t: 'burning' }, out_of_fuel: { c: 'var(--bad)', t: 'out of fuel' }, idle_furnace: { c: 'var(--warn)', t: 'idle' }, blocked_by_wall: { c: 'var(--bad)', t: 'blocked by wall' } };
  return (
    <div className="plate absolute heatcard" data-testid="thermal-status" data-cold={v.cold ? '1' : '0'} style={{ left: 4, top: 88, width: 150, padding: '3px 5px', pointerEvents: 'none' }}>
      <div className="heatcard__row">
        <Glyph k="wr" c={tone} s={9} />
        <div className="heatcard__track" title={`Warmth ${pct} · target ${Math.round(v.target)}`}>
          <i style={{ width: `${pct}%`, background: tone }} />
          <b style={{ left: `${Math.max(0, Math.min(100, v.target))}%` }} />
        </div>
        <span className="heatcard__num" style={{ color: tone }}>{pct}</span>
      </div>
      <div className="heatcard__lamps">
        <span title={v.sheltered ? 'Roofed shelter' : 'No roofed shelter'} style={{ color: v.sheltered ? 'var(--good)' : 'var(--muted)' }}><Glyph k="home" c="currentColor" s={7} /></span>
        {v.insulation > 0 && <span title={`Gear insulation ${v.insulation}`} style={{ color: 'var(--paper)' }}><Icon k="fur_cloak" size={8} />{v.insulation}</span>}
        {v.exposures.map(e => <span key={e.id} title={`${e.label} ${e.value}`} style={{ color: 'var(--info)' }}><Glyph k="h2o" c="currentColor" s={7} />{e.value}</span>)}
        {v.heaters.slice(0, 3).map(h => <span key={h.id} title={`${h.kind} · ${HEAT[h.status].t}${h.paidMs > 0 ? ` · ${Math.ceil(h.paidMs / 1000)}s fuel` : ''}`} style={{ color: HEAT[h.status].c }}><Icon k={h.kind === 'campfire' ? 'st:campfire' : 'st:furnace'} size={9} />{h.status === 'burning' ? `+${h.contributes}` : '0'}</span>)}
        {v.heaters.length === 0 && <span title="No campfire or furnace in reach" style={{ color: 'var(--muted)' }}><Icon k="st:campfire" size={9} />—</span>}
      </div>
    </div>
  );
}
