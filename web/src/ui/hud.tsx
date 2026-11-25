import React, { useEffect, useRef, useState } from 'react';
import { itemClassLabel } from '../game/item-class';
import { BAL, type RunState, type Stack } from '../game/core';
import { ITEMS } from '../game/catalog';
import { coreReadout, coreAmmo } from '../game/g1b';
import { C, countItem, invWeight, carryLimit, cartWeight, cartLimit, phaseOf, runHours, dayTime, weatherAt, weatherSlot, effTile } from '../game/engine';
import { SPEED_KEY, activeStack } from '../game/sim';
import { getWorld, ZONES } from '../game/world';
import { WW } from '../game/core';
import { Slot, Icon } from './common';
import { getPrefs, setPrefs, subscribePrefs, DIRECTIONS, DEFAULT_DIRECTION, type DirectionId } from '../visual/direction';
import { getLang, setLang, subscribeLang } from '../game/i18n';
import { fullscreenSupported, toggleFullscreen, useFullscreen } from './ScreenFit';

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
/** Plain names for hover help; the short keys (fd, h2o, wr) only pick the icon. */
const STAT_NAMES: Record<string, string> = { hp: 'Health', st: 'Stamina', fd: 'Food', h2o: 'Water', wr: 'Warmth', rad: 'Radiation' };
function Gauge({ k, v, max, col, w, big, ghost }: { k: string; v: number; max: number; col: string; w: number; big?: boolean; ghost?: number }) {
  const frac = Math.max(0, Math.min(1, v / max));
  const crit = frac < 0.25;
  return <div className={`gauge ${crit ? 'crit' : ''}`} title={`${STAT_NAMES[k] ?? k.toUpperCase()} ${Math.round(v)} / ${max}`}>
    <Glyph k={k} c={crit ? '#ff9a80' : col} s={big ? 9 : 7} />
    <div className="track" style={{ width: w, height: big ? 8 : 6 }}>
      {ghost !== undefined && ghost > frac && <div className="ghost" style={{ width: `${ghost * 100}%` }} />}
      <div className="fill" style={{ width: `${frac * 100}%`, background: `linear-gradient(180deg, rgba(5,7,10,0), rgba(5,7,10,.4) 60%, rgba(5,7,10,.13)), ${col}` }} />
      <div className="seg" />
    </div>
    <span className="num" style={{ fontSize: big ? 9 : 8 }}>{Math.round(v)}</span>
  </div>;
}

/** Left cluster: combat vitals large, survival needs compact but never hidden. */
export function UrgentAlerts({ r, cold }: { r: RunState; cold: boolean }) {
  const p = r.player;
  if (p.dead) return null;
  const alerts: { id: string; glyph: string; label: string; fix: string; col: string }[] = [];
  if (p.hp < 28) alerts.push({ id: 'hp', glyph: 'hp', label: 'LOW HP', fix: 'heal / retreat', col: 'var(--bad)' });
  if (cold) alerts.push({ id: 'cold', glyph: 'wr', label: 'FREEZING', fix: 'fire / shelter', col: '#ff8a66' });
  // warmth already low but the air is not freezing right now: the small warmth number alone was easy to miss
  else if (p.warmth < 20) alerts.push({ id: 'cold', glyph: 'wr', label: 'COLD', fix: 'fire / warm gear', col: '#ff8a66' });
  if (p.thirst < 18) alerts.push({ id: 'h2o', glyph: 'h2o', label: 'DEHYDRATED', fix: 'drink [E / 1-8]', col: 'var(--info)' });
  if (p.hunger < 18) alerts.push({ id: 'fd', glyph: 'fd', label: 'STARVING', fix: 'eat food', col: 'var(--food)' });
  if (p.rad >= 25) alerts.push({ id: 'rad', glyph: 'rad', label: 'RADIATION', fix: 'leave ash / mask', col: '#a8d040' });
  if (!alerts.length) return null;
  return <div className="urgent-rail" data-testid="urgent-alerts" role="status" aria-live="polite">
    {alerts.slice(0, 3).map(a => (
      <div key={a.id} className="plate urgent-chip fadein" style={{ borderColor: a.col }}>
        <span className="lamp diamond pulse" style={{ color: a.col }} />
        <Glyph k={a.glyph} c={a.col} s={7} />
        <b style={{ color: a.col }}>{a.label}</b>
        <span>{a.fix}</span>
      </div>
    ))}
  </div>;
}

