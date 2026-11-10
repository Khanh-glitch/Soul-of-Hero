import './journey.css';
import { airdropView } from '../game/airdrop';
import SpiritVfxEditor from './SpiritVfxEditor';
import * as pfx from '../game/pixelfx';
import { pfxFromSimEvent } from '../game/pixelfxMap';
import { useEffect, useRef, useState, useCallback } from 'react';
import { BAL, TILE, WW, VIEW_W, VIEW_H, HOUR, type GameState } from '../game/core';
import { ITEMS, STRUCTS, ELDERS, CREATURES, STRUCTURE_UPGRADES } from '../game/catalog';
import { dispatch, phaseOf, runHours, dayTime, weatherAt, weatherSlot, countItem, C, entsAt, cartWeight, cartLimit, effTile, isRagnarok, buildReason, clearWallLine, claimAt, territoryForecast } from '../game/engine';
import { tick, syncWorld, findInteract, activeStack, SPEED_KEY, rayLen, spiritDestination, type Input, type Interact } from '../game/sim';
import { draw, consumeFX, cam } from '../game/render';
import { qaFillPack, qaPrepareFullPack, qaSetSecuredCash } from '../game/qa-fixtures';
const SAVE_TOAST: Record<string, string> = {
  'invalid-state': 'Save refused: the game state failed an integrity check. Your last good save is kept.',
  'serialize-error': 'Save failed: the snapshot could not be prepared. Your last good save is kept.',
  'local-write': 'This browser refused the save write (storage full or blocked). Your last good save is kept.',
  'readback-conflict': 'Save could not be confirmed on readback. Do not close the tab yet.',
  'idb-init': 'Save database unavailable; the local copy was written.',
  'idb-transaction': 'Save database write failed; the local copy was written.',
};
import { getWorld, ZONES } from '../game/world';
import { sfx, setAmbience, initAudio, setVolume } from '../game/audio';
import { save, saveSync, saveDetailed, lastSaveOutcome } from '../game/persist';
import { Slot, Bar, Icon, mkIntent, type Api, type PanelState } from './common';
import { Vitals, UrgentAlerts, WorldClock, Hotbar, RigStatus, ThreatBar, PresentationPanel, useVisualPrefs, Glyph } from './hud';
import { setListener, setEnvironment, machineState, setMood, tickMusic, stopAllMachines } from '../game/audio';
import { getPrefs, setPrefs, applyCssTheme } from '../visual/direction';
import { HomeStatusCard } from './HomeStatus';
import { thermalStatusView } from '../game/thermal';
import { nearestHomeStructure, homeStatus } from '../game/engine';
import { ThermalStatusCard, thermalEnvNow } from './ThermalStatus';
import { classifyOfflineReturn, readReturnHistory, recordReturnHistory, settleWithReturn, type OfflineReturnV1, type StoredReturnEntry } from '../game/return-report';
import { evaluateFieldNotes, readFieldNoteStore, writeFieldNoteStore, type FieldNoteStore } from '../game/field-notes';
import { FieldNoteCard, FieldNotesPanel } from './FieldNotes';
import { ReturnDigest } from './ReturnChronicle';
import { RestPanel } from './RestPanel';
import { InventoryPanel, ContainerPanel, CraftPanel, BuildPanel, MapPanel, SkillsPanel, MenuPanel, VendorPanel, EscrowPanel, EvacPanel, ReportPanel } from './panels';
import { deriveCues } from '../game/presentation-cues';
import { experienceForPhase, experienceFromCue, stagedExperience, type ExperienceEvent } from '../game/experience';
import { triggerQaEvent, qaCycleBikeState, type QaPresetId } from '../game/qa-sandbox';
import { ElderBossHUD, RagnarokStrip, CoreReserveStrip, AirdropCard, DeathRecoveryOverlay, QaSandboxDrawer } from './EventExperiences';
import { ExperienceStage, FieldPickupLayer, EventFeed, type FieldPickup, type FeedLine } from './ExperienceStage';
import { SurvivorScreen } from './SurvivorScreen';
import { BuildBar, BUILD_KIT, type BuildTool } from './BuildBar';
import { clearSlotInteraction, getHoverSlot, getKeyboardPick, DragGhost } from './dragSlots';
import { loadJourney, flushJourney, ingestJourney, resolveTrack, rerollDaily, recordWorldMoment, markChronicleSeen, lessonState, FIELDCRAFT, DAILY_BY_ID, currentStep, lessonComplete, type JourneyStore, type JourneyEvent, type TrackRef } from '../game/journey';
import { directCues, standingIssues, ragnarokCinematic, eldersWakeCinematic, type Flare, type Cinematic, type Issue } from '../game/attention';
import { Waymark, WorldBeacon, FlareLayer, CinematicLayer, IssueRail, findAnchor, type WaymarkMode } from './Waymark';
import { JourneyLedger } from './Journey';

