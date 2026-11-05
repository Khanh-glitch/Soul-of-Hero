/**
 * GameRoot-equivalent for the large-world pilot. Native 640×360, integer pixel
 * scale, ORIGINAL SOH art (getArt + patched render.ts), ORIGINAL key bindings
 * and HUD layout, original player speed (BAL.player.speed) and day/night rate.
 * F3 toggles the developer HUD; it is OFF by default.
 */
import { useEffect, useRef, useState, useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import { TILE, VIEW_W, VIEW_H, BAL } from '../game/core';
import { draw, consumeFX, cam, resetRenderCaches, renderCacheStats } from '../game/render';
import { getArt } from '../game/art';
import { ITEM_DEFS } from '../game/large/compat';
import { dayTime, weatherAt, weatherSlot, phaseOf, runHours } from '../game/large/compat';
import { SCENES, SOURCE } from '../game/large/profile';
import { LargeWorldRuntime, type LwInput } from '../game/large/runtime';
import { runNegativeFixtures, runDurableNegativeFixtures, validateChunkPackage } from '../game/large/validate';
import { DurableStore } from '../game/large/state';

const WICON: Record<string, string> = { clear: '☀', cloudy: '☁', rain: '☂', storm: '⚡', fog: '≋' };
function Bar({ v, max, col, w }: { v: number; max: number; col: string; w: number }) {
  return <div className="bar" style={{ width: w }}><i style={{ width: `${Math.max(0, Math.min(100, v / max * 100))}%`, background: col }} /></div>;
}
export default function GameLarge({ runtime, onExit }: { runtime: LargeWorldRuntime; onExit: () => void }) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const inp = useRef<LwInput>({ up: false, down: false, left: false, right: false, roll: false, mx: 0, my: 0 });
  const mouse = useRef({ x: 320, y: 180 });
  const [, setFrame] = useState(0); const rerender = useCallback(() => setFrame(f => f + 1), []);
  const [scale, setScale] = useState(1); const [off, setOff] = useState({ x: 0, y: 0 });
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<{ t: number; msg: string } | null>(null);
  const [hud, setHud] = useState(runtime.devHud);
  const hudRef = useRef(hud); hudRef.current = hud;
  const scaleRef = useRef(scale); scaleRef.current = scale;
  const offRef = useRef(off); offRef.current = off;
  const say = (msg: string) => setToast({ t: Date.now(), msg });

  useEffect(() => {
    const fit = () => { const W = innerWidth, H = innerHeight; let k = Math.floor(Math.min(W / VIEW_W, H / VIEW_H)); if (k < 1) k = Math.min(W / VIEW_W, H / VIEW_H); setScale(k); setOff({ x: Math.floor((W - VIEW_W * k) / 2), y: Math.floor((H - VIEW_H * k) / 2) }); };
    fit(); addEventListener('resize', fit); return () => removeEventListener('resize', fit);
  }, []);

  // ---- ORIGINAL GameRoot key map, with F3 dev HUD / F9 save added ----
  useEffect(() => {
    const keyMap: Record<string, keyof LwInput> = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.matches('input, textarea, select')) return;
      if (keyMap[e.code]) { (inp.current as any)[keyMap[e.code]] = true; e.preventDefault(); return; }
      if (e.repeat) return;
      switch (e.code) {
        case 'F3': e.preventDefault(); setHud(v => { runtime.devHud = !v; return !v; }); break;
        case 'F9': { e.preventDefault(); const r = runtime.writeSave(); say(`Saved ${r.bytes} B · legacy 200×200 save ${Object.keys(r.legacy || {}).length ? 'PRESERVED (read-only)' : 'absent'}`); break; }
        case 'Escape': setMenu(v => !v); break;
        case 'KeyH': { const n = runtime.nearestSource(); if (!n) { say('No authored source in this chunk.'); break; }
          const r: any = runtime.harvestAt(n.x, n.y); say(r.ok ? `Harvested ${n.id} · receipt ${r.receipt}` : `${r.reason} · ${n.id}`); break; }
        case 'KeyJ': { const t = runtime.inspect().player.tile; const r: any = runtime.placeAt(t.x + 1, t.y, `claim:${t.x + 1},${t.y}`); say(r.ok ? `Placed ${r.id || `claim:${t.x + 1},${t.y}`} · receipt ${r.receipt}` : r.reason); break; }
        default: if (/^Digit[1-8]$/.test(e.code)) { runtime.run.player.active = +e.code.slice(5) - 1; rerender(); }
      }
    };
    const up = (e: KeyboardEvent) => { if (keyMap[e.code]) (inp.current as any)[keyMap[e.code]] = false; };
    const blur = () => { const i = inp.current; i.up = i.down = i.left = i.right = false; };
    const vis = () => { if (document.hidden) runtime.writeSave(); };
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', blur); document.addEventListener('visibilitychange', vis);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur); document.removeEventListener('visibilitychange', vis); };
  }, [runtime]);

  // ---- main loop: real input -> chunked runtime -> ORIGINAL SOH renderer ----
  useEffect(() => {
    const cv = cvRef.current, g = cv?.getContext('2d'); if (!cv || !g) return;
    g.imageSmoothingEnabled = false; getArt();
    let last = performance.now(), raf = 0, uiAcc = 0, saveAcc = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(50, t - last); last = t; const now = Date.now();
      const i = inp.current; i.mx = mouse.current.x + Math.round(cam.x); i.my = mouse.current.y + Math.round(cam.y);
      const t0 = performance.now();
      runtime.advance(dt, i, now);
      draw(g, runtime.gs, now, dt, { buildType: null, reclaim: false, mouseX: i.mx, mouseY: i.my, target: null, time: t });
      const rc = renderCacheStats(); runtime.setRenderCache(rc.chunks, rc.bytes);
      runtime.recordFrame(dt, performance.now() - t0);
      consumeFX(() => {});
      i.roll = false;
      uiAcc += dt; if (uiAcc > 120) { uiAcc = 0; rerender(); }
      saveAcc += dt; if (saveAcc > 5000) { saveAcc = 0; runtime.writeSave(); }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [runtime]);

  // QA hook: inspection only. setPos is explicitly labelled fast scene selection.
  (window as any).__lw = (window as any).__lw || {};
  Object.assign((window as any).__lw, {
    runtime, gs: runtime.gs, run: runtime.run, cam,
    input: inp.current,
    hud: () => hudRef.current,
    setHud: (v: boolean) => { runtime.devHud = v; setHud(v); },
    setPos: (tx: number, ty: number) => {
      runtime.run.player.x = tx * TILE + 8; runtime.run.player.y = ty * TILE + 8;
      runtime.chunks.updateWindow(tx, ty);
      return { note: 'QA fast scene selection; NOT a walked journey' };
    },
    negatives: () => ({ geometry: runNegativeFixtures(runtime.p), durable: runDurableNegativeFixtures(new DurableStore(runtime.p, 0x51f15)),
      chunkPackages: runtime.chunks.keys().map(k => { const c = [...runtime.chunks.chunks.values()].find(x => x.key === k)!; return { key: k, errors: validateChunkPackage(runtime.p, c) }; }) }),
    screenshotMeta: () => ({ profile: runtime.p.id, U: runtime.p.U, w: runtime.p.w, h: runtime.p.h,
      scene: runtime.run.sceneId, hours: runtime.run.hours, dayTime: dayTime(runtime.run, Date.now()),
      weather: weatherAt(runtime.run, Date.now()), playerTile: runtime.inspect().player.tile }),
  });

  const r = runtime.run, p = r.player, now = Date.now();
  const dtm = dayTime(r, now), clock = `${String(Math.floor(dtm * 24)).padStart(2, '0')}:${String(Math.floor((dtm * 24 % 1) * 60)).padStart(2, '0')}`;
  const w = weatherAt(r, now); const slot = Math.floor((now - r.startedAt + r.qaOffset) / (BAL.weather.slotMinutes * 60000));
  const ph = phaseOf(r, now); const hrs = runHours(r, now); const day = Math.floor(hrs / 24) + 1;
  const ins = runtime.inspect(); const m = runtime.metrics;
  const poi = ins.tile?.poiId || null;
  const scene = SCENES.find(s => s.id === r.sceneId);
  const inv = runtime.durable.inv();
  const onMove = (e: ReactMouseEvent) => { const s = scaleRef.current; mouse.current = { x: (e.clientX - offRef.current.x) / s, y: (e.clientY - offRef.current.y) / s }; };

  return <div style={{ position: 'fixed', inset: 0, cursor: 'crosshair' }} onMouseMove={onMove}>
    <div className="stage" style={{ transform: `translate(${off.x}px, ${off.y}px) scale(${scale})` }}>
      <canvas ref={cvRef} width={VIEW_W} height={VIEW_H} style={{ width: VIEW_W, height: VIEW_H }} />
      {/* ---- ORIGINAL SOH top-left vitals ---- */}
      <div className="panel absolute" style={{ left: 4, top: 4, padding: '3px 5px', fontSize: 10, lineHeight: 1 }}>
        {([['HP', p.hp, BAL.player.maxHp, '#e0483a'], ['ST', p.stamina, BAL.player.maxStamina, '#d8d050'], ['FD', p.hunger, 100, '#e09040'], ['H₂O', p.thirst, 100, '#4aa0e0'], ['WRM', p.warmth, 100, '#f0b0a0']] as const).map(([l, v, mx, c]) =>
          <div key={l} className="flex items-center gap-1" style={{ marginBottom: 2 }}><span style={{ width: 18, color: '#b8a8c8' }}>{l}</span><Bar v={v} max={mx} col={c} w={l === 'HP' ? 74 : 58} /><span style={{ width: 16, textAlign: 'right', color: '#e8dcc8' }}>{Math.round(v)}</span></div>)}
        <div style={{ color: '#8a7a9a', marginTop: 1, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{poi ? `POI ${poi}` : (ins.tile?.biome || 'sea')}</div>
      </div>
      {/* ---- ORIGINAL SOH top-right clock ---- */}
      <div className="panel absolute" style={{ right: 4, top: 4, padding: '3px 6px', fontSize: 10, lineHeight: 1.05, textAlign: 'right', minWidth: 124 }}>
        <div><span className="tag" style={{ color: ph === 'calm' ? '#9ae0a0' : '#ff9a5a' }}>{ph.toUpperCase()}</span> <span style={{ color: '#ffd98a' }}>Day {day}/14</span></div>
        <div style={{ color: '#cfc2dc' }}>run {Math.floor(hrs)}h{String(Math.floor((hrs % 1) * 60)).padStart(2, '0')}m <span style={{ color: '#7a6a8a' }}>{r.qaUsed ? 'QA·' : ''}LOCAL</span></div>
        <div>{dtm > 0.25 && dtm < 0.75 ? '☼' : '☾'} {clock} · {WICON[w]} {w} <span style={{ color: '#7a6a8a' }}>→ {WICON[weatherSlot(r.seed, slot + 1)]}</span></div>
        <div style={{ color: '#9ae0ff' }}>U={runtime.p.U} · {runtime.p.w}×{runtime.p.h}</div>
      </div>
      {/* ---- POI / landmark identity + honest missing object ---- */}
      <div className="absolute" style={{ left: '50%', transform: 'translateX(-50%)', top: 44, fontSize: 10, color: '#ffe27a', textShadow: '1px 1px 0 #000', pointerEvents: 'none', whiteSpace: 'nowrap', textAlign: 'center' }}>
        {scene ? scene.label : r.sceneId}{poi ? ` · ${poi.replace(/_/g, ' ')}` : ''}<br />
        <span style={{ color: '#cfc2dc', fontSize: 9 }}>source AU {SCENES.find(s => s.id === r.sceneId)?.atAu.join(',')} · tile {ins.player.tile.x},{ins.player.tile.y} · U={runtime.p.U}</span>
      </div>
      {scene?.helicopter && <div className="panel absolute" style={{ right: 4, top: 62, padding: '2px 5px', fontSize: 9, color: '#ffb08a', width: 186, lineHeight: 1.15 }}>
        HELICOPTER OBJECT PROVEN MISSING<br />authored AU [272,652] only<br />owner: Gameplay machines / vehicles
      </div>}
      {/* ---- Developer HUD (toggle F3, OFF by default) ---- */}
      {hud && <div id="lw-dev-hud" className="panel absolute" style={{ left: 4, top: 92, width: 250, padding: 5, fontSize: 9, lineHeight: 1.15, color: '#cfc2dc', maxHeight: 240, overflow: 'hidden' }}>
        <div className="panel-h">LW-01 DEV HUD · F3</div>
        <div>profile <b style={{ color: '#ffe27a' }}>{runtime.p.id}</b> · U={runtime.p.U} · {runtime.p.w}×{runtime.p.h} = {(runtime.p.w * runtime.p.h).toLocaleString()} cells</div>
        <div>source <b>{SOURCE.activeRevision}</b> · map {SOURCE.mapHead.slice(0, 8)} · gp {SOURCE.gameplayHead.slice(0, 8)}</div>
        <div>global tile <b>{ins.player.tile.x},{ins.player.tile.y}</b> · idx {ins.player.globalIndex}</div>
        <div>chunk {ins.player.chunk.x},{ins.player.chunk.y} · local {ins.player.chunk.localX},{ins.player.chunk.localY}</div>
        <div>loaded chunks <b>{ins.chunks.keys.length}</b> · simSet {m.simSetSize} · loads {m.loads} · unloads {m.unloads}</div>
        <div>resident layer <b>{m.residentLayerBytes}</b> B · canvas {m.canvasBytes} B · peak {m.peakResident} chunks</div>
        <div>heap {m.heapUsedBytes ? (m.heapUsedBytes / 1048576).toFixed(1) + ' MB' : 'n/a'} · save {m.saveBytes} B</div>
        <div>frame p50 {m.frameMsP50} ms · p95 {m.frameMsP95} ms · max {m.frameMsMax} ms</div>
        <div>walked {m.walkedPx} px · boundaries {m.chunkBoundariesCrossed} · records {ins.durable.records}</div>
        <div>creatures active {m.tickedCreatures} · distant {m.distantCreatures} · deferred {ins.durable.delayedEvents}</div>
        <div style={{ color: '#ffb08a' }}>NO approved final U · NO production merge</div>
      </div>}
      {/* ---- original quickbar ---- */}
      <div className="panel absolute flex gap-0.5" style={{ left: '50%', transform: 'translateX(-50%)', bottom: 4, padding: 3 }}>
        {Array.from({ length: 8 }, (_, i) => <div key={i} className={`slot ${i === p.active ? 'active' : ''}`} style={{ width: 20, height: 20 }}>
          <span className="k">{i + 1}</span>{inv[i] && <span className="q">{inv[i].qty}</span>}
        </div>)}
        <div style={{ fontSize: 9, width: 150, lineHeight: 1, marginLeft: 3, color: '#cfc2dc', alignSelf: 'center' }}>
          <span style={{ color: '#ffe0a0' }}>{inv[0] ? (ITEM_DEFS as any)[inv[0].key]?.name || inv[0].key : 'Fists'}</span><br />
          {inv.map(x => `${x.key}×${x.qty}`).join(' · ').slice(0, 60)}
        </div>
      </div>
      {/* ---- intro hint / log ---- */}
      {!hud && <div className="absolute" style={{ left: 4, top: 92, width: 164, fontSize: 9, color: '#cfc2dc', lineHeight: 1.15, textShadow: '1px 1px 0 #000', pointerEvents: 'none' }}>
        WASD move · F3 dev HUD · F9 save<br />H harvest · J place · Esc menu<br />Real input, no teleport claims.
      </div>}
      {toast && now - toast.t < 3200 && <div className="absolute" style={{ left: 0, right: 0, bottom: 36, textAlign: 'center', fontSize: 10, pointerEvents: 'none' }}><span style={{ background: '#120c18d8', border: '1px solid #5a4a6a', color: '#ffe0a0', padding: '1px 6px' }}>{toast.msg}</span></div>}
      {menu && <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: '#0a0710e0' }}>
        <div className="title-font" style={{ fontSize: 22, color: '#ffe8b0' }}>Large-world pilot</div>
        <div style={{ fontSize: 10, color: '#cfc2dc', maxWidth: 400, textAlign: 'center', marginTop: 4 }}>Bounded continuous world. WMP-04R1 authority. No marine travel, no helicopter object, no approved final U, no production integration.</div>
        <button className="btn gold" style={{ marginTop: 8 }} onClick={() => { runtime.writeSave(); setMenu(false); }}>Save & resume</button>
        <button className="btn" style={{ marginTop: 4 }} onClick={() => { runtime.writeSave(); resetRenderCaches(); cam.init = false; onExit(); }}>Save & title</button>
      </div>}
    </div>
  </div>;
}