/** `slim`: health and stamina only, so the plate ends above a panel that opens at the top of the stage. */
/** The open world has one technical zone name ("VEYRA · U=0.5"); players see the name of the land. */
export const displayZone = (name: string | undefined): string => !name ? '' : /^VEYRA · /.test(name) ? 'Veyra' : name;

export function Vitals({ r, now, slim = false }: { r: RunState; now: number; slim?: boolean }) {
  const p = r.player;
  const hpGhost = useRef(1); const [ghost, setGhost] = useState(1);
  useEffect(() => {
    const f = p.hp / BAL.player.maxHp;
    if (f < hpGhost.current) { setGhost(hpGhost.current); const t = setTimeout(() => { hpGhost.current = f; setGhost(f); }, 420); return () => clearTimeout(t); }
    hpGhost.current = f; setGhost(f);
  }, [p.hp]);
  const zone = displayZone((getWorld().zoneNames || ZONES)[getWorld().zone[Math.floor(p.y / 16) * WW + Math.floor(p.x / 16)]]);
  const surf = SPEED_KEY[effTile(r, Math.floor(p.x / 16), Math.floor(p.y / 16))] || '';
  const w = invWeight(r), lim = carryLimit(r); const over = w > lim;
  void now;
  return <div className="plate" style={{ padding: '4px 5px 3px', width: 116 }}>
    <Gauge k="hp" v={p.hp} max={BAL.player.maxHp} col="var(--hp)" w={74} big ghost={ghost} />
    <div style={{ height: 2 }} />
    <Gauge k="st" v={p.stamina} max={BAL.player.maxStamina} col="var(--stam)" w={74} />
    {!slim && <><div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
      <MiniStat k="fd" v={p.hunger} col="var(--food)" />
      <MiniStat k="h2o" v={p.thirst} col="var(--water)" />
      <MiniStat k="wr" v={p.warmth} col="var(--warm)" />
    </div>
    {p.rad > 1 && <div style={{ marginTop: 2 }}><Gauge k="rad" v={p.rad} max={100} col="#a8d040" w={74} /></div>}
    <div className="rule" style={{ margin: '3px 0 2px' }} />
    <div className="lbl" style={{ fontSize: 8, display: 'flex', alignItems: 'center', gap: 3, color: p.sheltered ? 'var(--good)' : 'var(--muted)' }}>
      {p.sheltered && <Glyph k="home" c="var(--good)" s={7} />}
      <span title={p.sheltered ? undefined : zone} style={{ overflow: 'hidden', overflowWrap: 'anywhere', lineHeight: '9px' }}>{p.sheltered ? 'Sheltered' : zone}</span>
      {surf && <span style={{ color: '#63737c', marginLeft: 'auto' }}>{surf}</span>}
    </div>
    {over && <div className="lbl" style={{ fontSize: 8, color: 'var(--warn)', display: 'flex', gap: 3, alignItems: 'center' }}>
      <Glyph k="weight" c="var(--warn)" s={7} />Overloaded {w.toFixed(0)}/{lim}kg · slowed
    </div>}</>}
  </div>;
}
function MiniStat({ k, v, col }: { k: string; v: number; col: string }) {
  const crit = v < 25;
  return <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }} title={`${STAT_NAMES[k] ?? k} ${Math.round(v)} / 100`}>
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
export function WorldClock({ r, now, secured, slim = false }: { r: RunState; now: number; secured: number; slim?: boolean }) {
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
    {!slim && <><div className="rule" style={{ margin: '3px 0 2px' }} />
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
    </div></>}
  </div>;
}

