import React, { useEffect, useRef, useState } from 'react';
import { BAL, type RunState, type Stack } from '../game/core';
import { ITEMS } from '../game/catalog';
import { C, countItem, invWeight, carryLimit, cartWeight, cartLimit, phaseOf, runHours, dayTime, weatherAt, weatherSlot, effTile } from '../game/engine';
import { SPEED_KEY, activeStack } from '../game/sim';
import { getWorld, ZONES } from '../game/world';
import { WW } from '../game/core';
import { Slot, Icon } from './common';
import { getPrefs, setPrefs, subscribePrefs, DIRECTIONS, type DirectionId } from '../visual/direction';

// ---------------------------------------------------------------------------
// pixel glyphs — 7x7 rect art, same grid language as the world sprites
// ---------------------------------------------------------------------------
const GLYPHS: Record<string, string[]> = {
  hp: ['.......', '.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'],
  st: ['...xx..', '..xx...', '.xxxx..', '..xxx..', '..xx...', '.xx....', '.x.....'],
  fd: ['..xxx..', '.xxxxx.', '.xxxxx.', '..xxx..', '..xx...', '..xx...', '.xxx...'],
  h2o: ['...x...', '...x...', '..xxx..', '..xxx..', '.xxxxx.', '.xxxxx.', '..xxx..'],
  wr: ['...x...', '..xx...', '..xxx..', '.x.xxx.', '.xxxxx.', '..xxx..', '...x...'],
  rad: ['.x.x.x.', '..xxx..', 'xx.x.xx', 'xxxxxxx', 'xx.x.xx', '..xxx..', '.x.x.x.'],
  home: ['...x...', '..xxx..', '.xxxxx.', 'xxxxxxx', '.xx.xx.', '.xx.xx.', '.xxxxx.'],
  eye: ['.......', '..xxx..', '.x...x.', 'x..x..x', '.x...x.', '..xxx..', '.......'],
  warn: ['...x...', '...x...', '..x.x..', '..x.x..', '.x...x.', '.x.x.x.', 'xxxxxxx'],
  weight: ['..xxx..', '.x...x.', 'xxxxxxx', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..'],
  fuel: ['.xxxx..', '.x..x..', '.xxxxx.', '.x...x.', '.x...x.', '.x...x.', '.xxxxx.'],
  spark: ['...x...', '..xxx..', '.xxxxx.', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'],
  skull: ['..xxx..', '.xxxxx.', 'xx.x.xx', 'xxxxxxx', '.x.x.x.', '.xxxxx.', '..x.x..'],
};
export const Glyph = React.memo(function Glyph({ k, c, s = 7 }: { k: string; c: string; s?: number }) {
  const rows = GLYPHS[k] || GLYPHS.spark;
  return <svg width={s} height={s} viewBox="0 0 7 7" shapeRendering="crispEdges" style={{ display: 'block', flex: 'none' }} aria-hidden>
    {rows.flatMap((r, y) => [...r].map((ch, x) => ch === 'x' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={c} /> : null))}
  </svg>;
});

export function useVisualPrefs() {
  const [, f] = useState(0);
  useEffect(() => subscribePrefs(() => f(v => v + 1)), []);
  return getPrefs();
}

// ---------------------------------------------------------------------------
// gauge — icon + segmented track + numeric readout. Colour is never the only
// channel: the icon names the stat and the number is always on screen.
// ---------------------------------------------------------------------------
function Gauge({ k, v, max, col, w, big, ghost }: { k: string; v: number; max: number; col: string; w: number; big?: boolean; ghost?: number }) {
  const frac = Math.max(0, Math.min(1, v / max));
  const crit = frac < 0.25;
  return <div className={`gauge ${crit ? 'crit' : ''}`} title={`${k.toUpperCase()} ${Math.round(v)} / ${max}`}>
    <Glyph k={k} c={crit ? '#ff9a80' : col} s={big ? 9 : 7} />
    <div className="track" style={{ width: w, height: big ? 8 : 6 }}>
      {ghost !== undefined && ghost > frac && <div className="ghost" style={{ width: `${ghost * 100}%` }} />}
      <div className="fill" style={{ width: `${frac * 100}%`, background: `linear-gradient(180deg, ${col}, ${col}99 60%, ${col}dd)` }} />
      <div className="seg" />
    </div>
    <span className="num" style={{ fontSize: big ? 9 : 8 }}>{Math.round(v)}</span>
  </div>;
}

/** Left cluster: combat vitals large, survival needs compact but never hidden. */
export function Vitals({ r, now }: { r: RunState; now: number }) {
  const p = r.player;
  const hpGhost = useRef(1); const [ghost, setGhost] = useState(1);
  useEffect(() => {
    const f = p.hp / BAL.player.maxHp;
    if (f < hpGhost.current) { setGhost(hpGhost.current); const t = setTimeout(() => { hpGhost.current = f; setGhost(f); }, 420); return () => clearTimeout(t); }
    hpGhost.current = f; setGhost(f);
  }, [p.hp]);
  const zone = (getWorld().zoneNames || ZONES)[getWorld().zone[Math.floor(p.y / 16) * WW + Math.floor(p.x / 16)]];
  const surf = SPEED_KEY[effTile(r, Math.floor(p.x / 16), Math.floor(p.y / 16))] || '';
  const w = invWeight(r), lim = carryLimit(r); const over = w > lim;
  void now;
  return <div className="plate" style={{ padding: '4px 5px 3px', width: 116 }}>
    <Gauge k="hp" v={p.hp} max={BAL.player.maxHp} col="var(--hp)" w={74} big ghost={ghost} />
    <div style={{ height: 2 }} />
    <Gauge k="st" v={p.stamina} max={BAL.player.maxStamina} col="var(--stam)" w={74} />
    <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
      <MiniStat k="fd" v={p.hunger} col="var(--food)" />
      <MiniStat k="h2o" v={p.thirst} col="var(--water)" />
      <MiniStat k="wr" v={p.warmth} col="var(--warm)" />
    </div>
    {p.rad > 1 && <div style={{ marginTop: 2 }}><Gauge k="rad" v={p.rad} max={100} col="#a8d040" w={74} /></div>}
    <div className="rule" style={{ margin: '3px 0 2px' }} />
    <div className="lbl" style={{ fontSize: 8, display: 'flex', alignItems: 'center', gap: 3, color: p.sheltered ? 'var(--good)' : 'var(--muted)' }}>
      {p.sheltered && <Glyph k="home" c="var(--good)" s={7} />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.sheltered ? 'Sheltered' : zone}</span>
      {surf && <span style={{ color: '#63737c', marginLeft: 'auto' }}>{surf}</span>}
    </div>
    {over && <div className="lbl" style={{ fontSize: 8, color: 'var(--warn)', display: 'flex', gap: 3, alignItems: 'center' }}>
      <Glyph k="weight" c="var(--warn)" s={7} />Overloaded {w.toFixed(0)}/{lim}kg · slowed
    </div>}
  </div>;
}
function MiniStat({ k, v, col }: { k: string; v: number; col: string }) {
  const crit = v < 25;
  return <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }} title={`${k} ${Math.round(v)}/100`}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Glyph k={k} c={crit ? '#ff9a80' : col} s={7} />
      <span className="lbl" style={{ fontSize: 8, color: crit ? '#ff9a80' : 'var(--paper)' }}>{Math.round(v)}</span>
    </div>
    <div className="track" style={{ height: 3, background: '#05070a', position: 'relative', boxShadow: 'inset 0 0 0 1px rgba(57,70,79,.8)' }}>
      <div style={{ position: 'absolute', inset: 0, width: `${Math.max(0, Math.min(100, v))}%`, background: crit ? '#e2543c' : col, transition: 'width 200ms linear' }} />
    </div>
  </div>;
}