export default function Game({
  gs,
  report,
  initialBanner = null,
  qaMode = false,
  qaPreset = 'full_gear',
  onSwitchQaPreset,
  onExit,
  onRunEnd,
}: {
  gs: GameState;
  report: { lines: string[]; report: OfflineReturnV1 | null } | null;
  initialBanner?: { text: string; sub: string } | null;
  qaMode?: boolean;
  qaPreset?: QaPresetId;
  onSwitchQaPreset?: (p: QaPresetId) => void;
  onExit: () => void;
  onRunEnd: () => void;
}) {
  const vp = useVisualPrefs();
  useEffect(() => { applyCssTheme(); setVolume(gs.profile.settings.volume, gs.profile.settings.muted || getPrefs().muted); }, [gs, vp.muted]);
  const cvRef = useRef<HTMLCanvasElement>(null); const stageRef = useRef<HTMLDivElement>(null);
  const [, setFrame] = useState(0); const rerender = useCallback(() => setFrame(f => f + 1), []);
  const initialSeverity = report?.report ? classifyOfflineReturn(report.report) : null;
  const openFullInitial = !!(report && (initialSeverity ? initialSeverity !== 'minimal' : report.lines.length > 0));
  const [panel, setPanel] = useState<PanelState | null>(openFullInitial ? { kind: 'report', lines: report!.lines, report: report!.report } : null);
  const [returnDigest, setReturnDigest] = useState<OfflineReturnV1 | null>(!openFullInitial && report?.report ? report.report : null);
  const [returnHistory, setReturnHistory] = useState<StoredReturnEntry[]>(() => gs.run ? (report?.report ? recordReturnHistory(gs.run, qaMode, report.report) : readReturnHistory(gs.run, qaMode)) : []);
  const [fieldNoteStore, setFieldNoteStore] = useState<FieldNoteStore>(() => gs.run ? readFieldNoteStore(gs.run, qaMode) : { dismissed: [], resolved: [], triggered: [], muted: false });
  const fieldActionsRef = useRef<Set<string>>(new Set());
  const [sel, setSel] = useState<{ c: string; slot: number } | null>(null);
  const [buildType, setBuildType] = useState<string | null>(null); const [reclaim, setReclaim] = useState(false); const [repairMode, setRepairMode] = useState(false); const [upgradeMode, setUpgradeMode] = useState(false);
  const [editLayer, setEditLayer] = useState('auto');
  const [toasts, setToasts] = useState<{ id: number; text: string; tone?: string; t: number }[]>([]);
  const [banner, setBanner] = useState<{ text: string; sub?: string; id: number } | null>(null);
  const [experiences, setExperiences] = useState<ExperienceEvent[]>([]);
  const [fieldPickups, setFieldPickups] = useState<FieldPickup[]>([]);
  const [feed, setFeed] = useState<FeedLine[]>([]);
  const [buildMode, setBuildMode] = useState(false);
  const [buildTool, setBuildTool] = useState<BuildTool>('wall_wood');
  const buildModeRef = useRef(buildMode); buildModeRef.current = buildMode;
  const lastPieceRef = useRef<BuildTool>('wall_wood');
  const feedbackSeen = useRef<Map<string, number>>(new Map());
  const fieldMerge = useRef<Map<string, { id: string; t: number }>>(new Map());
  const seenCores = useRef<Set<string>>(new Set());
  const lastCueSeq = useRef<number>(gs.run?.receipts.at(-1)?.seq ?? 0);
  const phaseWatch = useRef<{ runId: string; phase: string } | null>(null);
  // ---------------- JOURNEY + ATTENTION state ----------------
  const [journey, setJourneyState] = useState<JourneyStore>(() => loadJourney(gs, qaMode));
  const journeyRef = useRef(journey); journeyRef.current = journey;
  const setJourney = useCallback((next: JourneyStore) => { journeyRef.current = next; setJourneyState(next); flushJourney(gs, qaMode, next); }, [gs, qaMode]);
  const [stamps, setStamps] = useState<JourneyEvent[]>([]);
  const [flares, setFlares] = useState<Flare[]>([]);
  const heldFlares = useRef<Omit<Flare, 'born'>[]>([]);
  const [cines, setCines] = useState<Cinematic[]>([]);
  const [peek, setPeek] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [snoozed, setSnoozed] = useState<Record<string, string>>({});
  const anchorCache = useRef<{ t: number; key: string; v: { x: number; y: number; label: string } | null }>({ t: 0, key: '', v: null });
  const journeyAcc = useRef(0);
  const runJourney = useCallback((now: number) => {
    const res = ingestJourney(journeyRef.current, gs, now);
    if (!res.changed) return;
    setJourney(res.store);
    const big = res.events.filter(e => e.level >= 2);
    const away = big.filter(e => e.away);
    const live = big.filter(e => !e.away);
    // Offline/absent completions are grouped into ONE quiet record instead of a parade.
    if (away.length > 1) live.push({ id: `away:${now}`, level: 2, kind: 'step', title: `${away.length} records while away`, detail: 'Written in your Journey ledger [J]', icon: 'blueprint', away: true });
    else live.push(...away);
    if (live.length) setStamps(cur => [...cur, ...live.filter(e => !cur.some(c => c.id === e.id))].slice(-6));
    if (!big.length && res.events.some(e => e.kind === 'progress')) sfx({ type: 'jtick' });
  }, [gs, setJourney]);
  const flushJourneyNow = useCallback(() => { if (!qaMode) flushJourney(gs, false, journeyRef.current); }, [gs, qaMode]);
  const stampsRef = useRef(stamps); stampsRef.current = stamps;
  const cinesRef = useRef(cines); cinesRef.current = cines;
  const gateRef = useRef({ stamp: false, flare: false, cine: false });
  const shownRef = useRef<{ stamp: { id: string; t: number } | null; cine: string | null }>({ stamp: null, cine: null });
  // Deferral clock: moments wait while combat / full-screen / death own the screen; sound plays when the visual does.
  useEffect(() => { const t = window.setInterval(() => {
    const n = Date.now(); const g = gateRef.current; const sh = shownRef.current;
    const head = stampsRef.current[0];
    if (head && g.stamp) {
      if (!sh.stamp || sh.stamp.id !== head.id) { sh.stamp = { id: head.id, t: n }; sfx({ type: head.kind === 'milestone' ? 'jmilestone' : 'jstamp' }); }
      else if (n - sh.stamp.t > (head.kind === 'milestone' ? 3600 : 2700)) { sh.stamp = null; setStamps(cur => cur.filter(x => x.id !== head.id)); }
    }
    if (g.flare && heldFlares.current.length) { const next = heldFlares.current.splice(0, 2).map(f => ({ ...f, born: n })); setFlares(cur => [...cur, ...next].slice(-3)); sfx({ type: 'jcapability' }); }
    setFlares(cur => cur.some(f => n - f.born > 3700) ? cur.filter(f => n - f.born <= 3700) : cur);
    const c0 = cinesRef.current[0]; if (c0 && g.cine && sh.cine !== c0.id) { sh.cine = c0.id; sfx({ type: 'jepic' }); }
  }, 200); return () => window.clearInterval(t); }, []);
  const [qaOpen, setQaOpen] = useState<boolean>(qaMode);
  const [bikeDemoState, setBikeDemoState] = useState<string | null>(null);
  useEffect(() => {
    setBanner(null);
    const sev = report?.report ? classifyOfflineReturn(report.report) : null;
    const full = !!(report && (sev ? sev !== 'minimal' : report.lines.length > 0));
    setPanel(full ? { kind: 'report', lines: report!.lines, report: report!.report } : null);
    setReturnDigest(!full && report?.report ? report.report : null);
    setReturnHistory(gs.run ? (report?.report ? recordReturnHistory(gs.run, qaMode, report.report) : readReturnHistory(gs.run, qaMode)) : []);
    setFieldNoteStore(gs.run ? readFieldNoteStore(gs.run, qaMode) : { dismissed: [], resolved: [], triggered: [], muted: false });
    fieldActionsRef.current.clear();
    setExperiences([]); setFieldPickups([]);
    lastCueSeq.current = gs.run?.receipts.at(-1)?.seq ?? 0;
    seenCores.current = new Set(gs.run ? C(gs.run, 'inv').slots.filter(s => s && ITEMS[s.key]?.creatorCore).map(s => s!.uid) : []);
    phaseWatch.current = gs.run ? { runId: gs.run.id, phase: phaseOf(gs.run, Date.now()) } : null;
    feedbackSeen.current.clear(); fieldMerge.current.clear();
    { const j = loadJourney(gs, qaMode); journeyRef.current = j; setJourneyState(j); }
    setStamps([]); setFlares([]); setCines([]); heldFlares.current = []; setPeek(false);
  }, [gs, initialBanner, report, qaMode]);
  const inp = useRef<Input>({ up: false, down: false, left: false, right: false, mx: 0, my: 0, attack: false, attackPressed: false, roll: false, cancel: false });
  const [coreAim, setCoreAim] = useState<null | { mode: 'refined' | 'signature'; uid: string; code: string }>(null);
  const spiritTarget=useRef<null | {uid:string;x:number;y:number}>(null);
  const coreAimRef = useRef(coreAim); coreAimRef.current = coreAim;
  const mouse = useRef({ x: 320, y: 180 }); const target = useRef<Interact | null>(null); const hitstop = useRef(0);
  const idleAcc = useRef(0); // presentation only: lets the score fall silent while gathering
  const panelRef = useRef(panel); panelRef.current = panel; const buildRef = useRef(buildType); buildRef.current = buildType; const reclaimRef = useRef(reclaim); reclaimRef.current = reclaim; const repairRef = useRef(repairMode); repairRef.current = repairMode; const upgradeRef = useRef(upgradeMode); upgradeRef.current = upgradeMode;
  const saveT = useRef<any>(null); const toastKeys = useRef<Record<string, number>>({});
  const scheduleSave = () => { if (qaMode) return; clearTimeout(saveT.current); saveT.current = setTimeout(() => { void saveDetailed(gs).then(reportSave); }, 250); };
  const reportSave = (o: { ok: boolean; category: string; idbStatus: string }) => {
    if (qaMode) return;
    if (o.ok) flushJourneyNow();
    const text = !o.ok ? SAVE_TOAST[o.category] ?? SAVE_TOAST['serialize-error'] : o.idbStatus === 'idb-init' || o.idbStatus === 'idb-transaction' ? 'Saved to this browser; the backup database write failed.' : '';
    if (text) toast(text, 'bad');
  };
  const toast = useCallback((text: string, tone?: string) => { if (!text) return; const k = text; const n = Date.now(); if (toastKeys.current[k] && n - toastKeys.current[k] < 2500) return; toastKeys.current[k] = n; const id = n + Math.random(); setToasts(t => [...t.slice(-3), { id, text, tone, t: n }]); setTimeout(() => setToasts(t => t.filter(v => v.id !== id)), 3300); }, []);
  const present = useCallback((event: ExperienceEvent) => {
    const now = Date.now(); const seen = feedbackSeen.current.get(event.id);
    if (seen && now - seen < 30000) return;
    feedbackSeen.current.set(event.id, now);
    for (const [id, at] of feedbackSeen.current) if (now - at > 30000) feedbackSeen.current.delete(id);
    if (event.tier === 'feed') {
      // Feed: merge with an identical recent line (×N) instead of stacking; 4 lines max; never the screen centre.
      setFeed(cur => {
        const k = `${event.title}|${event.detail}`; const hit = cur.find(l => `${l.title}|${l.detail}` === k && now - l.at < 4000);
        const next = hit ? cur.map(l => l === hit ? { ...l, count: l.count + 1, at: now } : l)
          : [...cur, { id: event.id, icon: event.icon, title: event.title, detail: event.detail, accent: event.accent || '#c4d4b0', warn: event.kind === 'warning', count: 1, at: now }];
        return next.slice(-4);
      });
      return;
    }
    setExperiences(current => [...current.filter(v => v.id !== event.id), event].sort((a, b) => b.priority - a.priority).slice(0, 4));
    // Let ExperienceStage drive active display timing so queued plaques aren't evicted before being seen;
    // prune only genuinely stale unshown items after 30s.
    window.setTimeout(() => setExperiences(current => current.filter(v => v.id !== event.id)), 90000);
  }, []);
  useEffect(() => { const t = window.setInterval(() => { const n = Date.now(); setFeed(cur => cur.some(l => n - l.at > 4200) ? cur.filter(l => n - l.at <= 4200) : cur); }, 500); return () => window.clearInterval(t); }, []);
  const applyTool = useCallback((t: BuildTool) => {
    setBuildTool(t); if ((BUILD_KIT as readonly string[]).includes(t)) lastPieceRef.current = t;
    setUpgradeMode(t === 'upgrade'); setRepairMode(t === 'repair'); setReclaim(t === 'reclaim');
    setBuildType((BUILD_KIT as readonly string[]).includes(t) ? t : null);
  }, []);
  const enterBuild = useCallback((t?: BuildTool) => { setPanel(null); setBuildMode(true); applyTool(t ?? lastPieceRef.current); sfx({ type: 'ui' }); }, [applyTool]);
  const exitBuild = useCallback(() => { setBuildMode(false); setBuildType(null); setReclaim(false); setRepairMode(false); setUpgradeMode(false); }, []);
  const dismissExperience = useCallback((id: string) => setExperiences(current => current.filter(v => v.id !== id)), []);
  useEffect(() => {
    if (!initialBanner) return;
    const text = initialBanner.text.toUpperCase();
    const kind = text.includes('RAGNAROK') ? 'world' : text.includes('ELDER') ? 'boss' : text.includes('CORE') ? 'relic' : 'milestone';
    present({ id: `qa-entry:${initialBanner.text}`, kind, priority: kind === 'world' || kind === 'boss' ? 90 : 44, title: initialBanner.text, detail: initialBanner.sub || '', icon: kind === 'relic' ? 'core_dragon' : undefined, accent: kind === 'world' ? '#ff7650' : kind === 'boss' ? '#f1c16a' : kind === 'relic' ? '#d99bff' : '#93d8b4', duration: kind === 'world' || kind === 'boss' ? 4200 : 2600, source: qaMode ? 'staged' : 'engine', tier: kind === 'milestone' ? 'feed' : 'stage' });
  }, [initialBanner, qaMode, present]);
  const floatItem = useCallback((key: string, qty: number, x: number, y: number, id?: string) => {
    if (!ITEMS[key] || qty <= 0) return;
    const now = Date.now(); const prior = fieldMerge.current.get(key);
    if (prior && now - prior.t < 360) {
      prior.t = now;
      setFieldPickups(current => current.map(v => v.id === prior.id ? { ...v, qty: v.qty + qty, x, y } : v));
      return;
    }
    const next = { id: id || `field-${now}-${Math.random().toString(36).slice(2, 6)}`, key, qty, x, y };
    fieldMerge.current.set(key, { id: next.id, t: now });
    setFieldPickups(current => [...current.slice(-5), next]);
    window.setTimeout(() => {
      setFieldPickups(current => current.filter(v => v.id !== next.id));
      const last = fieldMerge.current.get(key); if (last?.id === next.id) fieldMerge.current.delete(key);
    }, 1250);
  }, []);
  const act = useCallback((type: string, payload: Record<string, any> = {}) => {
    const now = Date.now();
    const sourceRun = gs.run;
    const sourceStack = type === 'move' && payload.to === 'inv' && payload.from !== 'inv' && sourceRun?.custody[payload.from]?.slots[payload.fs];
    const sourceEntity = sourceStack && sourceRun ? Object.values(sourceRun.entities).find(e => e.c === payload.from || e.station?.outC === payload.from || e.station?.fuelC === payload.from) : undefined;
    const sourceBefore = sourceStack && sourceRun ? { key: sourceStack.key, uid: sourceStack.uid, qty: sourceStack.qty, x: sourceEntity?.x ?? sourceRun.player.x, y: sourceEntity?.y ?? sourceRun.player.y } : null;
    // An input arriving before a frame must not precede elapsed world events.
    const ready = syncWorld(gs, now);
    const res = ready ? dispatch(gs, mkIntent(type, payload), now) : { ok: false as const, reason: gs.run ? 'The device clock moved backwards.' : 'No active run.' };
    if (res.ok) {
      const openPanel = panelRef.current;
      if (openPanel?.kind === 'container' && openPanel.eid && !gs.run?.entities[openPanel.eid]) { setPanel(null); setSel(null); }
      // Bind UI acknowledgement to the receipt returned by this transaction,
      // not the last receipt in the log (which may belong to an achievement).
      const committed = gs.run?.receipts.find(v => v.id === res.receipt);
      const projected = committed && gs.run ? deriveCues([committed], committed.seq - 1).some(c => !!experienceFromCue(c, gs.run!)) : false;
      scheduleSave(); if (res.msg && !projected) toast(res.msg, 'ok'); sfx({ type: type === 'build' ? 'build' : type === 'craft' ? 'craft' : type === 'deposit' || type === 'buy' ? 'coin' : 'ui' });
      if (sourceBefore && committed?.kind === 'move') {
        const after = gs.run?.custody[payload.from]?.slots[payload.fs];
        const moved = Math.max(0, sourceBefore.qty - (after?.uid === sourceBefore.uid ? after.qty : 0));
        if (moved) floatItem(sourceBefore.key, moved, sourceBefore.x, sourceBefore.y, committed.id);
      }
    }
    else if (!(res as any).dup) { toast((res as any).reason, 'bad'); sfx({ type: 'deny' }); }
    rerender(); return res;
  }, [gs, floatItem]);
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
      case 'loot': act('observeLoot', { eid: t.eid }); setPanel({ kind: 'container', eid: t.eid }); sfx({ type: 'ui' }); return;
      case 'recycler': case 'bag': case 'cart': case 'vehicle': setPanel({ kind: 'container', eid: t.eid }); sfx({ type: 'ui' }); return;
      case 'airdrop': { const res=act('openAirdrop',{eid:t.eid}); if(res.ok){setPanel({kind:'container',eid:t.eid});sfx({type:'ui'});} return; }
      case 'cash': { const res = act('openCash', { eid: t.eid }); if (res.ok) { setPanel({ kind: 'container', eid: t.eid }); sfx({ type: 'coin' }); } return; }
      case 'vendor': setPanel({ kind: 'vendor', eid: t.eid }); return;
      case 'door': act('door', { eid: t.eid }); act('observeGate', { eid: t.eid }); return;
      case 'gen': act('generator', { eid: t.eid }); act('observeGate', { eid: t.eid }); return;
      case 'evac': setPanel({ kind: 'evac', eid: t.eid }); return;
    }
    if (e && e.kind === 'struct') {
      const d = STRUCTS[e.type!];
      if (e.type!.startsWith('door')) act('door', { eid: e.id });
      else if (e.type === 'power_switch') act('wireSwitch', { eid: e.id });
      else if (e.type === 'ir_sensor') act('irSensorToggle', { eid: e.id });
      else if (e.type === 'bear_trap') act('bearTrapSet', { eid: e.id });
      else if (e.type === 'escrow') setPanel({ kind: 'escrow', eid: e.id });
      else if (e.type === 'bed_straw' && (e.hp ?? 0) > 0) setPanel({ kind: 'rest', eid: e.id });
      else if (e.type === 'claim') setPanel({ kind: 'container', eid: e.id });
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
      if (keyMap[e.code]) { if (!panelRef.current) (inp.current as any)[keyMap[e.code]] = true; e.preventDefault(); return; }
      if (e.code === 'Tab') { e.preventDefault(); toggle('skills'); return; }
      if (e.code === 'F9') { e.preventDefault(); if (!qaMode) { toast('Visual QA is isolated. Launch it from the Title screen.'); return; } setQaOpen(v => !v); sfx({ type: 'ui' }); return; }
      if (e.repeat) return;
      switch (e.code) {
        case 'Space': if (!panelRef.current) inp.current.roll = true; e.preventDefault(); break;
        case 'KeyQ': case 'KeyE': {
          const s=activeStack(r);
          if(!r.player.vehicle && s && ITEMS[s.key]?.creatorCore && !coreAimRef.current && !panelRef.current && !r.player.dead && !r.player.action){const aim={mode:e.code==='KeyQ'?'refined' as const:'signature' as const,uid:s.uid,code:e.code};coreAimRef.current=aim;setCoreAim(aim);e.preventDefault();}
          else if(e.code==='KeyE' && !ITEMS[s?.key||'']?.creatorCore && !panelRef.current) interact();
          break;
        }
        case 'KeyF': { if (panelRef.current) break; if(r.player.vehicle){act('vehicleExit',{});break;} if(e.shiftKey || r.player.pulling){const c = Object.values(r.entities).find(x => x.kind === 'cart' && Math.hypot(x.x-r.player.x,x.y-r.player.y)<34); if(c) act('grabCart',{eid:c.id}); else if(r.player.pulling) act('grabCart',{eid:r.player.pulling}); else toast('No cart within reach.');} else if(target.current) interact(); else {const c=Object.values(r.entities).find(x=>x.kind==='cart' && Math.hypot(x.x-r.player.x,x.y-r.player.y)<34);if(c)act('grabCart',{eid:c.id});} break; }
        case 'KeyI': case 'KeyC': if (buildModeRef.current) exitBuild(); fieldActionsRef.current.add('survivor'); toggle(e.code === 'KeyC' ? 'craft' : 'inv'); break;
        case 'KeyM': toggle('map'); break;
        case 'KeyN': toggle('notes'); break;
        case 'KeyJ': toggle('journey'); break;
        case 'KeyT': setPeek(v => !v); sfx({ type: 'ui' }); break;
        case 'KeyB': if (buildModeRef.current) exitBuild(); else enterBuild(); break;
        case 'KeyG': setEditLayer(v => { const a=['auto','wall','obj','roof','floor']; return a[(a.indexOf(v)+1)%a.length]; }); break;
        case 'KeyU': enterBuild('upgrade'); break;
        case 'KeyX': enterBuild('reclaim'); break;
        case 'KeyV': enterBuild('repair'); break;
        case 'KeyR': { const selected=activeStack(r); if(selected && ITEMS[selected.key]?.creatorCore && !panelRef.current){act('loadCore',{slot:r.player.active,uid:selected.uid,mode:e.altKey?'signature':e.shiftKey?'refined':'basic'});break;} const t = Object.values(r.entities).find(x => x.type === 'research' && Math.hypot(x.x - r.player.x, x.y - r.player.y) < 3 * TILE && clearWallLine(r, r.player, x)); if (t) setPanel({ kind: 'container', eid: t.id }); else toast('Research needs a Research Table within reach.'); break; }
        case 'Escape': if (buildModeRef.current) { exitBuild(); break; } if(coreAimRef.current || (r.player.action?.kind==='cast' && !r.player.action.done)){coreAimRef.current=null;setCoreAim(null);inp.current.skill=undefined;inp.current.cancel=true;break;} if (panelRef.current && getKeyboardPick()) { clearSlotInteraction(); setSel(null); break; } if (buildRef.current || reclaimRef.current || repairRef.current || upgradeRef.current) { setUpgradeMode(false); setBuildType(null); setReclaim(false); setRepairMode(false); } else if (panelRef.current) setPanel(null); else setPanel({ kind: 'menu' }); setSel(null); break;
        default: {
          const dm = e.code.match(/^Digit(\d)$/); if (!dm) break;
          const n = +dm[1];
          if (buildModeRef.current) { const i = n === 0 ? 9 : n - 1; if (BUILD_KIT[i]) applyTool(BUILD_KIT[i]); break; }
          if (n < 1 || n > 8) break;
          // Hover (or keyboard-focus) a slot in any open container and press 1-8: move/swap onto that quickbar slot.
          const focusedEl = !getHoverSlot() && document.activeElement instanceof HTMLElement ? document.activeElement.closest('[data-dslot]') as HTMLElement | null : null;
          const hv = getHoverSlot() ?? (focusedEl?.dataset.c ? { c: focusedEl.dataset.c, slot: Number(focusedEl.dataset.s) } : null);
          if (panelRef.current && hv && !(hv.c === 'inv' && hv.slot === n - 1)) { act('move', { from: hv.c, fs: hv.slot, to: 'inv', ts: n - 1 }); break; }
          if (!panelRef.current) { r.player.active = n - 1; rerender(); }
        }
      }
    };
    const up = (e: KeyboardEvent) => { if (keyMap[e.code]) (inp.current as any)[keyMap[e.code]] = false; const a=coreAimRef.current;if(a && a.code===e.code){coreAimRef.current=null;setCoreAim(null);const selected=gs.run && activeStack(gs.run);if(!panelRef.current && selected?.uid===a.uid && gs.run && !gs.run.player.dead){const vx=Math.round(cam.x),vy=Math.round(cam.y),spirit=selected.key==='core_demon' && a.mode==='signature';const dest=spiritTarget.current;if(spirit && (!dest||dest.uid!==a.uid)){toast('Open M and select explored safe ground first.');return;}inp.current.skill=a.mode;inp.current.skillAim={uid:a.uid,slot:gs.run.player.active,mx:spirit?dest!.x:mouse.current.x+vx,my:spirit?dest!.y:mouse.current.y+vy,viewX:vx,viewY:vy};}} };
    const blur = () => { const i = inp.current; i.up = i.down = i.left = i.right = i.attack = false; i.skill=undefined;i.cancel=true;coreAimRef.current=null;setCoreAim(null); };
    const wheel = (e: WheelEvent) => { const r = gs.run; if (!r || panelRef.current) return; if (buildModeRef.current) { setBuildTool(t => { const all: BuildTool[] = [...BUILD_KIT, 'upgrade', 'repair', 'reclaim']; const nx = all[(all.indexOf(t) + (e.deltaY > 0 ? 1 : all.length - 1)) % all.length]; applyTool(nx); return nx; }); return; } r.player.active = (r.player.active + (e.deltaY > 0 ? 1 : 7)) % 8; rerender(); };
    const vis = () => { if (document.hidden) { if (!qaMode) { if (saveSync(gs)) flushJourney(gs, false, journeyRef.current); void save(gs); } blur(); } };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur); window.addEventListener('wheel', wheel, { passive: true }); document.addEventListener('visibilitychange', vis); window.addEventListener('beforeunload', vis as any);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); window.removeEventListener('wheel', wheel); document.removeEventListener('visibilitychange', vis); window.removeEventListener('beforeunload', vis as any); };
  }, [gs]);

  // Never resume an uncommitted Creator cast after a saved/reopened UI.
  useEffect(() => { const a=gs.run?.player.action; if(a?.kind==='cast' && a.coreUid && !a.done) gs.run!.player.action=null; }, [gs]);
  useEffect(() => { if(panel){coreAimRef.current=null;setCoreAim(null);inp.current.skill=undefined;inp.current.cancel=true;inp.current.attack=false;inp.current.up=inp.current.down=inp.current.left=inp.current.right=false;} }, [panel]);

  // main loop
  useEffect(() => {
    const cv = cvRef.current; const g = cv?.getContext('2d'); if (!cv || !g) return; g.imageSmoothingEnabled = false;
    void pfx.initPfx();
    let last = performance.now(); let raf = 0; let uiAcc = 0, saveAcc = 0, ambAcc = 0; let ended = false;
    const loop = (t: number) => {
      // Cap animation/input physics only; tick catches up autonomous wall time from lastSimAt.
      raf = requestAnimationFrame(loop); const dt = Math.min(50, t - last); last = t; const now = Date.now();
      if (!gs.run) { if (!ended) { ended = true; if (!qaMode) save(gs); onRunEnd(); } return; }
      const i = inp.current; i.mx = mouse.current.x + Math.round(cam.x); i.my = mouse.current.y + Math.round(cam.y); i.viewX=Math.round(cam.x); i.viewY=Math.round(cam.y);
      let simDt = dt; if (hitstop.current > 0) { hitstop.current -= dt; simDt = dt * 0.08; }
      const phaseBefore = phaseOf(gs.run, now);
      const wasDead = gs.run.player.dead;
      tick(gs, i, simDt, now); i.attackPressed = false; i.roll = false; i.cancel = false; i.skill=undefined; i.skillAim=undefined;
      if (!gs.run) return;
      const phaseAfter = phaseOf(gs.run, now);
      if (!phaseWatch.current || phaseWatch.current.runId !== gs.run.id) phaseWatch.current = { runId: gs.run.id, phase: phaseAfter };
      else if (phaseWatch.current.phase !== phaseAfter) {
        phaseWatch.current.phase = phaseAfter;
        const cine = phaseAfter === 'danger' ? ragnarokCinematic(gs.run.id) : phaseAfter === 'awakening' ? eldersWakeCinematic(gs.run.id) : null;
        if (cine) { setCines(c => c.some(x => x.id === cine.id) ? c : [...c, cine]); setJourney(recordWorldMoment(journeyRef.current, gs.run.id, phaseAfter, cine.title, cine.detail, now)); }
        else { const event = experienceForPhase(phaseAfter, gs.run.id, now); if (event) { present(event); sfx({ type: 'banner' }); } }
      }
      // Death transfers the entire pack to a physical bag. Persist that custody
      // transition immediately instead of leaving a five-second rollback window.
      if (!wasDead && gs.run.player.dead) {
        sfx({ type: 'death' });
        if (!qaMode) {
          if (!saveSync(gs)) toast('Death save failed. Your changes are not confirmed on disk.', 'bad');
          void save(gs).then(ok => { if (!ok) toast('Death save failed. Your changes are not confirmed on disk.', 'bad'); });
        }
      }
      // VISUAL ARENA: connect committed engine receipts (presentation-cues.ts) to unified audio & UI cues
      const cues = deriveCues(gs.run.receipts, lastCueSeq.current);
      if (cues.length) {
        lastCueSeq.current = gs.run.receipts.at(-1)?.seq ?? lastCueSeq.current;
        // ATTENTION: fold one receipt batch into proportional feedback (L3 flares, L5 cinematics) before the feed sees it.
        const runNow = gs.run;
        const dir = directCues(cues, runNow, type => Object.values(runNow.entities).filter(e => e.kind === 'struct' && e.type === type && (!e.owner || e.owner === 'player')).length <= 1);
        for (const c of dir.cinematics) setCines(cur => cur.some(x => x.id === c.id) ? cur : [...cur, c]);
        if (dir.flares.length) heldFlares.current.push(...dir.flares);
        for (const cue of cues) {
          const event = dir.absorb.has(cue.receiptId) ? null : experienceFromCue(cue, gs.run);
          if (event) present(event);
          if (cue.kind === 'station_job_done' || cue.kind === 'hand_craft' || cue.kind === 'recycle_finished' || cue.kind === 'oil_extracted') { sfx({ type: 'craft' }); }
          else if (cue.kind === 'station_state_changed' && cue.detail.includes('fuel_out')) { sfx({ type: 'machineOff' }); }
          else if (cue.kind === 'heat_out') { sfx({ type: 'machineOff' }); }
          else if (cue.kind === 'tool_broke') { sfx({ type: 'break' }); }
          else if (cue.kind === 'elder_defeated') { /* the L5 cinematic owns this sound */ }
          else if (cue.kind === 'airdrop_landed') { sfx({ type: 'airdropImpact' }); }
          else if (cue.kind === 'cash_secured') { sfx({ type: 'coin' }); }
        }
      }
      // JOURNEY: receipt-cursor ingestion (immediately after new receipts, otherwise ~2.5 Hz for observed discoveries).
      journeyAcc.current += dt; if (cues.length || journeyAcc.current > 400) { journeyAcc.current = 0; runJourney(now); }
      // Cores are special only when their UID enters custody during this session; loading a save or QA preset is not a discovery.
      for (const sl of C(gs.run, 'inv').slots) {
        if (sl && ITEMS[sl.key]?.creatorCore && !seenCores.current.has(sl.uid)) {
          seenCores.current.add(sl.uid);
          present({ id: `core:${sl.uid}`, kind: 'relic', priority: 96, title: 'CREATOR CORE RECOVERED', detail: `${ITEMS[sl.key].name} · all three reserves remain physical. Equip it, inspect its signature, or save the charge.`, icon: sl.key, accent: ITEMS[sl.key].essence === 'fire' ? '#ff8a3a' : ITEMS[sl.key].essence === 'water' ? '#7fd8ff' : ITEMS[sl.key].essence === 'spirit' ? '#d99bff' : '#91d66d', duration: 5200, source: 'engine', tier: 'stage' });
          sfx({ type: 'jrelic' });
        }
      }
      target.current = findInteract(gs, now);
      pfx.update(simDt,now);pfx.tickStats(dt);
      consumeFX(e => { pfxFromSimEvent(e); sfx(e); if(e.type==='spiritDepart'){spiritTarget.current=null;setToasts(t=>t.filter(v=>!v.text.startsWith('Destination set.')));toast('Departed. The cart stays behind.');} else if(e.type==='spiritArrive'){setToasts(t=>t.filter(v=>!v.text.startsWith('Destination set.')&&!v.text.startsWith('Departed.')));toast('Arrived — Signature charge spent.','ok');scheduleSave();} else if (e.type === 'toast') toast(e.text); else if (e.type === 'hitstop') hitstop.current = Math.max(hitstop.current, e.ms); else if (e.type === 'banner') setBanner({ text: e.text, sub: e.sub, id: now }); else if (e.type === 'discover') setBanner({ text: e.name, sub: 'Discovered', id: now }); else if (e.type === 'region') setBanner(b => (b && now - b.id < 2500 ? b : { text: e.name, id: now })); else if (e.type === 'pickup') { fieldActionsRef.current.add('harvested'); scheduleSave(); } else if (e.type === 'struct.destroyed') scheduleSave(); });
      draw(g, gs, now, dt, { buildType: buildRef.current, reclaim: reclaimRef.current || repairRef.current || upgradeRef.current, mouseX: i.mx, mouseY: i.my, target: target.current, time: t, working: panelRef.current?.kind === 'container' });
      // close container panels when walking away
      const P = panelRef.current; if (P?.eid && gs.run.entities[P.eid]) { const e = gs.run.entities[P.eid]; if ((Math.hypot(e.x - gs.run.player.x, e.y - gs.run.player.y) > 3.4 * TILE || (e.kind === 'struct' && !clearWallLine(gs.run, gs.run.player, e)))) setPanel(null); } else if (P?.eid && !gs.run.entities[P.eid]) setPanel(null);
      // VISUAL ARENA audio: listener follows the camera; music is scheduled at
      // 10 Hz and ambience/machines/mood are re-derived at 1 Hz from real state.
      setListener(cam.x + VIEW_W / 2, cam.y + VIEW_H / 2);
      uiAcc += dt; if (uiAcc > 100) { uiAcc = 0; rerender(); tickMusic(now); }
      saveAcc += dt; if (saveAcc > 5000) { saveAcc = 0; if (!qaMode) void saveDetailed(gs).then(reportSave); }
      ambAcc += dt; if (ambAcc > 1000) {
        ambAcc = 0; const rr = gs.run; const pp = rr.player; setIssues(standingIssues(rr));
        const w = weatherAt(rr, now); const idx = Math.floor(pp.y / 16) * WW + Math.floor(pp.x / 16);
        const z = getWorld().zone[idx] ?? 0; const world = getWorld();
        const rain = w === 'storm' ? 1 : w === 'rain' ? 0.6 : 0;
        const wind = (z === 5 ? 0.9 : 0.25) + (w === 'storm' ? 0.6 : 0);
        setAmbience(rain, wind);
        const rag = isRagnarok(rr, now); const ph2 = phaseOf(rr, now);
        const dtm2 = dayTime(rr, now);
        let nearMachine = 0;
        for (const eid in rr.entities) {
          const en = rr.entities[eid];
          if (Math.abs(en.x - pp.x) > 420 || Math.abs(en.y - pp.y) > 420) continue;
          let run = false, kind = '';
          if (en.station) { run = en.station.burn > 0 && en.station.queue.length > 0; kind = en.type === 'refinery' ? 'refinery' : en.type === 'oil_pump' ? 'pump' : 'furnace'; }
          else if (en.basePower) { run = !!en.basePower.enabled && en.basePower.energy > 0; kind = 'generator'; }
          if (!kind) continue;
          if (run) nearMachine++;
          machineState(eid, kind, run, en.x, en.y);
        }
        setEnvironment({ zone: z, indoors: !!pp.sheltered, sheltered: !!pp.sheltered, night: dtm2 < 0.25 || dtm2 > 0.78, rag, phase: ph2, nearMachine: Math.min(3, nearMachine), coast: world.seaDist[idx] ?? 9 }, rain, wind);
        // adaptive score: authentic state only, and it still allows silence
        const threat = rr.creatures.some(m => m.state !== 'dead' && m.state !== 'sleep' && (m.state === 'chase' || m.state === 'attack' || m.state === 'tell') && Math.hypot(m.x - pp.x, m.y - pp.y) < 190);
        const elder = rr.creatures.some(m => m.elder && m.state !== 'sleep' && m.state !== 'dead' && Math.hypot(m.x - pp.x, m.y - pp.y) < 260);
        const moving = Math.hypot(pp.vx, pp.vy) > 6;
        if (moving || threat) idleAcc.current = 0; else idleAcc.current += 1000;
        setMood(pp.dead ? 'aftermath' : rag ? 'ragnarok' : elder ? 'elder' : threat ? 'combat'
          : pp.sheltered ? 'home' : z === 7 || z === 6 ? 'ruins' : (dtm2 < 0.25 || dtm2 > 0.78) ? 'night'
            : idleAcc.current > 22000 ? 'silence' : 'wild', now);
      }
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [gs]);

  const onMouseMove = (e: React.MouseEvent) => { const s = scaleRef.current; mouse.current = { x: (e.clientX - offRef.current.x) / s, y: (e.clientY - offRef.current.y) / s }; };
  const onMouseDown = (e: React.MouseEvent) => {
    const shiftHeld = e.shiftKey; // B01: Shift+click in repair mode reinforces a wall/door with one Iron Plate
    initAudio(); const r = gs.run; if (!r) return; onMouseMove(e);
    if (e.button === 2) { setBuildMode(false); coreAimRef.current=null;setCoreAim(null);inp.current.skill=undefined;inp.current.cancel = true; setBuildType(null); setReclaim(false); setRepairMode(false); setUpgradeMode(false); return; }
    if (e.button !== 0) return;
    if (panel || coreAimRef.current) return;
    const wx = mouse.current.x + Math.round(cam.x), wy = mouse.current.y + Math.round(cam.y); const tx = Math.floor(wx / 16), ty = Math.floor(wy / 16);
    if (buildType) { const res = act('build', { struct: buildType, tx, ty }); if (res.ok && buildType === 'escrow') setBuildType(null); return; }
    if (upgradeMode || repairMode || reclaim) {
      const order = ['wall', 'obj', 'roof', 'floor'];
      const ents = entsAt(r, tx, ty).filter(x => x.kind === 'struct' && (editLayer === 'auto' || STRUCTS[x.type!].layer === editLayer) && (!upgradeMode || !!STRUCTURE_UPGRADES[x.type!]));
      ents.sort((a,b)=>order.indexOf(STRUCTS[a.type!].layer)-order.indexOf(STRUCTS[b.type!].layer));
      if (ents[0]) act(upgradeMode ? 'upgradeStructure' : repairMode ? 'repairStructure' : 'reclaim', repairMode ? { eid: ents[0].id, material: shiftHeld ? 'iron_plate' : undefined } : { eid: ents[0].id });
      else if (reclaim && editLayer === 'auto') { const cart=Object.values(r.entities).find(x=>x.kind==='cart'&&Math.hypot(x.x-wx,x.y-wy)<12); if(cart) act('reclaim',{eid:cart.id}); else toast('No matching structure there.'); }
      else toast('No matching structure there. Use G to change layer.'); return;
    }
    const s = activeStack(r); if (s?.key === 'escrow_chest') { enterBuild('escrow'); return; }
    inp.current.attackPressed = true; inp.current.attack = true;
  };
  const onMouseUp = () => { inp.current.attack = false; };

  // Automated Vehicle Choreography Demo for QA Lab [F9]:
  // approach -> mount -> accelerate -> steer -> stop -> dismount
  const runBikeDemo = useCallback(async () => {
    const rr = gs.run; if (!rr || bikeDemoState) return;
    const b = Object.values(rr.entities).find(e => e.kind === 'vehicle' && e.vehicle);
    if (!b || !b.vehicle) { toast('Switch to Vehicle preset first.', 'bad'); return; }
    if ((b.hp ?? 0) <= 0) b.hp = BAL.motorbike.maxHp;
    if (b.vehicle.fuel <= 5) b.vehicle.fuel = 80;
    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
    setQaOpen(false); // the drawer must not cover the actor while the creator watches the transition

    setBikeDemoState('1/5 Approaching bike on foot');
    for (let n = 0; n < 90 && Math.hypot(b.x - rr.player.x, b.y - rr.player.y) > 21; n++) {
      const dx = b.x - rr.player.x, dy = b.y - rr.player.y;
      inp.current.left = dx < -4; inp.current.right = dx > 4;
      inp.current.up = dy < -4; inp.current.down = dy > 4;
      await sleep(45);
    }
    inp.current.up = inp.current.down = inp.current.left = inp.current.right = false;
    await sleep(180);
    if (Math.hypot(b.x - rr.player.x, b.y - rr.player.y) > 27) {
      setBikeDemoState(null); toast('Could not reach the parked bike; its real collision route is blocked.', 'bad'); setQaOpen(true); return;
    }

    setBikeDemoState('2/5 Mounting saddle');
    const mounted = act('vehicleMount', { eid: b.id });
    if (!mounted.ok) { setBikeDemoState(null); toast(mounted.reason, 'bad'); setQaOpen(true); return; }
    await sleep(480);

    setBikeDemoState('3/5 Accelerating East');
    inp.current.right = true;
    await sleep(850);
    inp.current.right = false;

    setBikeDemoState('4/5 Steering South-West');
    inp.current.down = true;
    await sleep(550);
    inp.current.left = true;
    await sleep(550);
    inp.current.down = false; inp.current.left = false;
    await sleep(350);

    setBikeDemoState('5/5 Dismounting');
    const exited = act('vehicleExit', {});
    if (!exited.ok) { setBikeDemoState(null); toast(exited.reason, 'bad'); setQaOpen(true); return; }
    await sleep(700);
    setBikeDemoState(null); setQaOpen(true);
  }, [gs, bikeDemoState, act, toast]);

  const simulateQaOffline = useCallback(() => {
    if (!qaMode || !gs.run) { toast('Offline replay is available only in the isolated QA session.', 'bad'); return; }
    const r = gs.run; const now = Date.now();
    // Advance QA run clock cleanly by 6.5h and align lastSimAt so settle() executes the real 6.5h absence window.
    r.qaOffset += 6.5 * HOUR;
    r.qaUsed = true;
    r.clock.lastSimAt = now - 6.5 * HOUR;
    const result = settleWithReturn(gs, now);
    lastCueSeq.current = r.receipts.at(-1)?.seq ?? lastCueSeq.current;
    if (result.report) setReturnHistory(recordReturnHistory(r, qaMode, result.report));
    const sev = result.report ? classifyOfflineReturn(result.report) : 'notable';
    if (sev === 'minimal' && result.report) {
      setReturnDigest(result.report);
      setPanel(null);
    } else {
      setReturnDigest(null);
      setPanel({ kind: 'report', lines: result.lines, report: result.report });
    }
    setQaOpen(false);
    rerender();
  }, [gs, qaMode, toast, rerender]);

  if (import.meta.env.VITE_SOH_QA === '1') (window as any).__soh = gs; // QA builds only: mutable state reference for drivers
  // QA read-only view: camera + stage transform + current interaction target (lets a driver aim the real mouse). No authority.
  (window as any).__sohView = () => ({ lastSave: lastSaveOutcome(), cam: { x: cam.x, y: cam.y }, scale: scaleRef.current, off: offRef.current, target: target.current ? { kind: target.current.kind, label: target.current.label, eid: target.current.eid ?? null } : null });
  // QA fixture passthrough: used ONLY by disclosed browser fixtures (pack filling, cart placement). Gameplay still goes through dispatch.
  if (import.meta.env.VITE_SOH_QA === '1') (window as any).__sohQA = { // QA builds only: fixture helpers (all mutations via engine rules)
    act: (type: string, payload: Record<string, any> = {}) => act(type, payload),
    preparePack: () => qaPrepareFullPack(gs.run!), fillPack: () => qaFillPack(gs.run!), setSecuredCash: (n: number) => qaSetSecuredCash(gs, n),
  };
  (window as any).__sohJourney = () => journeyRef.current; // read-only QA view, no authority
  const r = gs.run; if (!r) return <div className="stage" />;
  const p = r.player; const now = Date.now(); const ph = phaseOf(r, now); const hrs = runHours(r, now); const day = Math.floor(hrs / 24) + 1;
  const dtm = dayTime(r, now); const clock = `${String(Math.floor(dtm * 24)).padStart(2, '0')}:${String(Math.floor((dtm * 24 % 1) * 60)).padStart(2, '0')}`;
  const w = weatherAt(r, now); const slot = Math.floor((now - r.startedAt + r.qaOffset) / (BAL.weather.slotMinutes * 60000)); const next = weatherSlot(r.seed, slot + 1);
  const WICON: Record<string, string> = { clear: '☀', cloudy: '☁', rain: '☂', storm: '⚡', fog: '≋' };
  const engaged = r.creatures.find(m => m.elder && m.state !== 'sleep' && m.state !== 'dead' && Math.hypot(m.x - p.x, m.y - p.y) < 240);
  const cart = p.pulling ? r.entities[p.pulling] : null;
  const bike=p.vehicle ? r.entities[p.vehicle] : null;
  const tgt = target.current; const targetEntity = tgt?.eid ? r.entities[tgt.eid] : undefined;
  const targetHp = targetEntity?.kind === 'struct' && targetEntity.hp !== undefined && targetEntity.maxHp !== undefined && targetEntity.hp < targetEntity.maxHp ? ` · HP ${Math.ceil(targetEntity.hp)}/${targetEntity.maxHp}` : '';
  const ts = tgt ? { x: tgt.x - Math.round(cam.x), y: tgt.y - Math.round(cam.y) } : null;
  const zone = (getWorld().zoneNames || ZONES)[getWorld().zone[Math.floor(p.y / 16) * WW + Math.floor(p.x / 16)]];
  const hoverX=Math.floor((mouse.current.x+Math.round(cam.x))/TILE), hoverY=Math.floor((mouse.current.y+Math.round(cam.y))/TILE);
  const layers=['wall','obj','roof','floor']; const hover=entsAt(r,hoverX,hoverY).filter(e=>e.kind==='struct'&&(editLayer==='auto'||STRUCTS[e.type!].layer===editLayer)&&(!upgradeMode||!!STRUCTURE_UPGRADES[e.type!])).sort((a,b)=>layers.indexOf(STRUCTS[a.type!].layer)-layers.indexOf(STRUCTS[b.type!].layer))[0];
  const placementReason=buildType?buildReason(gs,buildType,hoverX,hoverY):null;
  const heldCash = countItem(r, 'inv', 'rcash'); const surf = SPEED_KEY[effTile(r, Math.floor(p.x / 16), Math.floor(p.y / 16))] || '';
  // ---------------- HUD ARBITRATION ----------------
  // One question per moment: what does the player need RIGHT NOW? Everything else steps back.
  //  · full-screen surfaces (Survivor, map, return report) own the screen: HUD cards, feed and centre theatre wait;
  //  · a docked panel (station, chest, vendor…) owns its side: context cards there are withdrawn;
  //  · combat (Elder in range, Core aim) withdraws comfort cards and the airdrop strip, keeps vitals + boss bar;
  //  · at most ONE context card (heat OR home) is shown, chosen by urgency; build mode prefers home.
  const fullScreen = panel?.kind === 'inv' || panel?.kind === 'craft' || panel?.kind === 'report' || panel?.kind === 'map' || panel?.kind === 'notes' || panel?.kind === 'journey';
  const combatFocus = !!engaged || !!coreAim;
  const thermal = thermalStatusView(r, thermalEnvNow(r, now), p.warmth);
  const heatUrgent = thermal.cold || thermal.warmth < thermal.coldThreshold + 12 || (thermal.warmth < 70 && thermal.heaters.some(h => h.status === 'out_of_fuel' || h.status === 'blocked_by_wall'));
  const nearHome = !!nearestHomeStructure(r, Math.floor(p.x / 16), Math.floor(p.y / 16), 6);
  const homeAtRisk = nearHome && (() => { const n = nearestHomeStructure(r, Math.floor(p.x / 16), Math.floor(p.y / 16), 6)!; const st = homeStatus(r).structures.find(x => x.id === n.id); return !!st && (st.state !== 'funded' || st.damaged); })();
  const contextCard: 'heat' | 'home' | null = panel || combatFocus || p.dead || qaOpen ? null
    : buildMode ? (nearHome ? 'home' : null)
      : heatUrgent ? 'heat' : nearHome && (homeAtRisk) ? 'home' : null;
  const rigBottom = bike || cart ? 74 : 32;
  const fieldEval = evaluateFieldNotes(r, now, fieldActionsRef.current, fieldNoteStore);
  useEffect(() => {
    if (fieldEval.nextStore !== fieldNoteStore) {
      setFieldNoteStore(writeFieldNoteStore(r, qaMode, fieldEval.nextStore));
    }
  }, [fieldEval.nextStore, fieldNoteStore, r, qaMode]);
  const updateFieldStore = (patch: Partial<FieldNoteStore>) => {
    setFieldNoteStore(cur => writeFieldNoteStore(r, qaMode, { ...cur, ...patch }));
  };
  const criticalEdge = !p.dead && !fullScreen && (p.hp < 25 || thermal.cold);
  // ---------------- JOURNEY / ATTENTION view model ----------------
  const trackView = resolveTrack(journey, hrs);
  const wmVisible = !fullScreen && !p.dead && !qaOpen;
  const calmish = !combatFocus && p.hp >= 35;
  gateRef.current = { stamp: wmVisible && !panel && calmish, flare: !fullScreen && !combatFocus && !p.dead, cine: !fullScreen && !p.dead };
  const activeStamp = gateRef.current.stamp ? stamps[0] ?? null : null;
  const anchorKey = trackView?.anchor && !trackView.done ? JSON.stringify(trackView.anchor) : '';
  if (anchorKey && (anchorCache.current.key !== anchorKey || now - anchorCache.current.t > 500)) anchorCache.current = { t: now, key: anchorKey, v: findAnchor(r, trackView!.anchor, now) };
  const anchor = anchorKey ? anchorCache.current.v : null;
  const nearAnchor = !!anchor && trackView?.anchor?.kind === 'struct' && Math.hypot(anchor.x - p.x, anchor.y - p.y) < 5 * TILE;
  const wmMode: WaymarkMode = !calmish ? 'glyph' : peek || nearAnchor || (buildMode && !!trackView?.focus?.includes('build')) ? 'open' : 'compact';
  const blocked = trackView?.anchor?.kind === 'struct' && !anchor && !trackView.done ? `Needs your own ${STRUCTS[trackView.anchor.types[0]]?.name ?? 'station'} first — Build [B].` : null;
  const shownIssues = issues.filter(i => snoozed[i.id] !== i.sig);
  const unseenCount = journey.chronicle.filter(c => !c.seen).length;
  const track = (t: TrackRef | 'auto') => {
    setJourney({ ...journeyRef.current, tracked: t === 'auto' ? null : t, trackQuiet: t === 'auto' ? false : !t });
    sfx({ type: 'ui' });
  };
  const quickGoals = [
    ...FIELDCRAFT.filter(l => !lessonComplete(journey, l)).map(l => {
      const step = currentStep(journey, l);
      return { ref: { type: 'lesson' as const, id: l.id }, title: l.title, detail: step?.title ?? 'Mastered', icon: l.icon };
    }),
    ...(journey.daily?.objectives.filter(o => !o.done).map(o => ({
      ref: { type: 'daily' as const, id: o.id }, title: DAILY_BY_ID[o.id]?.title ?? o.id,
      detail: `${o.progress}/${DAILY_BY_ID[o.id]?.target ?? 1} · ${DAILY_BY_ID[o.id]?.points ?? 0} pts`,
      icon: DAILY_BY_ID[o.id]?.icon ?? 'gear',
    })) ?? []),
  ];
  const openTrackedAction = () => {
    const f = trackView?.focus ?? [];
    if (f.includes('build') || trackView?.ref.type === 'lesson' && trackView.ref.id === 'shelter') { enterBuild(); return; }
    if (f.includes('craft') || trackView?.ref.type === 'daily' && DAILY_BY_ID[trackView.ref.id]?.cat === 'craft') {
      setPanel({ kind: 'craft' }); return;
    }
    if (f.includes('station') && anchor) {
      // The player must walk to the real machine; we only point to the known location.
      setPanel({ kind: 'map' }); return;
    }
    if (f.includes('explore') || trackView?.anchor || trackView?.ref.type === 'daily' && ['explore','gather'].includes(DAILY_BY_ID[trackView.ref.id]?.cat ?? '')) {
      setPanel({ kind: 'map' }); return;
    }
    setPanel({ kind: 'journey' });
  };
  const showBeacon = wmVisible && !panel && calmish && !!trackView && !trackView.done; // world-space guidance never collides with the HUD stamp
  const cine0 = cines[0] ?? null;
  // A suggestion that has actually been displayed counts as "seen" (never as progress).
  useEffect(() => { if (trackView?.ref.type === 'lesson' && lessonState(journeyRef.current, trackView.ref.id).status === 'unseen') { const id = trackView.ref.id; setJourney({ ...journeyRef.current, lessons: { ...journeyRef.current.lessons, [id]: { ...lessonState(journeyRef.current, id), status: 'seen' } } }); } }, [trackView?.ref.id]);

  return <div style={{ position: 'fixed', inset: 0, cursor: buildType || reclaim || repairMode || upgradeMode ? 'cell' : 'crosshair' }} onMouseMove={onMouseMove} onMouseDown={onMouseDown} onMouseUp={onMouseUp} onContextMenu={e => e.preventDefault()}>
    <div ref={stageRef} className="stage" style={{ transform: `translate(${off.x}px, ${off.y}px) scale(${scale})` }}>
      <canvas ref={cvRef} width={VIEW_W} height={VIEW_H} style={{ width: VIEW_W, height: VIEW_H }} />
      {criticalEdge && <div className={`danger-vignette ${vp.reduceFlash ? 'soft' : ''}`} aria-hidden="true" />}

      {/* TOP-LEFT COLUMN: Vitals + Urgent Danger Rail + Thermal Context Card */}
      <div className="hud hud-col hud-col--left" style={{ left: 4, top: 4 }} onMouseDown={e => e.stopPropagation()}>
        <Vitals r={r} now={now} />
        {!fullScreen && <UrgentAlerts r={r} cold={thermal.cold} />}
        {!fullScreen && !p.dead && <IssueRail issues={shownIssues} px={p.x} py={p.y} compact={combatFocus} onSnooze={i => setSnoozed(sn => ({ ...sn, [i.id]: i.sig }))} />}
        {contextCard === 'heat' && <ThermalStatusCard r={r} now={now} inline />}
      </div>

      {/* TOP-RIGHT COLUMN: Clock + Quick Controls + Ragnarok + Digest / Home / Field Notes */}
      <div className="hud hud-col hud-col--right" style={{ right: 4, top: 4 }} onMouseDown={e => e.stopPropagation()}>
        <WorldClock r={r} now={now} secured={gs.profile.securedCash} />
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {ph === 'calm' && hrs > 230 && <span className="chip pulse" style={{ color: 'var(--warn)' }}>RAGNAROK IN {(264 - hrs).toFixed(1)}h</span>}
          {qaMode && <button className={`btn sm ${qaOpen ? 'gold' : ''}`} title="Visual Experience QA Lab [F9]" onClick={() => setQaOpen(v => !v)}>QA [F9]</button>}
          <button className={`btn sm jbtn ${panel?.kind === 'journey' ? 'gold' : ''}`} title="Journey ledger: Fieldcraft, Waypoints, Chronicle [J]" onClick={() => setPanel(pp => pp?.kind === 'journey' ? null : { kind: 'journey' })}>Journey [J]{unseenCount > 0 && <i>{unseenCount}</i>}</button>
          <button className={`btn sm ${panel?.kind === 'notes' ? 'gold' : ''}`} title="Contextual Field Notes & Reference [N]" onClick={() => setPanel(pp => pp?.kind === 'notes' ? null : { kind: 'notes' })}>Notes [N]</button>
          {returnHistory.length > 0 && <button className="btn sm" title="Review offline return chronicle" onClick={() => { setReturnDigest(null); setPanel(pp => pp?.kind === 'report' ? null : { kind: 'report', lines: [], report: returnHistory[0].report }); }}>Return</button>}
          <button className="btn sm" title="Mute everything" onClick={() => { const m = !getPrefs().muted; setPrefs({ muted: m }); setVolume(gs.profile.settings.volume, m || gs.profile.settings.muted); }}
            style={{ color: vp.muted ? 'var(--bad)' : 'var(--muted)' }}>{vp.muted ? 'OFF' : 'SFX'}</button>
          <button className="btn sm" title="Menu, offline forecast & presentation [Esc]" onClick={() => setPanel(pp => pp?.kind === 'menu' ? null : { kind: 'menu' })}>☰</button>
        </div>
        {!panel && !combatFocus && <RagnarokStrip r={r} now={now} secured={gs.profile.securedCash} />}
        {!panel && !qaOpen && returnDigest && <ReturnDigest report={returnDigest} onExpand={() => { setPanel({ kind: 'report', lines: [], report: returnDigest }); setReturnDigest(null); }} onDismiss={() => setReturnDigest(null)} />}
        {contextCard === 'home' && <HomeStatusCard r={r} px={p.x} py={p.y} inline />}
        {wmVisible && !panel && <Waymark view={trackView} mode={wmMode} store={journey} stamp={activeStamp} blocked={blocked} onToggle={() => setPeek(v => !v)} onUntrack={() => track(null)} onQuickTrack={track} quickGoals={quickGoals} onAction={openTrackedAction} onOpenJournal={() => setPanel({ kind: 'journey' })} />}
        {!panel && !buildMode && !combatFocus && !qaOpen && !returnDigest && contextCard !== 'home' && fieldEval.active && !activeStamp && wmMode !== 'open' && !(trackView && ['first_landfall', 'pack_and_craft'].includes(fieldEval.active.id)) && (
          <FieldNoteCard
            note={fieldEval.active}
            onDismiss={id => updateFieldStore({ dismissed: [...fieldNoteStore.dismissed, id] })}
            onOpenJournal={() => setPanel({ kind: 'notes' })}
            onMute={() => updateFieldStore({ muted: true })}
            onAction={['death_bag', 'spirit_blink', 'pack_and_craft', 'worn_tool', 'hunger_thirst'].includes(fieldEval.active.id)
              ? () => setPanel({ kind: ['death_bag', 'spirit_blink'].includes(fieldEval.active!.id) ? 'map' : 'inv' })
              : undefined}
          />
        )}
      </div>

      {/* TOP-CENTER UNIFIED ATTENTION STACK: Elder Boss -> Airdrop -> Core Aim -> Stage Plaques */}
      <div className="hud hud-col hud-col--center" style={{ left: '50%', transform: 'translateX(-50%)', top: 4, pointerEvents: 'none' }}>
        {engaged && <ElderBossHUD m={engaged} />}
        {!engaged && !fullScreen && Object.values(r.entities).filter(e => e.kind === 'airdrop' && e.airdrop).map(e => <AirdropCard key={e.id} e={e} now={now} stacks={e.c ? C(r, e.c).slots.filter(Boolean).length : 0} />)}
        {coreAim && <div className="plate core-aim-chip">
          {activeStack(r)?.key==='core_meteor' ? (coreAim.mode==='refined'?'Q: targeted meteor':'E: ten meteors in view') : activeStack(r)?.key==='core_dragon' ? (coreAim.mode==='refined'?'Q: fire tornado':'E: collect visible eligible foes') : activeStack(r)?.key==='core_demon' ? (coreAim.mode==='refined'?'Q: stationary beam':spiritTarget.current?.uid===activeStack(r)?.uid?'E: selected map destination':'E: select destination on M map') : activeStack(r)?.key==='core_mjolnir' ? (coreAim.mode==='refined'?'Q: five lightning strikes':'E: electrical attraction') : activeStack(r)?.key==='core_earthmother' ? (coreAim.mode==='refined'?'Q: ten trees on open ground':'E: binding roots and grass') : activeStack(r)?.key==='core_elsa' ? (coreAim.mode==='refined'?'Q: one-second ice ward':'E: freeze visible terrain') : (coreAim.mode==='refined'?'Q: timed bomb · release to throw':'E: burning projectile · release to cast')} · RMB/Esc cancel
        </div>}
        {cine0 && combatFocus && gateRef.current.cine && <CinematicLayer c={cine0} compact reduceMotion={vp.reduceFlash} onDone={() => setCines(c => c.slice(1))} />}
        {!fullScreen && !p.dead && !cine0 && !(combatFocus && experiences[0] && experiences[0].kind !== 'world' && experiences[0].kind !== 'warning') && <ExperienceStage events={experiences} onDismiss={dismissExperience} combatFocus={combatFocus || p.hp < 35} inline />}
        {banner && !experiences.length && !fullScreen && <div key={banner.id} className="banner" style={{ textAlign: 'center', pointerEvents: 'none', marginTop: 4 }} onAnimationEnd={() => setBanner(null)}><div className="title-font" style={{ fontSize: 18, color: '#ffe8b0', textShadow: '2px 2px 0 #2a1006, 0 0 8px #ff9a3a' }}>{banner.text}</div>{banner.sub && <div style={{ fontSize: 11, color: '#e0d0f0', textShadow: '1px 1px 0 #000' }}>{banner.sub}</div>}</div>}
      </div>

      <FieldPickupLayer items={fieldPickups} camX={Math.round(cam.x)} camY={Math.round(cam.y)} />
      {showBeacon && <WorldBeacon target={anchor} camX={Math.round(cam.x)} camY={Math.round(cam.y)} icon={trackView!.icon} />}
      <FlareLayer flares={flares} camX={Math.round(cam.x)} camY={Math.round(cam.y)} />
      {cine0 && !combatFocus && gateRef.current.cine && <CinematicLayer c={cine0} compact={false} reduceMotion={vp.reduceFlash} onDone={() => setCines(c => c.slice(1))} />}
      {coreAim && ['core_meteor','core_dragon','core_elsa'].includes(activeStack(r)?.key||'') && coreAim.mode==='signature' && <svg className="absolute" width={VIEW_W} height={VIEW_H} style={{left:0,top:0,pointerEvents:'none'}}><rect x="2" y="2" width={VIEW_W-4} height={VIEW_H-4} fill="none" stroke="#ffd98a" strokeDasharray="4 3"/></svg>}
      {coreAim && !(activeStack(r)?.key==='core_demon' && coreAim.mode==='signature') && !(['core_meteor','core_dragon','core_elsa'].includes(activeStack(r)?.key||'') && coreAim.mode==='signature') && (()=>{const px=p.x-Math.round(cam.x),py=p.y-Math.round(cam.y),len=rayLen(r,p.x,p.y,p.aim,['core_meteor','core_dragon','core_elsa'].includes(activeStack(r)?.key||'')?Math.min(activeStack(r)?.key==='core_meteor'?180:157,Math.hypot(mouse.current.x+Math.round(cam.x)-p.x,mouse.current.y+Math.round(cam.y)-p.y)):coreAim.mode==='refined'?120:195);return <svg className="absolute" width={VIEW_W} height={VIEW_H} style={{left:0,top:0,pointerEvents:'none'}}><line x1={px} y1={py} x2={px+Math.cos(p.aim)*len} y2={py+Math.sin(p.aim)*len} stroke="#ffd98a" strokeWidth="1" strokeDasharray="4 3"/><circle cx={px+Math.cos(p.aim)*len} cy={py+Math.sin(p.aim)*len} r="4" fill="none" stroke="#ffd98a"/></svg>;})()}

      {/* interaction prompt */}
      {tgt && ts && !panel && !buildMode && <div className="prompt absolute" style={{ left: Math.max(60, Math.min(VIEW_W - 60, Math.round(ts.x))), top: Math.round(ts.y) - 34, transform: 'translateX(-50%)', pointerEvents: 'none' }}>
        <span className="key">{bike ? 'F' : 'E'}</span>{tgt.label}{targetHp && <span style={{ color: 'var(--warn)' }}>{targetHp}</span>}
      </div>}

      {/* build helper */}
      {!buildMode && (buildType || reclaim || repairMode || upgradeMode) && <div className="panel absolute" style={{ left: 145, bottom: 38, width: 350, padding: '3px 6px', fontSize: 11, textAlign: 'center',lineHeight:1.1 }} onMouseDown={e => e.stopPropagation()}>{buildType ? <><b style={{color:'#ffd98a'}}>Place {STRUCTS[buildType].name}</b> · {STRUCTS[buildType].cost.map(([k,q])=>`${ITEMS[k].name} ${countItem(r,'inv',k)}/${q}`).join(' · ')}<br/><span style={{color:placementReason?'#ff9a8a':'#9ae0a0'}}>{placementReason||(buildType==='claim'?'Placement allowed':claimAt(r,hoverX,hoverY)?`Placement allowed · cabinet coverage ${territoryForecast(r,claimAt(r,hoverX,hoverY)!).funded?'funded':'unfunded'}`:'Placement allowed · unprotected, decays in ~2h')} · RMB/Esc stop</span></> : <><b>{upgradeMode?'Upgrade':repairMode?'Repair':'Dismantle'}</b> · G layer: {editLayer} · RMB/Esc stop<br/>{hover ? <span>{STRUCTS[hover.type!].name} · HP {Math.ceil(hover.hp||0)}/{hover.maxHp} · {hover.owner && hover.owner!=='player'?'not owned':'owned'}{upgradeMode && STRUCTURE_UPGRADES[hover.type!] ? ` → ${STRUCTS[STRUCTURE_UPGRADES[hover.type!]].name}: ${STRUCTS[STRUCTURE_UPGRADES[hover.type!]].cost.map(([k,q])=>`${ITEMS[k].name} ${countItem(r,'inv',k)}/${q}`).join(', ')}` : ''}{repairMode ? ` · Repair: ${STRUCTS[hover.type!].cost.map(([k,q])=>`${ITEMS[k].name} ${countItem(r,'inv',k)}/${Math.max(1,Math.ceil(q/4))}`).join(', ')}` : ''}{reclaim ? ` · Refund: ${STRUCTS[hover.type!].item ? ITEMS[STRUCTS[hover.type!].item!].name : STRUCTS[hover.type!].cost.map(([k,q])=>`${ITEMS[k].name} ${Math.floor(q*BAL.economy.reclaimRefund)}`).join(', ')}` : ''}</span> : 'Point at a structure; click to act.'}</>}</div>}

      {/* cargo + bottom-left event feed */}
      {(bike || cart) && !fullScreen && <div className="hud" style={{ left: 4, bottom: 32 }} onMouseDown={e => e.stopPropagation()}><RigStatus r={r} /></div>}
      {!fullScreen && !qaOpen && <EventFeed lines={feed} bottom={rigBottom} />}
      {!panel && !feed.length && <div className="absolute log-fallback" style={{ left: 4, bottom: rigBottom }}>{r.log.slice(-2).map((l, i) => { const age = now - l.t; if (age > 7500) return null; return <div key={i} className="logline" style={{ opacity: Math.max(0, 1 - age / 7500), color: l.tone === 'gold' ? 'var(--brassLit)' : l.tone === 'red' ? 'var(--bad)' : l.tone === 'blue' ? 'var(--info)' : 'var(--paper)' }}>{l.msg}</div>; })}</div>}

      {/* full-screen toast rail (when a modal covers the bottom hotbar) */}
      {fullScreen && <div className="absolute toast-rail" style={{ left: 0, right: 0, top: 26, pointerEvents: 'none', zIndex: 60 }}>{toasts.filter(t => now - t.t < 3200).map(t => <div key={t.id} className={`toast toastin ${t.tone === 'bad' ? 'bad' : t.tone === 'ok' ? 'ok' : ''}`}><span className="toast__mark">{t.tone === 'bad' ? '✕' : t.tone === 'ok' ? '✓' : '•'}</span><span>{t.text}</span></div>)}</div>}

      {/* BOTTOM-CENTER STACK: Toasts -> Core Reserve Strip -> Quickbar / BuildBar */}
      <div className="hud" style={{ left: '50%', transform: 'translateX(-50%)', bottom: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, zIndex: 25 }} onMouseDown={e => e.stopPropagation()}>
        {!fullScreen && !!toasts.filter(t => now - t.t < 3200).length && <div className="toast-rail" style={{ pointerEvents: 'none' }}>{toasts.filter(t => now - t.t < 3200).map(t => <div key={t.id} className={`toast toastin ${t.tone === 'bad' ? 'bad' : t.tone === 'ok' ? 'ok' : ''}`}><span className="toast__mark">{t.tone === 'bad' ? '✕' : t.tone === 'ok' ? '✓' : '•'}</span><span>{t.text}</span></div>)}</div>}
        {!buildMode && !panel && coreAim && <CoreReserveStrip r={r} />}
        {buildMode ? <BuildBar gs={gs} tool={buildTool} onPick={applyTool} hoverX={hoverX} hoverY={hoverY} />
          : !panel && <Hotbar r={r} onPick={i => { p.active = i; sfx({ type: 'ui' }); rerender(); }} onUse={i => act('useItem', { slot: i })} onOpenPack={() => { fieldActionsRef.current.add('survivor'); setPanel({ kind: 'inv' }); sfx({ type: 'ui' }); }} />}
      </div>

      {/* panels */}
      {(panel?.kind === 'inv' || panel?.kind === 'craft') && <SurvivorScreen api={api} initial="all" focusRecipe={panel.recipe} />}
      {trackView && !p.dead && ((panel?.kind === 'inv' || panel?.kind === 'craft') && (trackView.focus?.includes('craft') || trackView.ref.type === 'daily' && ['craft','produce'].includes(DAILY_BY_ID[trackView.ref.id]?.cat ?? '')) || panel?.kind === 'map' && (trackView.focus?.includes('explore') || trackView.ref.type === 'daily' && ['explore','gather'].includes(DAILY_BY_ID[trackView.ref.id]?.cat ?? ''))) && <div className="journey-context-peek" role="status" title={trackView.how} onMouseDown={e => e.stopPropagation()}>
        <span className="journey-context-peek__dot"/><b>{trackView.title}</b><em>{trackView.progress}/{trackView.target}</em>
        <button onClick={() => setPanel({ kind: 'journey' })} title="See the whole journey">❖</button>
      </div>}
      {panel?.kind === 'container' && panel.eid && <ContainerPanel api={api} eid={panel.eid} />}
      {panel?.kind === 'map' && <MapPanel api={api} qaSession={qaMode} teleportTarget={spiritTarget.current?.uid===activeStack(r)?.uid?spiritTarget.current:null} onTeleportSelect={activeStack(r)?.key==='core_demon' ? (x,y)=>{const reason=spiritDestination(r,x,y);if(reason){toast(reason,'bad');return;}spiritTarget.current={uid:activeStack(r)!.uid,x,y};toast('Destination set. Close the map, then hold and release E.','ok');} : undefined} />}
      {panel?.kind === 'notes' && <FieldNotesPanel
        matching={fieldEval.matching}
        store={fieldNoteStore}
        onDismiss={id => updateFieldStore({ dismissed: [...fieldNoteStore.dismissed, id] })}
        onRestore={id => updateFieldStore({ dismissed: fieldNoteStore.dismissed.filter(x => x !== id) })}
        onToggleMute={() => updateFieldStore({ muted: !fieldNoteStore.muted })}
        onClose={() => setPanel(null)}
      />}
      {panel?.kind === 'journey' && <JourneyLedger gs={gs} store={journey} now={now}
        onTrack={t => track(t)}
        onLesson={(id, st) => setJourney({ ...journeyRef.current, lessons: { ...journeyRef.current.lessons, [id]: { ...lessonState(journeyRef.current, id), status: st } } })}
        onReroll={id => setJourney(rerollDaily(journeyRef.current, id, r))}
        onSeen={() => setJourney(markChronicleSeen(journeyRef.current))}
        onClose={() => setPanel(null)} onOpenNotes={() => setPanel({ kind: 'notes' })} />}
      {panel?.kind === 'skills' && <SkillsPanel api={api} />}
      {panel?.kind === 'menu' && <MenuPanel api={api} qaMode={qaMode} returnHistory={returnHistory} onSave={() => qaMode ? Promise.resolve(false) : save(gs)} onQuit={async () => { if (qaMode) { onExit(); return; } if (await save(gs)) onExit(); else toast('Save failed; staying in the run.', 'bad'); }} />}
      {panel?.kind === 'menu' && <div className="panel absolute fadein scroll" style={{ left: 6, top: 34, width: 198, maxHeight: 306, overflowY: 'auto', padding: 6 }} onMouseDown={e => e.stopPropagation()}>
        <div className="panel-h" style={{ marginBottom: 4 }}>Presentation</div>
        <PresentationPanel />
      </div>}
      {panel?.kind === 'vendor' && panel.eid && <VendorPanel api={api} eid={panel.eid} />}
      {panel?.kind === 'escrow' && panel.eid && <EscrowPanel api={api} eid={panel.eid} />}
      {panel?.kind === 'rest' && panel.eid && <RestPanel api={api} eid={panel.eid} />}
      {panel?.kind === 'evac' && panel.eid && <EvacPanel api={api} eid={panel.eid} />}
      {panel?.kind === 'report' && <ReportPanel api={api} lines={panel.lines || []} report={panel.report ?? null} history={returnHistory} />}
      <DragGhost />
      {p.dead && <DeathRecoveryOverlay gs={gs} onRespawn={() => act('respawn')} />}
      {qaOpen && !p.dead && !panel && <QaSandboxDrawer
        gs={gs}
        activePreset={qaPreset}
        onSelectPreset={(id) => { if (onSwitchQaPreset) onSwitchQaPreset(id); }}
        onTriggerEvent={(ev, ek) => {
          if (ev === 'ragnarok') {
            const hours = Math.max(0, 264.05 - runHours(r, Date.now()));
            const result = act('qaAdvance', { hours });
            if (result.ok) toast('QA clock advanced through the engine; Ragnarok phase is live.', 'ok');
            return;
          }
          const res = triggerQaEvent(gs, ev, Date.now(), ek);
          if (res.banner) present(stagedExperience(`qa:${ev}:${Date.now()}`, ev === 'awaken_elder' || ev === 'defeat_elder' || ev === 'overheat_elder' ? 'boss' : ev.includes('airdrop') ? 'world' : 'milestone', res.banner.text, res.banner.sub, ev.includes('airdrop') ? 'airdrop_open' : undefined));
          if (res.coreKey) sfx({ type: 'rare' });
          rerender();
        }}
        onCycleBike={() => { const st = qaCycleBikeState(r); toast(`Motorbike: ${st}`, 'ok'); rerender(); }}
        onRunBikeDemo={() => { void runBikeDemo(); }}
        onSimulateOffline={simulateQaOffline}
        bikeDemoState={bikeDemoState}
        onClose={() => setQaOpen(false)}
      />}
    </div>
    {import.meta.env.VITE_FX_TEST === '1' && <SpiritVfxEditor gs={gs} top={off.y + Math.round(62 * scale) + 4} right={Math.max(0, window.innerWidth - off.x - VIEW_W * scale) + 8} viewport={{left:off.x,top:off.y,scale,width:VIEW_W,height:VIEW_H}} />}
  </div>;
}
void HOUR; void CREATURES;