// ---------------------------------------------------------------------------
// hotbar + held-item card: what it is, what it does, what it costs to use
// ---------------------------------------------------------------------------
export function Hotbar({ r, onPick, onUse, onOpenPack }: { r: RunState; onPick: (i: number) => void; onUse: (i: number) => void; onOpenPack?: () => void }) {
  const p = r.player; const s = activeStack(r);
  const packUsed = C(r, 'inv').slots.filter(Boolean).length;
  const packCap = C(r, 'inv').slots.length;
  return <div className="plate hotbar" style={{ alignItems: 'center' }} data-testid="hud-hotbar">
    <div className="hotbar__slots">
      {C(r, 'inv').slots.slice(0, 8).map((sl, i) => <Slot key={i} slotIndex={i} s={sl} active={i === p.active} hotkey={String(i + 1)} onClick={() => onPick(i)} onContext={() => onUse(i)} />)}
    </div>
    <div className="hotbar__divider" />
    <div className="hotbar__info">
      <HeldInfo s={s} r={r} />
    </div>
    {onOpenPack && <button className="btn ghost sm hotbar__packbtn" title={`Open Pack & Crafting [I] (${packUsed}/${packCap} slots)`} onClick={onOpenPack}>
      <span className="key" style={{ marginRight: 2 }}>I</span>{packUsed}/{packCap}
    </button>}
  </div>;
}
function HeldInfo({ s, r }: { s: Stack | null; r: RunState }) {
  if (!s) return <><div className="lbl" style={{ fontSize: 9, color: 'var(--paper)' }}>Bare hands</div><div className="lbl" style={{ fontSize: 8, color: 'var(--muted)' }}>LMB swing · E interact</div></>;
  const d = ITEMS[s.key];
  const core = d.creatorCore;
  return <>
    <div className="lbl" style={{ fontSize: 9, color: 'var(--brassLit)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {d.name}{s.qty > 1 ? ` ×${s.qty}` : ''}
    </div>
    {core ? (() => { const v = coreReadout(s, Date.now()); const col = ['var(--paper)', 'var(--info)', 'var(--brassLit)'];
      return <div className="core-readout" role="group" data-testid="core-readout" aria-label={`Creator Core level ${v.lvl}, durability ${v.dur} of ${v.maxDur}`}>
        <span title={`Level ${v.lvl} of 3`} style={{ color: 'var(--brassLit)' }}><b data-notr>Lv</b><strong>{v.lvl}</strong></span>
        {v.modes.map((m, i) => { const ammo = coreAmmo(m.mode, d.essence); const n = Math.min(...ammo.map(([k, q]) => Math.floor(countItem(r, 'inv', k) / q)));
          return <span key={m.key} className={!m.unlocked || n === 0 ? 'empty' : ''} style={{ color: m.unlocked ? col[i] : 'var(--muted)' }}
            title={m.unlocked ? `${m.key}: ${ammo.map(([k, q]) => `${q} ${ITEMS[k]?.name ?? k}`).join(' + ')} per cast · ${n} casts in pack${m.cdLeftMs ? ` · ready in ${(m.cdLeftMs / 1000).toFixed(1)}s` : ''}` : `${m.key} unlocks at Lv${m.needLvl}`}>
            <b data-notr>{m.key}</b><strong>{!m.unlocked ? `Lv${m.needLvl}` : m.cdLeftMs > 0 ? `${Math.ceil(m.cdLeftMs / 1000)}s` : n}</strong></span>; })}
        <span title={`Durability ${v.dur}/${v.maxDur}`} style={{ color: v.dur <= 0 ? 'var(--bad)' : v.dur < 75 ? 'var(--warn)' : 'var(--good)' }}><b data-notr>Dur</b><strong>{v.dur}</strong></span>
      </div>; })()
      : d.core ? <div className="lbl" style={{ fontSize: 8, color: s.charge ? 'var(--info)' : 'var(--bad)' }}>FIELD CORE · {s.charge}/{d.charge}⚡ · LMB cast</div>
        : d.food ? <div className="lbl" style={{ fontSize: 8, color: 'var(--good)' }}>LMB / RMB consume</div>
          : d.slot ? <div className="lbl" style={{ fontSize: 8, color: 'var(--info)' }}>RMB equip ({d.slot})</div>
            : d.dmg ? <div className="lbl" style={{ fontSize: 8, color: s.dur === 0 ? 'var(--bad)' : 'var(--muted)' }}>dmg {d.dmg}{d.power ? ' · tool' : ''}{s.dur !== undefined && d.dur ? ` · ${s.dur === 0 ? 'BROKEN' : `${Math.round((s.dur / d.dur) * 100)}%`}` : ''}</div>
              : d.place ? <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)' }}>LMB place</div>
                : <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)' }}>{itemClassLabel(s.key, d.cat).toLowerCase()}</div>}
    {core && (s.dur ?? 300) <= 0 && <div className="lbl" style={{ fontSize: 8, color: 'var(--bad)' }}>WORN OUT · repair at your Workbench</div>}
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
type PresentationTab = 'display' | 'controls' | 'sound' | 'look';
export function PresentationPanel() {
  const p = useVisualPrefs();
  const lang = React.useSyncExternalStore(subscribeLang, getLang, getLang);
  const fs = useFullscreen();
  // Three short pages instead of one 555px column in a 306px box: every control is at most one click away
  // and nothing sits below a fold that the panel gave no hint of.
  const [tab, setTab] = useState<PresentationTab>('display');
  // Plain render helpers, not inner components: an inner component is a new type on every render, which remounts
  // the slider under the pointer while it is being dragged.
  const row = (label: string, k: keyof typeof p, max = 1, min = 0, step = 0.05) =>
    <label key={String(k)} className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, marginTop: 4 }}>
      <span style={{ width: 62, flex: 'none', color: 'var(--muted)' }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={p[k] as number} aria-label={label} onChange={e => setPrefs({ [k]: +e.target.value } as any)} style={{ flex: 1, minWidth: 0, width: 0 }} />
      <span style={{ width: 22, flex: 'none', textAlign: 'right' }}>{Math.round((p[k] as number) * 100)}</span>
    </label>;
  const group = (label: string, children: React.ReactNode) => <>
    <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)', margin: '5px 0 2px' }}>{label}</div>
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>{children}</div>
  </>;
  return <div>
    <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 4 }} data-notr role="group" aria-label="Language / Ngôn ngữ">
      <span className="lbl" style={{ fontSize: 9, color: 'var(--muted)', flex: 1, whiteSpace: 'nowrap' }}>Language</span>
      <button className={`btn sm ${lang === 'en' ? 'gold' : ''}`} aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
      <button className={`btn sm ${lang === 'vi' ? 'gold' : ''}`} aria-pressed={lang === 'vi'} onClick={() => setLang('vi')}>Tiếng Việt</button>
    </div>
    <div role="tablist" aria-label="Presentation settings" style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
      {([['display', 'Display'], ['controls', 'Controls'], ['sound', 'Sound'], ['look', 'Look']] as const).map(([id, lbl]) =>
        <button key={id} role="tab" aria-selected={tab === id} className={`btn sm ${tab === id ? 'gold' : ''}`} style={{ flex: 1 }} onClick={() => setTab(id)}>{lbl}</button>)}
    </div>
    {tab === 'controls' && <div role="tabpanel">
      {group('Inventory layout', <>
        {([['auto', 'Auto'], ['pc', 'PC · 2 columns'], ['mobile', 'Mobile · 2 tabs']] as const).map(([id, lbl]) => (
          <button key={id} className={`btn sm ${(p.uiLayout ?? 'auto') === id ? 'gold' : ''}`} aria-pressed={(p.uiLayout ?? 'auto') === id} onClick={() => setPrefs({ uiLayout: id })}>{lbl}</button>
        ))}
      </>)}
      {group('Touch controls', <>
        {([['auto', 'Auto'], ['on', 'Always'], ['off', 'Never']] as const).map(([id, lbl]) => (
          <button key={id} className={`btn sm ${(p.touchControls ?? 'auto') === id ? 'gold' : ''}`} aria-pressed={(p.touchControls ?? 'auto') === id} onClick={() => setPrefs({ touchControls: id })}>{lbl}</button>
        ))}
      </>)}
      <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)', marginTop: 3, lineHeight: '9px' }}>Touch: drag on the left to walk. Hit, Use and Roll are on the right. Tap the world to swing there.</div>
      <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)', marginTop: 5, lineHeight: '9px' }}>Keyboard: WASD move · E use · Space roll · I pack · C craft · B build · M map · J journey · N notes · Tab skills · Esc menu</div>
    </div>}
    {tab === 'display' && <div role="tabpanel">
      {group('Screen scale', <>
        {([['fit', 'Fit window'], ['integer', 'Whole pixels (1×, 2×, 3×)']] as const).map(([id, lbl]) => (
          <button key={id} className={`btn sm ${(p.stageScale ?? 'fit') === id ? 'gold' : ''}`} aria-pressed={(p.stageScale ?? 'fit') === id} onClick={() => setPrefs({ stageScale: id })}>{lbl}</button>
        ))}
      </>)}
      <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)', marginTop: 2, lineHeight: '9px' }}>Whole pixels is sharper but can leave a border; in a small window it makes everything smaller.</div>
      {fullscreenSupported() && <div style={{ marginTop: 4 }}><button className={`btn sm ${fs ? 'gold' : ''}`} aria-pressed={fs} onClick={() => { void toggleFullscreen(); }}>{fs ? 'Leave full screen' : 'Full screen'}</button></div>}
      {group('HUD size', <>
        {([['auto', 'Auto'], [1, '100%'], [1.25, '125%'], [1.5, '150%']] as const).map(([id, lbl]) => (
          <button key={String(id)} className={`btn sm ${(p.hudScale ?? 'auto') === id ? 'gold' : ''}`} aria-pressed={(p.hudScale ?? 'auto') === id} onClick={() => setPrefs({ hudScale: id })}>{lbl}</button>
        ))}
      </>)}
      {group('Comfort', <>
        <button className={`btn sm ${p.reduceFlash ? 'gold' : ''}`} aria-pressed={p.reduceFlash} onClick={() => setPrefs({ reduceFlash: !p.reduceFlash })}>Reduce flashes {p.reduceFlash ? 'ON' : 'OFF'}</button>
        <button className={`btn sm ${p.highContrastHud ? 'gold' : ''}`} aria-pressed={p.highContrastHud} onClick={() => setPrefs({ highContrastHud: !p.highContrastHud })}>Solid HUD {p.highContrastHud ? 'ON' : 'OFF'}</button>
      </>)}
    </div>}
    {tab === 'sound' && <div role="tabpanel">
      {row('Music', 'music')}{row('Ambience', 'ambience')}{row('World', 'world')}{row('Combat', 'combat')}{row('Interface', 'ui')}
      <div style={{ marginTop: 6 }}>
        <button className={`btn sm ${p.muted ? 'danger' : ''}`} aria-pressed={p.muted} onClick={() => setPrefs({ muted: !p.muted })}>{p.muted ? 'UNMUTE ALL' : 'MUTE ALL'}</button>
      </div>
    </div>}
    {tab === 'look' && <div role="tabpanel">
      <div className="console-h">Art direction</div>
      {(Object.keys(DIRECTIONS) as DirectionId[]).map(id => {
        const d = DIRECTIONS[id];
        return <div key={id} className={`dirbtn ${p.direction === id ? 'on' : ''}`} style={{ marginBottom: 3 }} onClick={() => setPrefs({ direction: id })} role="button" tabIndex={0} aria-pressed={p.direction === id}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setPrefs({ direction: id }); }}>
          <div className="lbl" style={{ fontSize: 10, color: p.direction === id ? 'var(--brassLit)' : 'var(--paper)' }}>{d.name}{id === DEFAULT_DIRECTION && <span className="chip" style={{ color: 'var(--good)', marginLeft: 5 }}>DEFAULT</span>}</div>
          <div className="lbl" style={{ fontSize: 8, color: 'var(--muted)' }}>{d.tagline}</div>
        </div>;
      })}
      {row('Colour grade', 'grade', 1.5)}
      {row('Screen shake', 'shake')}
    </div>}
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