// ---------------------------------------------------------------------------
// world clock — day arc, phase, weather now/next, run budget
// ---------------------------------------------------------------------------
const WGLYPH: Record<string, string> = { clear: 'CLEAR', cloudy: 'CLOUD', rain: 'RAIN', storm: 'STORM', fog: 'FOG' };
export function WorldClock({ r, now, secured }: { r: RunState; now: number; secured: number }) {
  const ph = phaseOf(r, now); const hrs = runHours(r, now); const day = Math.floor(hrs / 24) + 1;
  const dtm = dayTime(r, now); const w = weatherAt(r, now);
  const slot = Math.floor((now - r.startedAt + r.qaOffset) / (BAL.weather.slotMinutes * 60000));
  const next = weatherSlot(r.seed, slot + 1);
  const hh = String(Math.floor(dtm * 24)).padStart(2, '0'), mm = String(Math.floor((dtm * 24 % 1) * 60)).padStart(2, '0');
  const night = dtm < 0.25 || dtm > 0.75;
  const phaseCol = ph === 'calm' ? 'var(--good)' : ph === 'danger' ? 'var(--warn)' : 'var(--bad)';
  const held = countItem(r, 'inv', 'rcash');
  // 24h arc: a 40px dial with a sun/moon marker — time reads without digits
  const ang = dtm * Math.PI * 2 - Math.PI / 2;
  return <div className="plate" style={{ padding: '4px 6px 3px', width: 132 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <svg width="18" height="18" viewBox="0 0 18 18" shapeRendering="crispEdges" aria-hidden>
        <circle cx="9" cy="9" r="7.5" fill="#05070a" stroke="var(--edge)" strokeWidth="1" />
        <path d="M1.5 9 A7.5 7.5 0 0 1 16.5 9" fill="none" stroke="#2a3a44" strokeWidth="2" />
        <rect x={8 + Math.cos(ang) * 6} y={8 + Math.sin(ang) * 6} width="2" height="2" fill={night ? '#9fc8e0' : '#ffd166'} />
      </svg>
      <div style={{ lineHeight: 1 }}>
        <div className="lbl" style={{ fontSize: 11, color: 'var(--brassLit)' }}>{hh}:{mm}</div>
        <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)' }}>Day {day} / 14</div>
      </div>
      <span className="chip" style={{ color: phaseCol, marginLeft: 'auto' }}>{ph === 'calm' ? 'CALM' : ph === 'danger' ? 'WAKING' : 'RAGNAROK'}</span>
    </div>
    <div className="rule" style={{ margin: '3px 0 2px' }} />
    <div className="lbl" style={{ fontSize: 8, display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
      <span style={{ color: w === 'storm' ? 'var(--info)' : 'var(--paper)' }}>{WGLYPH[w]}</span>
      <span>next {WGLYPH[next]}</span>
    </div>
    <div className="track" style={{ height: 3, marginTop: 2, background: '#05070a', position: 'relative', boxShadow: 'inset 0 0 0 1px rgba(57,70,79,.8)' }} title={`Run ${Math.floor(hrs)}h of ${BAL.run.maxRunHours}h`}>
      <div style={{ position: 'absolute', inset: 0, width: `${Math.min(100, hrs / BAL.run.maxRunHours * 100)}%`, background: 'linear-gradient(90deg,var(--brass),var(--bad))' }} />
    </div>
    <div className="lbl" style={{ fontSize: 8, marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--info)' }}>secured {secured}</span>
      {held > 0 && <span style={{ color: 'var(--brassLit)' }}>carried {held}</span>}
    </div>
  </div>;
}

// ---------------------------------------------------------------------------
// hotbar + held-item card: what it is, what it does, what it costs to use
// ---------------------------------------------------------------------------
export function Hotbar({ r, onPick, onUse }: { r: RunState; onPick: (i: number) => void; onUse: (i: number) => void }) {
  const p = r.player; const s = activeStack(r);
  return <div className="plate hotbar" style={{ alignItems: 'flex-end' }}>
    {C(r, 'inv').slots.slice(0, 8).map((sl, i) => <Slot key={i} s={sl} active={i === p.active} hotkey={String(i + 1)} onClick={() => onPick(i)} onContext={() => onUse(i)} />)}
    <div style={{ width: 115, marginLeft: 4, alignSelf: 'center', lineHeight: 1.15 }}>
      <HeldInfo s={s} r={r} />
    </div>
  </div>;
}
function HeldInfo({ s, r }: { s: Stack | null; r: RunState }) {
  if (!s) return <><div className="lbl" style={{ fontSize: 9, color: 'var(--paper)' }}>Bare hands</div><div className="lbl" style={{ fontSize: 8, color: 'var(--muted)' }}>LMB swing · E interact</div></>;
  const d = ITEMS[s.key];
  const core = d.creatorCore;
  return <>
    <div className="lbl" style={{ fontSize: 9, color: 'var(--brassLit)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
    {core && s.reserves ? <div className="core-readout" role="group" aria-label={`Core reserves: basic ${s.reserves.basic} of 40, refined ${s.reserves.refined} of 12, signature ${s.reserves.signature} of 4`}>
      {([['B', s.reserves.basic, 40, 'Basic · LMB · R loads', 'var(--paper)'], ['Q', s.reserves.refined, 12, 'Refined · hold Q · Shift+R loads', 'var(--info)'], ['E', s.reserves.signature, 4, 'Signature · hold E · Alt+R loads', 'var(--brassLit)']] as const).map(([key, value, cap, title, color]) =>
        <span key={key} className={value === 0 ? 'empty' : ''} title={`${title}: ${value}/${cap}`} style={{ color }}><b>{key}</b><i><em style={{ width: `${100 * value / cap}%`, background: value > 0 ? color : 'var(--bad)' }} /></i><strong>{value}</strong></span>)}
    </div>
      : d.core ? <div className="lbl" style={{ fontSize: 8, color: s.charge ? 'var(--info)' : 'var(--bad)' }}>{s.charge}/{d.charge} charges · LMB cast</div>
        : d.food ? <div className="lbl" style={{ fontSize: 8, color: 'var(--good)' }}>LMB consume</div>
          : d.dmg ? <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)' }}>dmg {d.dmg}{d.power ? ' · tool' : ''}{s.dur !== undefined && d.dur ? ` · ${Math.round((s.dur / d.dur) * 100)}%` : ''}</div>
            : d.place ? <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)' }}>LMB place</div>
              : <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)' }}>{d.cat}</div>}
    {core && s.reserves && s.reserves.basic + s.reserves.refined + s.reserves.signature === 0 && <div className="lbl" style={{ fontSize: 8, color: 'var(--bad)' }}>EMPTY · R / Shift+R / Alt+R</div>}
    {void r}
  </>;
}

// ---------------------------------------------------------------------------
// vehicle / cart readout — physical consequence, not just a number
// ---------------------------------------------------------------------------
export function RigStatus({ r }: { r: RunState }) {
  const p = r.player;
  const bike = p.vehicle ? r.entities[p.vehicle] : null;
  const cart = p.pulling ? r.entities[p.pulling] : null;
  if (bike?.vehicle) {
    const dry = bike.vehicle.fuel <= 0, broken = (bike.hp ?? 0) <= 0;
    const state = broken ? 'BROKEN' : dry ? 'OUT OF FUEL' : 'READY';
    const col = broken ? 'var(--bad)' : dry ? 'var(--warn)' : 'var(--good)';
    const frac = Math.max(0, Math.min(1, bike.vehicle.fuel / BAL.motorbike.tank));
    const cw = cartWeight(r, bike.c!);
    return <div className="plate" style={{ padding: '3px 6px', width: 176 }}>
      <div className="lbl" style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span className={`lamp ${broken ? 'diamond' : 'round'}`} style={{ color: col }} />
        <b style={{ color: col }}>MOTORBIKE · {state}</b>
        <span style={{ marginLeft: 'auto', color: 'var(--muted)' }}>[F] exit</span>
      </div>
      <div style={{ display: 'flex', gap: 5, marginTop: 2, alignItems: 'center' }}>
        <Glyph k="fuel" c={dry ? 'var(--warn)' : 'var(--good)'} s={7} />
        <div className="track" style={{ flex: 1, height: 4, background: '#05070a', position: 'relative', boxShadow: 'inset 0 0 0 1px rgba(57,70,79,.8)' }}>
          <div style={{ position: 'absolute', inset: 0, width: `${frac * 100}%`, background: frac > 0.25 ? 'var(--good)' : 'var(--warn)' }} />
        </div>
        <span className="lbl" style={{ fontSize: 8 }}>{bike.vehicle.fuel.toFixed(1)}</span>
      </div>
      <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)', marginTop: 1 }}>
        HP {Math.ceil(bike.hp || 0)} · cargo {cw.toFixed(1)}/{BAL.motorbike.maxWeight}kg
        {cw > BAL.motorbike.maxWeight && <span style={{ color: 'var(--warn)' }}> · heavy</span>}
      </div>
      {(dry || broken) && <div className="lbl" style={{ fontSize: 8, color: 'var(--warn)' }}>{broken ? 'Dismount and repair: 1 Part + 1 Fastener' : 'Dismount and add 1 Fuel Canister'}</div>}
    </div>;
  }
  if (cart) {
    const cw = cartWeight(r, cart.c!), lim = cartLimit(cart);
    const t = effTile(r, Math.floor(cart.x / 16), Math.floor(cart.y / 16)); const k = SPEED_KEY[t];
    const good = k === 'road' || k === 'bridge' || k === 'floor';
    const rough = ['forest', 'marsh', 'hill', 'snow'].includes(k);
    const mul = good ? BAL.cart.speedOnRoad : rough ? BAL.cart.speedRough : BAL.cart.speedOffRoad;
    const over = cw > lim;
    return <div className="plate" style={{ padding: '3px 6px', width: 176 }}>
      <div className="lbl" style={{ fontSize: 9, display: 'flex', gap: 4, alignItems: 'center' }}>
        <Glyph k="weight" c={over ? 'var(--warn)' : 'var(--brass)'} s={7} />
        <b style={{ color: over ? 'var(--warn)' : 'var(--brassLit)' }}>CART {cw.toFixed(0)}/{lim}kg</b>
        <span style={{ marginLeft: 'auto', color: 'var(--muted)' }}>[F] release</span>
      </div>
      <div className="track" style={{ height: 4, marginTop: 2, background: '#05070a', position: 'relative', boxShadow: 'inset 0 0 0 1px rgba(57,70,79,.8)' }}>
        <div style={{ position: 'absolute', inset: 0, width: `${Math.min(100, cw / lim * 100)}%`, background: over ? 'var(--bad)' : 'var(--brass)' }} />
      </div>
      <div className="lbl" style={{ fontSize: 8, marginTop: 1, color: good ? 'var(--good)' : rough ? 'var(--bad)' : 'var(--warn)' }}>
        {good ? 'On road' : rough ? 'Rough ground' : 'Off-road'} ×{mul}{over ? ' · overloaded, crawling' : ''}
      </div>
    </div>;
  }
  return null;
}

// ---------------------------------------------------------------------------
// art direction + audio console (reachable from Esc → Presentation)
// ---------------------------------------------------------------------------
export function PresentationPanel() {
  const p = useVisualPrefs();
  const Row = ({ label, k, min = 0, max = 1, step = 0.05 }: { label: string; k: keyof typeof p; min?: number; max?: number; step?: number }) =>
    <label className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, marginTop: 3 }}>
      <span style={{ width: 62, color: 'var(--muted)' }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={p[k] as number} onChange={e => setPrefs({ [k]: +e.target.value } as any)} style={{ flex: 1 }} />
      <span style={{ width: 24, textAlign: 'right' }}>{Math.round((p[k] as number) * 100)}</span>
    </label>;
  return <div>
    <div className="console-h">Art direction · same frame, three readings</div>
    {(Object.keys(DIRECTIONS) as DirectionId[]).map(id => {
      const d = DIRECTIONS[id];
      return <div key={id} className={`dirbtn ${p.direction === id ? 'on' : ''}`} style={{ marginBottom: 3 }} onClick={() => setPrefs({ direction: id })} role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setPrefs({ direction: id }); }}>
        <div className="lbl" style={{ fontSize: 10, color: p.direction === id ? 'var(--brassLit)' : 'var(--paper)' }}>{d.name}{id === 'arcane' && <span className="chip" style={{ color: 'var(--good)', marginLeft: 5 }}>SHIPPED</span>}</div>
        <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)' }}>{d.tagline}</div>
      </div>;
    })}
    <Row label="Grade" k="grade" max={1.5} />
    <Row label="Cam shake" k="shake" />
    <div className="rule" style={{ margin: '5px 0' }} />
    <div className="console-h">Mixer</div>
    <Row label="Music" k="music" /><Row label="Ambience" k="ambience" /><Row label="World" k="world" /><Row label="Combat" k="combat" /><Row label="Interface" k="ui" />
    <div className="rule" style={{ margin: '5px 0' }} />
    <div className="console-h">Accessibility</div>
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      <button className={`btn sm ${p.reduceFlash ? 'gold' : ''}`} onClick={() => setPrefs({ reduceFlash: !p.reduceFlash })}>Reduce flashes {p.reduceFlash ? 'ON' : 'OFF'}</button>
      <button className={`btn sm ${p.highContrastHud ? 'gold' : ''}`} onClick={() => setPrefs({ highContrastHud: !p.highContrastHud })}>Solid HUD {p.highContrastHud ? 'ON' : 'OFF'}</button>
      <button className={`btn sm ${p.muted ? 'danger' : ''}`} onClick={() => setPrefs({ muted: !p.muted })}>{p.muted ? 'UNMUTE ALL' : 'MUTE ALL'}</button>
    </div>
  </div>;
}

// ---------------------------------------------------------------------------
// compact top-centre threat bar for Elder encounters
// ---------------------------------------------------------------------------
export function ThreatBar({ name, color, hp, maxHp, awake }: { name: string; color: string; hp: number; maxHp: number; awake: boolean }) {
  return <div style={{ width: 260, textAlign: 'center' }}>
    <div className="lbl" style={{ fontSize: 10, color, textShadow: '0 1px 0 #000', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
      <Glyph k="skull" c={color} s={8} />{name}
      <span style={{ fontSize: 8, color: 'var(--muted)' }}>{awake ? 'AWAKENED' : 'LATENT'}</span>
    </div>
    <div className="track" style={{ height: 6, marginTop: 2, background: '#05070a', position: 'relative', boxShadow: 'inset 0 0 0 1px #000, 0 0 0 1px var(--edge)' }}>
      <div style={{ position: 'absolute', inset: 0, width: `${Math.max(0, hp / maxHp * 100)}%`, background: `linear-gradient(180deg, ${color}, #6a1a12)`, transition: 'width 200ms linear' }} />
      <div className="seg" style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, transparent 0 11px, rgba(0,0,0,.6) 11px 12px)' }} />
    </div>
  </div>;
}

export { Icon };
