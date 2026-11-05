import { useEffect, useRef, useState, useCallback } from 'react';
import { BAL, TILE, WW, VIEW_W, VIEW_H, HOUR, type GameState } from '../game/core';
import { ITEMS, STRUCTS, ELDERS, CREATURES, STRUCTURE_UPGRADES } from '../game/catalog';
import { dispatch, phaseOf, runHours, dayTime, weatherAt, weatherSlot, countItem, C, entsAt, cartWeight, cartLimit, effTile, isRagnarok, buildReason, clearWallLine } from '../game/engine';
import { tick, syncWorld, findInteract, activeStack, SPEED_KEY, rayLen, type Input, type Interact } from '../game/sim';
import { draw, consumeFX, cam } from '../game/render';
import { getWorld, ZONES } from '../game/world';
import { sfx, setAmbience, initAudio } from '../game/audio';
import { save, saveSync } from '../game/persist';
import { Slot, Bar, Icon, mkIntent, type Api, type PanelState } from './common';
import { InventoryPanel, ContainerPanel, CraftPanel, BuildPanel, MapPanel, SkillsPanel, MenuPanel, VendorPanel, EscrowPanel, EvacPanel, ReportPanel } from './panels';

export default function Game({ gs, report, onExit, onRunEnd }: { gs: GameState; report: string[] | null; onExit: () => void; onRunEnd: () => void }) {
  const cvRef = useRef<HTMLCanvasElement>(null); const stageRef = useRef<HTMLDivElement>(null);
  const [, setFrame] = useState(0); const rerender = useCallback(() => setFrame(f => f + 1), []);
  const [panel, setPanel] = useState<PanelState | null>(report && report.length ? { kind: 'report', lines: report } : null);
  const [sel, setSel] = useState<{ c: string; slot: number } | null>(null);
  const [buildType, setBuildType] = useState<string | null>(null); const [reclaim, setReclaim] = useState(false); const [repairMode, setRepairMode] = useState(false); const [upgradeMode, setUpgradeMode] = useState(false);
  const [editLayer, setEditLayer] = useState('auto');
  const [toasts, setToasts] = useState<{ id: number; text: string; tone?: string; t: number }[]>([]);
  const [banner, setBanner] = useState<{ text: string; sub?: string; id: number } | null>(null);
  const inp = useRef<Input>({ up: false, down: false, left: false, right: false, mx: 0, my: 0, attack: false, attackPressed: false, roll: false, cancel: false });
  const [coreAim, setCoreAim] = useState<null | { mode: 'refined' | 'signature'; uid: string; code: string }>(null);
  const coreAimRef = useRef(coreAim); coreAimRef.current = coreAim;
  const mouse = useRef({ x: 320, y: 180 }); const target = useRef<Interact | null>(null); const hitstop = useRef(0);
  const panelRef = useRef(panel); panelRef.current = panel; const buildRef = useRef(buildType); buildRef.current = buildType; const reclaimRef = useRef(reclaim); reclaimRef.current = reclaim; const repairRef = useRef(repairMode); repairRef.current = repairMode; const upgradeRef = useRef(upgradeMode); upgradeRef.current = upgradeMode;
  const saveT = useRef<any>(null); const toastKeys = useRef<Record<string, number>>({});
  const scheduleSave = () => { clearTimeout(saveT.current); saveT.current = setTimeout(() => { void save(gs).then(ok => { if (!ok) toast('Save failed. Changes are not confirmed on disk.', 'bad'); }); }, 250); };
  const toast = useCallback((text: string, tone?: string) => { if (!text) return; const k = text; const n = Date.now(); if (toastKeys.current[k] && n - toastKeys.current[k] < 2500) return; toastKeys.current[k] = n; setToasts(t => [...t.slice(-3), { id: n + Math.random(), text, tone, t: n }]); }, []);
  const act = useCallback((type: string, payload: Record<string, any> = {}) => {
    const now = Date.now();
    // An input arriving before a frame must not precede elapsed world events.
    const ready = syncWorld(gs, now);
    const res = ready ? dispatch(gs, mkIntent(type, payload), now) : { ok: false as const, reason: gs.run ? 'The device clock moved backwards.' : 'No active run.' };
    if (res.ok) {
      const openPanel = panelRef.current;
      if (openPanel?.kind === 'container' && openPanel.eid && !gs.run?.entities[openPanel.eid]) { setPanel(null); setSel(null); }
      scheduleSave(); if (res.msg) toast(res.msg, 'ok'); sfx({ type: type === 'build' ? 'build' : type === 'craft' ? 'craft' : type === 'deposit' || type === 'buy' ? 'coin' : 'ui' });
    }
    else if (!(res as any).dup) { toast((res as any).reason, 'bad'); sfx({ type: 'deny' }); }
    rerender(); return res;
  }, [gs]);
  const api: Api = { gs, now: () => Date.now(), act, toast, open: (p) => { setPanel(p); setSel(null); }, panel, sel, setSel, setBuild: setBuildType, buildType, reclaim, setReclaim, repairMode, setRepairMode, setUpgradeMode, sfx: (t) => sfx({ type: t }), rerender };

  // scale stage to integer multiples (crisp pixels)
  const [scale, setScale] = useState(1); const [off, setOff] = useState({ x: 0, y: 0 });
  useEffect(() => { const fit = () => { const W = window.innerWidth, H = window.innerHeight; let s = Math.floor(Math.min(W / VIEW_W, H / VIEW_H)); if (s < 1) s = Math.min(W / VIEW_W, H / VIEW_H); setScale(s); setOff({ x: Math.floor((W - VIEW_W * s) / 2), y: Math.floor((H - VIEW_H * s) / 2) }); }; fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit); }, []);
  const scaleRef = useRef(scale); scaleRef.current = scale; const offRef = useRef(off); offRef.current = off;

  const interact = () => {
    const r = gs.run; if (!r) return; const t = target.current; if (!t) return;
    const e = t.eid ? r.entities[t.eid] : null;
    switch (t.kind) {
      case 'fire': act('douseTree', { tx: Math.floor(t.x/16), ty: Math.floor(t.y/16) }); return;
      case 'water': act('drink', { x: t.x, y: t.y }); sfx({ type: 'eat' }); return;
      case 'recycler': case 'bag': case 'loot': case 'cart': setPanel({ kind: 'container', eid: t.eid }); sfx({ type: 'ui' }); return;
      case 'cash': { const res = act('openCash', { eid: t.eid }); if (res.ok) { setPanel({ kind: 'container', eid: t.eid }); sfx({ type: 'coin' }); } return; }
      case 'vendor': setPanel({ kind: 'vendor', eid: t.eid }); return;
      case 'door': act('door', { eid: t.eid }); return;
      case 'gen': act('generator', { eid: t.eid }); return;
      case 'evac': setPanel({ kind: 'evac', eid: t.eid }); return;
    }
    if (e && e.kind === 'struct') {
      const d = STRUCTS[e.type!];
      if (e.type!.startsWith('door')) act('door', { eid: e.id });
      else if (e.type === 'escrow') setPanel({ kind: 'escrow', eid: e.id });
      else if (e.type === 'garden') setPanel({ kind: 'container', eid: e.id });
      else if (e.type === 'barrel') act('barrel', { eid: e.id });
      else if (d.station || d.slots) setPanel({ kind: 'container', eid: e.id });
    }
  };

  // input
  useEffect(() => {
    const keyMap: Record<string, keyof Input> = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
    const toggle = (k: PanelState['kind']) => { coreAimRef.current=null; setCoreAim(null); inp.current.skill=undefined; inp.current.cancel=true; setPanel(p => (p?.kind === k ? null : { kind: k })); setSel(null); sfx({ type: 'ui' }); };
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && (e.target.matches('input, textarea, select') || e.target.isContentEditable)) { if (e.code === 'Escape') e.target.blur(); return; }
      initAudio(); const r = gs.run; if (!r) return;
      if (keyMap[e.code]) { (inp.current as any)[keyMap[e.code]] = true; e.preventDefault(); return; }
      if (e.code === 'Tab') { e.preventDefault(); toggle('skills'); return; }
      if (e.repeat) return;
      switch (e.code) {
        case 'Space': inp.current.roll = true; e.preventDefault(); break;
        case 'KeyQ': case 'KeyE': {
          const s=activeStack(r);
          if(s && ITEMS[s.key]?.creatorCore && !coreAimRef.current && !panelRef.current && !r.player.dead && !r.player.action){const aim={mode:e.code==='KeyQ'?'refined' as const:'signature' as const,uid:s.uid,code:e.code};coreAimRef.current=aim;setCoreAim(aim);e.preventDefault();}
          else if(e.code==='KeyE' && !ITEMS[s?.key||'']?.creatorCore && !panelRef.current) interact();
          break;
        }
        case 'KeyF': { if(e.shiftKey || r.player.pulling){const c = Object.values(r.entities).find(x => x.kind === 'cart' && Math.hypot(x.x-r.player.x,x.y-r.player.y)<34); if(c) act('grabCart',{eid:c.id}); else if(r.player.pulling) act('grabCart',{eid:r.player.pulling}); else toast('No cart within reach.');} else if(target.current) interact(); else {const c=Object.values(r.entities).find(x=>x.kind==='cart' && Math.hypot(x.x-r.player.x,x.y-r.player.y)<34);if(c)act('grabCart',{eid:c.id});} break; }
        case 'KeyI': toggle('inv'); break; case 'KeyC': toggle('craft'); break; case 'KeyM': toggle('map'); break;
        case 'KeyB': setUpgradeMode(false); setBuildType(null); setReclaim(false); setRepairMode(false); toggle('build'); break;
        case 'KeyG': setEditLayer(v => { const a=['auto','wall','obj','roof','floor']; return a[(a.indexOf(v)+1)%a.length]; }); break;
        case 'KeyU': setPanel(null); setUpgradeMode(v => !v); setBuildType(null); setReclaim(false); setRepairMode(false); break;
        case 'KeyX': setPanel(null); setUpgradeMode(false); setReclaim(v => !v); setBuildType(null); setRepairMode(false); break;
        case 'KeyV': setPanel(null); setUpgradeMode(false); setRepairMode(v => !v); setBuildType(null); setReclaim(false); break;
        case 'KeyR': { const selected=activeStack(r); if(selected && ITEMS[selected.key]?.creatorCore && !panelRef.current){act('loadCore',{slot:r.player.active,uid:selected.uid,mode:e.altKey?'signature':e.shiftKey?'refined':'basic'});break;} const t = Object.values(r.entities).find(x => x.type === 'research' && Math.hypot(x.x - r.player.x, x.y - r.player.y) < 3 * TILE && clearWallLine(r, r.player, x)); if (t) setPanel({ kind: 'container', eid: t.id }); else toast('Research needs a Research Table within reach (build one on your claim).'); break; }
        case 'Escape': if(coreAimRef.current || (r.player.action?.kind==='cast' && !r.player.action.done)){coreAimRef.current=null;setCoreAim(null);inp.current.skill=undefined;inp.current.cancel=true;break;} if (buildRef.current || reclaimRef.current || repairRef.current || upgradeRef.current) { setUpgradeMode(false); setBuildType(null); setReclaim(false); setRepairMode(false); } else if (panelRef.current) setPanel(null); else setPanel({ kind: 'menu' }); setSel(null); break;
        default: if (/^Digit[1-8]$/.test(e.code)) { r.player.active = +e.code.slice(5) - 1; rerender(); }
      }
    };
    const up = (e: KeyboardEvent) => { if (keyMap[e.code]) (inp.current as any)[keyMap[e.code]] = false; const a=coreAimRef.current;if(a && a.code===e.code){coreAimRef.current=null;setCoreAim(null);const selected=gs.run && activeStack(gs.run);if(!panelRef.current && selected?.uid===a.uid && gs.run && !gs.run.player.dead){const vx=Math.round(cam.x),vy=Math.round(cam.y);inp.current.skill=a.mode;inp.current.skillAim={uid:a.uid,slot:gs.run.player.active,mx:mouse.current.x+vx,my:mouse.current.y+vy,viewX:vx,viewY:vy};}} };
    const blur = () => { const i = inp.current; i.up = i.down = i.left = i.right = i.attack = false; i.skill=undefined;i.cancel=true;coreAimRef.current=null;setCoreAim(null); };
    const wheel = (e: WheelEvent) => { const r = gs.run; if (!r || panelRef.current) return; r.player.active = (r.player.active + (e.deltaY > 0 ? 1 : 7)) % 8; rerender(); };
    const vis = () => { if (document.hidden) { saveSync(gs); save(gs); blur(); } };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur); window.addEventListener('wheel', wheel, { passive: true }); document.addEventListener('visibilitychange', vis); window.addEventListener('beforeunload', vis as any);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); window.removeEventListener('wheel', wheel); document.removeEventListener('visibilitychange', vis); window.removeEventListener('beforeunload', vis as any); };
  }, [gs]);

  // Never resume an uncommitted Creator cast after a saved/reopened UI.
  useEffect(() => { const a=gs.run?.player.action; if(a?.kind==='cast' && a.coreUid && !a.done) gs.run!.player.action=null; }, [gs]);
  useEffect(() => { if(panel){coreAimRef.current=null;setCoreAim(null);inp.current.skill=undefined;inp.current.cancel=true;inp.current.attack=false;} }, [panel]);

  // main loop
  useEffect(() => {
    const cv = cvRef.current; const g = cv?.getContext('2d'); if (!cv || !g) return; g.imageSmoothingEnabled = false;
    let last = performance.now(); let raf = 0; let uiAcc = 0, saveAcc = 0, ambAcc = 0; let ended = false;
    const loop = (t: number) => {
      // Cap animation/input physics only; tick catches up autonomous wall time from lastSimAt.
      raf = requestAnimationFrame(loop); const dt = Math.min(50, t - last); last = t; const now = Date.now();
      if (!gs.run) { if (!ended) { ended = true; save(gs); onRunEnd(); } return; }
      const i = inp.current; i.mx = mouse.current.x + Math.round(cam.x); i.my = mouse.current.y + Math.round(cam.y); i.viewX=Math.round(cam.x); i.viewY=Math.round(cam.y);
      let simDt = dt; if (hitstop.current > 0) { hitstop.current -= dt; simDt = dt * 0.08; }
      const wasDead = gs.run.player.dead;
      tick(gs, i, simDt, now); i.attackPressed = false; i.roll = false; i.cancel = false; i.skill=undefined; i.skillAim=undefined;
      if (!gs.run) return;
      // Death transfers the entire pack to a physical bag. Persist that custody
      // transition immediately instead of leaving a five-second rollback window.
      if (!wasDead && gs.run.player.dead) {
        if (!saveSync(gs)) toast('Death save failed. Your changes are not confirmed on disk.', 'bad');
        void save(gs).then(ok => { if (!ok) toast('Death save failed. Your changes are not confirmed on disk.', 'bad'); });
      }
      target.current = findInteract(gs, now);
      consumeFX(e => { sfx(e); if (e.type === 'toast') toast(e.text); else if (e.type === 'hitstop') hitstop.current = Math.max(hitstop.current, e.ms); else if (e.type === 'banner') setBanner({ text: e.text, sub: e.sub, id: now }); else if (e.type === 'discover') setBanner({ text: e.name, sub: 'Discovered', id: now }); else if (e.type === 'region') setBanner(b => (b && now - b.id < 2500 ? b : { text: e.name, id: now })); else if (e.type === 'pickup' || e.type === 'struct.destroyed') scheduleSave(); });
      draw(g, gs, now, dt, { buildType: buildRef.current, reclaim: reclaimRef.current || repairRef.current || upgradeRef.current, mouseX: i.mx, mouseY: i.my, target: target.current, time: t });
      // close container panels when walking away
      const P = panelRef.current; if (P?.eid && gs.run.entities[P.eid]) { const e = gs.run.entities[P.eid]; if ((Math.hypot(e.x - gs.run.player.x, e.y - gs.run.player.y) > 3.4 * TILE || (e.kind === 'struct' && !clearWallLine(gs.run, gs.run.player, e)))) setPanel(null); } else if (P?.eid && !gs.run.entities[P.eid]) setPanel(null);
      uiAcc += dt; if (uiAcc > 100) { uiAcc = 0; rerender(); }
      saveAcc += dt; if (saveAcc > 5000) { saveAcc = 0; void save(gs).then(ok => { if (!ok) toast('Save failed. Changes are not confirmed on disk.', 'bad'); }); }
      ambAcc += dt; if (ambAcc > 1000) { ambAcc = 0; const w = weatherAt(gs.run, now); const z = getWorld().zone[Math.floor(gs.run.player.y / 16) * WW + Math.floor(gs.run.player.x / 16)]; setAmbience(w === 'storm' ? 1 : w === 'rain' ? 0.6 : 0, (z === 5 ? 0.9 : 0.25) + (w === 'storm' ? 0.6 : 0)); }
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [gs]);

  const onMouseMove = (e: React.MouseEvent) => { const s = scaleRef.current; mouse.current = { x: (e.clientX - offRef.current.x) / s, y: (e.clientY - offRef.current.y) / s }; };
  const onMouseDown = (e: React.MouseEvent) => {
    initAudio(); const r = gs.run; if (!r) return; onMouseMove(e);
    if (e.button === 2) { coreAimRef.current=null;setCoreAim(null);inp.current.skill=undefined;inp.current.cancel = true; setBuildType(null); setReclaim(false); setRepairMode(false); setUpgradeMode(false); return; }
    if (e.button !== 0) return;
    if (panel || coreAimRef.current) return;
    const wx = mouse.current.x + Math.round(cam.x), wy = mouse.current.y + Math.round(cam.y); const tx = Math.floor(wx / 16), ty = Math.floor(wy / 16);
    if (buildType) { const res = act('build', { struct: buildType, tx, ty }); if (res.ok && buildType === 'escrow') setBuildType(null); return; }
    if (upgradeMode || repairMode || reclaim) {
      const order = ['wall', 'obj', 'roof', 'floor'];
      const ents = entsAt(r, tx, ty).filter(x => x.kind === 'struct' && (editLayer === 'auto' || STRUCTS[x.type!].layer === editLayer) && (!upgradeMode || !!STRUCTURE_UPGRADES[x.type!]));
      ents.sort((a,b)=>order.indexOf(STRUCTS[a.type!].layer)-order.indexOf(STRUCTS[b.type!].layer));
      if (ents[0]) act(upgradeMode ? 'upgradeStructure' : repairMode ? 'repairStructure' : 'reclaim', { eid: ents[0].id });
      else if (reclaim && editLayer === 'auto') { const cart=Object.values(r.entities).find(x=>x.kind==='cart'&&Math.hypot(x.x-wx,x.y-wy)<12); if(cart) act('reclaim',{eid:cart.id}); else toast('No matching structure there.'); }
      else toast('No matching structure there. Use G to change layer.'); return;
    }
    const s = activeStack(r); if (s?.key === 'escrow_chest') { setBuildType('escrow'); toast('Place the Rương ký gửi on your claimed land.'); return; }
    inp.current.attackPressed = true; inp.current.attack = true;
  };
  const onMouseUp = () => { inp.current.attack = false; };

  (window as any).__soh = gs; // QA-only inspection hook (browser automation); no gameplay authority
  const r = gs.run; if (!r) return <div className="stage" />;
  const p = r.player; const now = Date.now(); const ph = phaseOf(r, now); const hrs = runHours(r, now); const day = Math.floor(hrs / 24) + 1;
  const dtm = dayTime(r, now); const clock = `${String(Math.floor(dtm * 24)).padStart(2, '0')}:${String(Math.floor((dtm * 24 % 1) * 60)).padStart(2, '0')}`;
  const w = weatherAt(r, now); const slot = Math.floor((now - r.startedAt + r.qaOffset) / (BAL.weather.slotMinutes * 60000)); const next = weatherSlot(r.seed, slot + 1);
  const WICON: Record<string, string> = { clear: '☀', cloudy: '☁', rain: '☂', storm: '⚡', fog: '≋' };
  const engaged = r.creatures.find(m => m.elder && m.state !== 'sleep' && m.state !== 'dead' && Math.hypot(m.x - p.x, m.y - p.y) < 240);
  const cart = p.pulling ? r.entities[p.pulling] : null;
  const tgt = target.current; const targetEntity = tgt?.eid ? r.entities[tgt.eid] : undefined;
  const targetHp = targetEntity?.kind === 'struct' && targetEntity.hp !== undefined && targetEntity.maxHp !== undefined && targetEntity.hp < targetEntity.maxHp ? ` · HP ${Math.ceil(targetEntity.hp)}/${targetEntity.maxHp}` : '';
  const ts = tgt ? { x: tgt.x - Math.round(cam.x), y: tgt.y - Math.round(cam.y) } : null;
  const zone = (getWorld().zoneNames || ZONES)[getWorld().zone[Math.floor(p.y / 16) * WW + Math.floor(p.x / 16)]];
  const hoverX=Math.floor((mouse.current.x+Math.round(cam.x))/TILE), hoverY=Math.floor((mouse.current.y+Math.round(cam.y))/TILE);
  const layers=['wall','obj','roof','floor']; const hover=entsAt(r,hoverX,hoverY).filter(e=>e.kind==='struct'&&(editLayer==='auto'||STRUCTS[e.type!].layer===editLayer)&&(!upgradeMode||!!STRUCTURE_UPGRADES[e.type!])).sort((a,b)=>layers.indexOf(STRUCTS[a.type!].layer)-layers.indexOf(STRUCTS[b.type!].layer))[0];
  const placementReason=buildType?buildReason(gs,buildType,hoverX,hoverY):null;
  const heldCash = countItem(r, 'inv', 'rcash'); const surf = SPEED_KEY[effTile(r, Math.floor(p.x / 16), Math.floor(p.y / 16))] || '';

  return <div style={{ position: 'fixed', inset: 0, cursor: buildType || reclaim || repairMode || upgradeMode ? 'cell' : 'crosshair' }} onMouseMove={onMouseMove} onMouseDown={onMouseDown} onMouseUp={onMouseUp} onContextMenu={e => e.preventDefault()}>
    <div ref={stageRef} className="stage" style={{ transform: `translate(${off.x}px, ${off.y}px) scale(${scale})` }}>
      <canvas ref={cvRef} width={VIEW_W} height={VIEW_H} style={{ width: VIEW_W, height: VIEW_H }} />
      {/* top-left vitals */}
      <div className="panel absolute" style={{ left: 4, top: 4, padding: '3px 5px', fontSize: 10, lineHeight: 1 }} onMouseDown={e => e.stopPropagation()}>
        {[['HP', p.hp, BAL.player.maxHp, '#e0483a'], ['ST', p.stamina, BAL.player.maxStamina, '#d8d050'], ['FD', p.hunger, 100, '#e09040'], ['H₂O', p.thirst, 100, '#4aa0e0'], ['WRM', p.warmth, 100, '#f0b0a0']].map(([l, v, m, c]) => <div key={l as string} className="flex items-center gap-1" style={{ marginBottom: 2 }}><span style={{ width: 18, color: '#b8a8c8' }}>{l}</span><Bar v={v as number} max={m as number} col={c as string} w={l === 'HP' ? 74 : 58} /><span style={{ width: 16, textAlign: 'right', color: (v as number) < (m as number) * 0.25 ? '#ff7a6a' : '#e8dcc8' }}>{Math.round(v as number)}</span></div>)}
        {p.rad > 1 && <div className="flex items-center gap-1"><span style={{ width: 18, color: '#b0e040' }}>RAD</span><Bar v={p.rad} max={100} col="#a0d030" w={58} /><span>{Math.round(p.rad)}</span></div>}
        <div style={{ color: p.sheltered ? '#9ae0a0' : '#8a7a9a', marginTop: 1 }}>{p.sheltered ? '⌂ sheltered' : zone} {surf && <span style={{ color: '#6a5a7a' }}>· {surf}</span>}</div>
      </div>
      {/* top-right clocks */}
      <div className="panel absolute" style={{ right: 4, top: 4, padding: '3px 6px', fontSize: 10, lineHeight: 1.05, textAlign: 'right', minWidth: 120 }} onMouseDown={e => e.stopPropagation()}>
        <div><span className="tag" style={{ color: ph === 'calm' ? '#9ae0a0' : ph === 'danger' ? '#ff9a5a' : '#ff4a3a' }}>{ph === 'calm' ? 'CALM' : ph === 'danger' ? 'RAGNAROK' : 'AWAKENING'}</span> <span style={{ color: '#ffd98a' }}>Day {day}/14</span></div>
        <div style={{ color: '#cfc2dc' }}>run {Math.floor(hrs)}h{String(Math.floor((hrs % 1) * 60)).padStart(2, '0')}m / {BAL.run.maxRunHours}h <span style={{ color: '#7a6a8a' }}>{r.qaUsed ? 'QA·' : ''}LOCAL</span></div>
        <div>{dtm > 0.25 && dtm < 0.75 ? '☼' : '☾'} {clock} · {WICON[w]} {w} <span style={{ color: '#7a6a8a' }}>→ {WICON[next]}</span></div>
        <div style={{ color: '#9ae0ff' }}>secured {gs.profile.securedCash}{heldCash ? <span style={{ color: '#ffe27a' }}> · carried {heldCash}</span> : null}</div>
        {ph === 'calm' && hrs > 230 && <div style={{ color: '#ff9a5a' }}>Ragnarok in {(264 - hrs).toFixed(1)}h</div>}
      </div>
      {engaged && (() => { const d = ELDERS[engaged.elder!.key]; return <div className="absolute" style={{ left: 170, top: 6, width: 300, textAlign: 'center' }}><div className="title-font" style={{ fontSize: 10, color: d.color, textShadow: '1px 1px 0 #000' }}>{d.name} <span style={{ color: '#cfc2dc', fontSize: 9 }}>— {engaged.elder!.awake ? 'awakened' : 'latent'}</span></div><div className="bar" style={{ width: 300, height: 6 }}><i style={{ width: `${(engaged.hp / engaged.maxHp) * 100}%`, background: `linear-gradient(${d.color}, #8a2a1a)` }} /></div></div>; })()}
      {banner && <div key={banner.id} className="absolute banner" style={{ left: 0, right: 0, top: 70, textAlign: 'center', pointerEvents: 'none' }} onAnimationEnd={() => setBanner(null)}><div className="title-font" style={{ fontSize: 22, color: '#ffe8b0', textShadow: '2px 2px 0 #2a1006, 0 0 8px #ff9a3a' }}>{banner.text}</div>{banner.sub && <div style={{ fontSize: 12, color: '#e0d0f0', textShadow: '1px 1px 0 #000' }}>{banner.sub}</div>}</div>}
      {coreAim && ['core_meteor','core_dragon','core_elsa'].includes(activeStack(r)?.key||'') && coreAim.mode==='signature' && <svg className="absolute" width={VIEW_W} height={VIEW_H} style={{left:0,top:0,pointerEvents:'none'}}><rect x="2" y="2" width={VIEW_W-4} height={VIEW_H-4} fill="none" stroke="#ffd98a" strokeDasharray="4 3"/></svg>}
      {coreAim && !(['core_meteor','core_dragon','core_elsa'].includes(activeStack(r)?.key||'') && coreAim.mode==='signature') && (()=>{const px=p.x-Math.round(cam.x),py=p.y-Math.round(cam.y),len=rayLen(r,p.x,p.y,p.aim,['core_meteor','core_dragon','core_elsa'].includes(activeStack(r)?.key||'')?Math.min(activeStack(r)?.key==='core_meteor'?180:157,Math.hypot(mouse.current.x+Math.round(cam.x)-p.x,mouse.current.y+Math.round(cam.y)-p.y)):coreAim.mode==='refined'?120:195);return <svg className="absolute" width={VIEW_W} height={VIEW_H} style={{left:0,top:0,pointerEvents:'none'}}><line x1={px} y1={py} x2={px+Math.cos(p.aim)*len} y2={py+Math.sin(p.aim)*len} stroke="#ffd98a" strokeWidth="1" strokeDasharray="4 3"/><circle cx={px+Math.cos(p.aim)*len} cy={py+Math.sin(p.aim)*len} r="4" fill="none" stroke="#ffd98a"/></svg>;})()}
      {coreAim && <div className="panel absolute" style={{left:220,top:38,padding:'2px 6px',fontSize:10,pointerEvents:'none'}}> {activeStack(r)?.key==='core_meteor' ? (coreAim.mode==='refined'?'Q: targeted meteor':'E: ten meteors in view') : activeStack(r)?.key==='core_dragon' ? (coreAim.mode==='refined'?'Q: fire tornado':'E: collect visible eligible foes') : activeStack(r)?.key==='core_elsa' ? (coreAim.mode==='refined'?'Q: one-second ice ward':'E: freeze visible terrain') : (coreAim.mode==='refined'?'Q: timed bomb · release to throw':'E: burning projectile · release to cast')} · RMB/Esc cancel</div>}
      {/* interaction prompt */}
      {tgt && ts && !panel && <div className="absolute" style={{ left: Math.round(ts.x), top: Math.round(ts.y) - 34, transform: 'translateX(-50%)', fontSize: 10, background: '#120c18e0', border: '1px solid #5a4a6a', padding: '0 4px', whiteSpace: 'nowrap', pointerEvents: 'none' }}><span style={{ color: '#ffe27a' }}>[F/E]</span> {tgt.label}{targetHp && <span style={{ color: '#ffb66a' }}>{targetHp}</span>}</div>}
      {/* build helper */}
      {(buildType || reclaim || repairMode || upgradeMode) && <div className="panel absolute" style={{ left: 145, bottom: 34, width: 350, padding: '3px 6px', fontSize: 11, textAlign: 'center',lineHeight:1.1 }} onMouseDown={e => e.stopPropagation()}>{buildType ? <><b style={{color:'#ffd98a'}}>Place {STRUCTS[buildType].name}</b> · {STRUCTS[buildType].cost.map(([k,q])=>`${ITEMS[k].name} ${countItem(r,'inv',k)}/${q}`).join(' · ')}<br/><span style={{color:placementReason?'#ff9a8a':'#9ae0a0'}}>{placementReason||'Placement allowed'} · RMB/Esc stop</span></> : <><b>{upgradeMode?'Upgrade':repairMode?'Repair':'Dismantle'}</b> · G layer: {editLayer} · RMB/Esc stop<br/>{hover ? <span>{STRUCTS[hover.type!].name} · HP {Math.ceil(hover.hp||0)}/{hover.maxHp} · {hover.owner && hover.owner!=='player'?'not owned':'owned'}{upgradeMode && STRUCTURE_UPGRADES[hover.type!] ? ` → ${STRUCTS[STRUCTURE_UPGRADES[hover.type!]].name}: ${STRUCTS[STRUCTURE_UPGRADES[hover.type!]].cost.map(([k,q])=>`${ITEMS[k].name} ${countItem(r,'inv',k)}/${q}`).join(', ')}` : ''}{repairMode ? ` · Repair: ${STRUCTS[hover.type!].cost.map(([k,q])=>`${ITEMS[k].name} ${countItem(r,'inv',k)}/${Math.max(1,Math.ceil(q/4))}`).join(', ')}` : ''}{reclaim ? ` · Refund: ${STRUCTS[hover.type!].item ? ITEMS[STRUCTS[hover.type!].item!].name : STRUCTS[hover.type!].cost.map(([k,q])=>`${ITEMS[k].name} ${Math.floor(q*BAL.economy.reclaimRefund)}`).join(', ')}` : ''}</span> : 'Point at a structure; click to act.'}</>}</div>}
      {/* cargo */}
      {cart && <div className="panel absolute" style={{ left: 4, bottom: 30, padding: '2px 5px', fontSize: 10 }}>🛒 Cart {cartWeight(r, cart.c!).toFixed(0)}/{cartLimit(cart)} kg · {(() => { const t = effTile(r, Math.floor(cart.x / 16), Math.floor(cart.y / 16)); const k = SPEED_KEY[t]; return k === 'road' || k === 'bridge' || k === 'floor' ? <span style={{ color: '#9ae0a0' }}>on road ×{BAL.cart.speedOnRoad}</span> : ['forest', 'marsh', 'hill', 'snow'].includes(k) ? <span style={{ color: '#ff9a7a' }}>rough ×{BAL.cart.speedRough}</span> : <span style={{ color: '#ffd98a' }}>off-road ×{BAL.cart.speedOffRoad}</span>; })()} · [F] release</div>}
      {/* log */}
      <div className="absolute" style={{ left: 4, bottom: cart ? 46 : 30, width: 230, fontSize: 10, lineHeight: 1.05, pointerEvents: 'none' }}>{r.log.slice(-4).map((l, i) => { const age = now - l.t; if (age > 14000) return null; return <div key={i} style={{ opacity: Math.max(0, 1 - age / 14000), color: l.tone === 'gold' ? '#ffe27a' : l.tone === 'red' ? '#ff8a7a' : l.tone === 'blue' ? '#9ae0ff' : '#e0d4c4', textShadow: '1px 1px 0 #000' }}>{l.msg}</div>; })}</div>
      {/* toasts */}
      <div className="absolute" style={{ left: 0, right: 0, bottom: 56, textAlign: 'center', pointerEvents: 'none' }}>{toasts.filter(t => now - t.t < 3200).map(t => <div key={t.id} className="fadein" style={{ display: 'inline-block', margin: '1px auto', fontSize: 11, padding: '1px 6px', background: '#120c18d8', border: `1px solid ${t.tone === 'bad' ? '#8a3a2a' : t.tone === 'ok' ? '#3a7a3a' : '#5a4a6a'}`, color: t.tone === 'bad' ? '#ffb0a0' : '#f0e4d0' }}>{t.text}<br /></div>)}</div>
      {/* quickbar */}
      <div className="panel absolute flex gap-0.5" style={{ left: '50%', transform: 'translateX(-50%)', bottom: 4, padding: 3 }} onMouseDown={e => e.stopPropagation()}>
        {C(r, 'inv').slots.slice(0, 8).map((s, i) => <Slot key={i} s={s} active={i === p.active} hotkey={String(i + 1)} onClick={() => { p.active = i; rerender(); }} onContext={() => act('useItem', { slot: i })} />)}
        <div style={{ fontSize: 9, width: 74, lineHeight: 1, marginLeft: 3, color: '#cfc2dc', alignSelf: 'center' }}>{(() => { const s = activeStack(r); if (!s) return 'Fists'; const d = ITEMS[s.key]; return <><span style={{ color: '#ffe0a0' }}>{d.name}</span><br />{d.creatorCore && s.reserves ? `B${s.reserves.basic} Q${s.reserves.refined} E${s.reserves.signature} · R/Shift/Alt reload` : d.core ? `${s.charge}/${d.charge} charges · LMB cast, RMB cancel` : d.food ? 'LMB eat/drink' : d.dmg ? `dmg ${d.dmg}${d.power ? ' · tool' : ''}` : d.place ? 'LMB to place' : d.cat === 'bp' ? 'LMB learn' : ''}</>; })()}</div>
      </div>
      {/* panels */}
      {panel?.kind === 'inv' && <InventoryPanel api={api} />}
      {panel?.kind === 'container' && panel.eid && <ContainerPanel api={api} eid={panel.eid} />}
      {panel?.kind === 'craft' && <CraftPanel api={api} />}
      {panel?.kind === 'build' && <BuildPanel api={api} />}
      {panel?.kind === 'map' && <MapPanel api={api} />}
      {panel?.kind === 'skills' && <SkillsPanel api={api} />}
      {panel?.kind === 'menu' && <MenuPanel api={api} onSave={() => save(gs)} onQuit={async () => { if (await save(gs)) onExit(); else toast('Save failed; staying in the run.', 'bad'); }} />}
      {panel?.kind === 'vendor' && panel.eid && <VendorPanel api={api} eid={panel.eid} />}
      {panel?.kind === 'escrow' && panel.eid && <EscrowPanel api={api} eid={panel.eid} />}
      {panel?.kind === 'evac' && panel.eid && <EvacPanel api={api} eid={panel.eid} />}
      {panel?.kind === 'report' && <ReportPanel api={api} lines={panel.lines || []} />}
      {p.dead && <div className="absolute inset-0 flex flex-col items-center justify-center fadein" style={{ background: 'radial-gradient(#3a0a0aa0, #000c)' }} onMouseDown={e => e.stopPropagation()}>
        <div className="title-font" style={{ fontSize: 26, color: '#ff8a6a', textShadow: '2px 2px 0 #000' }}>You have fallen</div>
        <div style={{ fontSize: 12, color: '#e0d0c0', maxWidth: 320, textAlign: 'center' }}>Death does not end the run. Everything you carried lies in a bag where you fell — go back for it. {Object.values(r.entities).some(e => e.type === 'bed_straw') ? 'You will wake at your bed.' : 'With no bed, you wake at a landing site.'}</div>
        <button className="btn gold" style={{ marginTop: 8, fontSize: 14 }} disabled={p.deadT < 1200} onClick={() => act('respawn')}>Rise again</button>
      </div>}
      {!panel && hrs < 0.08 && !r.qaUsed && <div className="absolute fadein" style={{ right: 4, top: 60, width: 150, fontSize: 10, color: '#cfc2dc', lineHeight: 1.1, textShadow: '1px 1px 0 #000', pointerEvents: 'none' }}>WASD move · mouse aim · LMB swing · Space roll · F/E interact · I/C/B/M panels · Esc menu. No quests — choose your own way.</div>}
      {isRagnarok(r, now) && heldCash > 0 && !panel && <div className="absolute pulse" style={{ right: 4, top: 62, fontSize: 10, color: '#ffe27a', textShadow: '1px 1px 0 #000' }}>Unsecured cash: {heldCash} — deposit it in your Rương ký gửi</div>}
    </div>
  </div>;
}
void HOUR; void CREATURES;
